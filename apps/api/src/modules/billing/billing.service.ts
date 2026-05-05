import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BillStatus,
  ChargeSourceType,
  ContractStatus,
  InvoiceStatus,
  ExtraChargeStatus,
  Prisma,
} from "@prisma/client";

import { PERMISSION_CODES, type AuthenticatedUser } from "@erpdog/contracts";

import { AuditService } from "../../common/audit/audit.service";
import {
  parsePeriodMonth,
  PeriodLockService,
  previousPeriodMonth,
} from "../../common/periods/period-lock.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  decimalString,
  lineTotal,
  money,
  nonNegativeMoney,
  optionalDecimal,
  positiveMoney,
  sum,
} from "../../common/utils/finance";
import {
  paginated,
  parsePagination,
  type PaginationQuery,
} from "../../common/utils/pagination";
import {
  arrayField,
  bodyObject,
  dateField,
  optionalDate,
  optionalString,
  stringField,
  type Payload,
} from "../../common/utils/payload";
import { CustomersService } from "../customers/customers.service";

type BillFilters = {
  periodMonth?: string;
  customerId?: string;
  status?: string;
} & PaginationQuery;

type BillWithDetails = Prisma.BillGetPayload<{
  include: ReturnType<BillingService["billInclude"]>;
}>;

type BillSummary = Prisma.BillGetPayload<{
  include: ReturnType<BillingService["billSummaryInclude"]>;
}>;

const cooperationModeOptions = new Set([
  "一口价投放",
  "代结算",
  "CPA",
  "CPS",
  "其他",
]);

@Injectable()
export class BillingService {
  constructor(
    private readonly audit: AuditService,
    private readonly customers: CustomersService,
    private readonly periodLocks: PeriodLockService,
    private readonly prisma: PrismaService,
  ) {}

  async generateMonthlyBills(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const periodMonth =
      optionalString(body, "periodMonth") ?? previousPeriodMonth();
    const { startsOn, endsOn } = parsePeriodMonth(periodMonth);
    await this.periodLocks.ensureOpen(user.orgId, periodMonth);

    const contracts = await this.prisma.contract.findMany({
      where: {
        orgId: user.orgId,
        status: ContractStatus.ACTIVE,
        startDate: { lte: endsOn },
        OR: [{ endDate: null }, { endDate: { gte: startsOn } }],
      },
      include: {
        chargeItems: {
          where: { isActive: true },
        },
        customer: true,
      },
    });

    const results: Array<{
      contractId: string;
      billId?: string;
      skipped?: boolean;
      error?: string;
    }> = [];

    for (const contract of contracts) {
      try {
        const existing = await this.prisma.bill.findUnique({
          where: {
            orgId_contractId_periodMonth: {
              orgId: user.orgId,
              contractId: contract.id,
              periodMonth,
            },
          },
        });

        if (existing) {
          results.push({
            contractId: contract.id,
            billId: existing.id,
            skipped: true,
          });
          continue;
        }

        const bill = await this.prisma.$transaction(async (tx) => {
          const extraCharges = await tx.extraCharge.findMany({
            where: {
              orgId: user.orgId,
              customerId: contract.customerId,
              periodMonth,
              status: ExtraChargeStatus.DRAFT,
              OR: [{ contractId: null }, { contractId: contract.id }],
            },
          });

          const contractItems = contract.chargeItems
            .filter((item) => this.itemActiveInPeriod(item, startsOn, endsOn))
            .map((item) => {
              const total = lineTotal(item.amount, item.quantity);
              return {
                contractChargeItemId: item.id,
                sourceType: ChargeSourceType.CONTRACT,
                name: item.name,
                description: item.description,
                amount: item.amount,
                quantity: item.quantity,
                lineTotal: total,
              };
            });

          const extraItems = extraCharges.map((charge) => ({
            extraChargeId: charge.id,
            sourceType: ChargeSourceType.EXTRA_CHARGE,
            name: charge.name,
            description: charge.description,
            amount: charge.amount,
            quantity: new Prisma.Decimal(1),
            lineTotal: charge.amount,
            occurredDate: charge.incurredDate,
          }));

          const items = [...contractItems, ...extraItems];
          const subtotal = sum(items.map((item) => item.lineTotal));

          const created = await tx.bill.create({
            data: {
              orgId: user.orgId,
              customerId: contract.customerId,
              contractId: contract.id,
              billNo: `BILL-${periodMonth}-${contract.code}`,
              periodMonth,
              subtotal,
              totalAmount: subtotal,
              dueDate: new Date(
                Date.UTC(
                  endsOn.getUTCFullYear(),
                  endsOn.getUTCMonth(),
                  endsOn.getUTCDate() + 15,
                ),
              ),
              items: { create: items },
              statusEvents: {
                create: {
                  toStatus: BillStatus.DRAFT,
                  note: "Generated from active contract.",
                  actorUserId: user.id,
                },
              },
            },
            include: this.billInclude(),
          });

          if (extraCharges.length) {
            await tx.extraCharge.updateMany({
              where: { id: { in: extraCharges.map((charge) => charge.id) } },
              data: { status: ExtraChargeStatus.BILLING_INCLUDED },
            });
          }

          await tx.auditLog.create({
            data: {
              orgId: user.orgId,
              actorUserId: user.id,
              action: "bill.generate",
              entityType: "bill",
              entityId: created.id,
              after: {
                billNo: created.billNo,
                periodMonth,
                totalAmount: created.totalAmount.toString(),
              },
            },
          });

          return created;
        });

        results.push({ contractId: contract.id, billId: bill.id });
      } catch (error) {
        results.push({
          contractId: contract.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      periodMonth,
      totalContracts: contracts.length,
      created: results.filter((result) => result.billId && !result.skipped)
        .length,
      skipped: results.filter((result) => result.skipped).length,
      failed: results.filter((result) => result.error).length,
      results,
    };
  }

  async list(user: AuthenticatedUser, filters: BillFilters) {
    const where: Prisma.BillWhereInput = {
      orgId: user.orgId,
      ...(filters.periodMonth ? { periodMonth: filters.periodMonth } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.status ? { status: filters.status as BillStatus } : {}),
    };

    if (!user.permissions.includes(PERMISSION_CODES.CUSTOMER_READ_ALL)) {
      where.customer = { owners: { some: { userId: user.id } } };
    }

    const pagination = parsePagination(filters);
    const [bills, total] = await this.prisma.$transaction([
      this.prisma.bill.findMany({
        where,
        include: this.billSummaryInclude(),
        orderBy: [{ periodMonth: "desc" }, { createdAt: "desc" }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.bill.count({ where }),
    ]);

    return paginated(
      bills.map((bill) => this.presentBillSummary(bill)),
      total,
      pagination,
    );
  }

  async get(user: AuthenticatedUser, id: string) {
    const bill = await this.prisma.bill.findFirst({
      where: { id, orgId: user.orgId },
      include: this.billInclude(),
    });

    if (!bill) {
      throw new NotFoundException("Bill not found.");
    }

    await this.customers.ensureCustomerAccess(user, bill.customerId);
    return this.presentBill(bill);
  }

  async createManualBill(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    if (
      optionalString(body, "billKind") === "RECEIVABLE" ||
      arrayField<Payload>(body, "settlements").length > 0
    ) {
      return this.createReceivableBill(user, body);
    }

    const customerId = stringField(body, "customerId");
    const periodMonth = stringField(body, "periodMonth");
    await this.customers.ensureCustomerAccess(user, customerId);
    await this.periodLocks.ensureOpen(user.orgId, periodMonth);
    const contractId = optionalString(body, "contractId");
    if (contractId) {
      const contract = await this.prisma.contract.findFirst({
        where: { id: contractId, orgId: user.orgId, customerId },
      });
      if (!contract) {
        throw new NotFoundException("Contract not found for customer.");
      }
    }

    const rawItems = arrayField<Payload>(body, "items");
    if (!rawItems.length) {
      throw new BadRequestException("items is required.");
    }

    const items = rawItems.map((item) => {
      const amount = money(item.amount);
      const quantity = optionalDecimal(item.quantity, new Prisma.Decimal(1));
      return {
        sourceType: (optionalString(item, "sourceType") ??
          (contractId
            ? ChargeSourceType.CONTRACT
            : ChargeSourceType.MANUAL)) as ChargeSourceType,
        name: stringField(item, "name"),
        description: optionalString(item, "description"),
        amount,
        quantity,
        lineTotal: lineTotal(amount, quantity),
        occurredDate: optionalDate(item, "occurredDate"),
      };
    });
    const subtotal = sum(items.map((item) => item.lineTotal));
    if (!subtotal.greaterThan(0)) {
      throw new BadRequestException(
        "Bill total amount must be greater than 0.",
      );
    }

    const bill = await this.prisma.bill.create({
      data: {
        orgId: user.orgId,
        customerId,
        contractId,
        billNo:
          optionalString(body, "billNo") ??
          `BILL-${periodMonth}-${Date.now().toString(36).toUpperCase()}`,
        periodMonth,
        dueDate: optionalDate(body, "dueDate"),
        subtotal,
        totalAmount: subtotal,
        items: { create: items },
        statusEvents: {
          create: {
            toStatus: BillStatus.DRAFT,
            note: "Created manually.",
            actorUserId: user.id,
          },
        },
      },
      include: this.billInclude(),
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "bill.create_manual",
      entityType: "bill",
      entityId: bill.id,
      after: { billNo: bill.billNo, totalAmount: bill.totalAmount.toString() },
    });

    return this.presentBill(bill);
  }

  private async createReceivableBill(user: AuthenticatedUser, body: Payload) {
    const customerId = stringField(body, "customerId");
    const contractId = stringField(body, "contractId");
    const periodMonth = stringField(body, "periodMonth");
    await this.customers.ensureCustomerAccess(user, customerId);
    await this.periodLocks.ensureOpen(user.orgId, periodMonth);

    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, orgId: user.orgId, customerId },
      select: {
        id: true,
        code: true,
        serviceFeeRate: true,
      },
    });
    if (!contract) {
      throw new NotFoundException("Contract not found for customer.");
    }

    const serviceFeeRate = new Prisma.Decimal(contract.serviceFeeRate ?? 0);
    const settlementInputs = arrayField<Payload>(body, "settlements");
    if (!settlementInputs.length) {
      return this.createFlatReceivableBill(user, {
        customerId,
        contractId,
        periodMonth,
        totalAmount: positiveMoney(body.totalAmount, "totalAmount"),
        dueDate: optionalDate(body, "dueDate"),
        billNo: optionalString(body, "billNo"),
      });
    }

    const settlements = settlementInputs.map((settlement, settlementIndex) => {
      const detailInputs =
        arrayField<Payload>(settlement, "details").length > 0
          ? arrayField<Payload>(settlement, "details")
          : arrayField<Payload>(settlement, "items");
      if (!detailInputs.length) {
        throw new BadRequestException(
          `settlements[${settlementIndex}].details is required.`,
        );
      }

      const items = detailInputs.map((detail, detailIndex) => {
        const cooperationFee = positiveMoney(
          detail.cooperationFee,
          "cooperationFee",
        );
        const serviceFee = cooperationFee
          .mul(serviceFeeRate)
          .div(100)
          .toDecimalPlaces(2);
        const totalFee = cooperationFee.plus(serviceFee).toDecimalPlaces(2);
        const cooperationModes = this.cooperationModes(detail, detailIndex);
        return {
          customerContactName: stringField(detail, "customerContactName"),
          projectName: stringField(detail, "projectName"),
          periodMonth: optionalString(detail, "periodMonth") ?? periodMonth,
          cooperationModes,
          otherModeNote: cooperationModes.includes("其他")
            ? stringField(detail, "otherModeNote")
            : optionalString(detail, "otherModeNote"),
          cooperationFee,
          serviceFee,
          totalFee,
        };
      });

      return {
        title:
          optionalString(settlement, "title") ??
          `子结算 ${settlementIndex + 1}`,
        sortOrder: settlementIndex,
        items,
      };
    });

    const totalAmount = sum(
      settlements.flatMap((settlement) =>
        settlement.items.map((item) => item.totalFee),
      ),
    );
    if (!totalAmount.greaterThan(0)) {
      throw new BadRequestException(
        "Bill total amount must be greater than 0.",
      );
    }

    const created = await this.prisma.$transaction(
      async (tx) =>
        tx.bill.create({
          data: {
            orgId: user.orgId,
            customerId,
            contractId,
            billNo:
              optionalString(body, "billNo") ??
              `AR-${periodMonth}-${Date.now().toString(36).toUpperCase()}`,
            periodMonth,
            status: BillStatus.PENDING_APPROVAL,
            approvalRequestedAt: new Date(),
            dueDate: optionalDate(body, "dueDate"),
            subtotal: totalAmount,
            totalAmount,
            items: {
              create: settlements.flatMap((settlement) =>
                settlement.items.map((item) => ({
                  sourceType: ChargeSourceType.MANUAL,
                  name: item.projectName,
                  description: [
                    `客户对接人：${item.customerContactName}`,
                    `合作模式：${item.cooperationModes.join("、")}`,
                    item.otherModeNote ? `其他备注：${item.otherModeNote}` : "",
                    `合作费用 ${item.cooperationFee.toFixed(2)}，服务费 ${item.serviceFee.toFixed(2)}`,
                  ]
                    .filter(Boolean)
                    .join("；"),
                  amount: item.totalFee,
                  quantity: new Prisma.Decimal(1),
                  lineTotal: item.totalFee,
                })),
              ),
            },
            settlements: {
              create: settlements.map((settlement) => ({
                title: settlement.title,
                sortOrder: settlement.sortOrder,
                items: {
                  create: settlement.items.map((item) => ({
                    customerContactName: item.customerContactName,
                    projectName: item.projectName,
                    periodMonth: item.periodMonth,
                    cooperationModes:
                      item.cooperationModes as Prisma.InputJsonValue,
                    otherModeNote: item.otherModeNote,
                    cooperationFee: item.cooperationFee,
                    serviceFee: item.serviceFee,
                    totalFee: item.totalFee,
                  })),
                },
              })),
            },
            statusEvents: {
              create: {
                toStatus: BillStatus.PENDING_APPROVAL,
                note: "Receivable bill submitted for owner approval.",
                actorUserId: user.id,
              },
            },
          },
          include: this.billInclude(),
        }),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "bill.receivable_create",
      entityType: "bill",
      entityId: created.id,
      after: {
        billNo: created.billNo,
        periodMonth,
        totalAmount: totalAmount.toString(),
        status: created.status,
      },
    });

    return this.presentBill(created);
  }

  private async createFlatReceivableBill(
    user: AuthenticatedUser,
    input: {
      customerId: string;
      contractId: string;
      periodMonth: string;
      totalAmount: Prisma.Decimal;
      dueDate?: Date;
      billNo?: string;
    },
  ) {
    const created = await this.prisma.$transaction(
      async (tx) =>
        tx.bill.create({
          data: {
            orgId: user.orgId,
            customerId: input.customerId,
            contractId: input.contractId,
            billNo:
              input.billNo ??
              `AR-${input.periodMonth}-${Date.now().toString(36).toUpperCase()}`,
            periodMonth: input.periodMonth,
            status: BillStatus.PENDING_APPROVAL,
            approvalRequestedAt: new Date(),
            dueDate: input.dueDate,
            subtotal: input.totalAmount,
            totalAmount: input.totalAmount,
            statusEvents: {
              create: {
                toStatus: BillStatus.PENDING_APPROVAL,
                note: "Receivable bill submitted for owner approval.",
                actorUserId: user.id,
              },
            },
          },
          include: this.billInclude(),
        }),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "bill.receivable_create",
      entityType: "bill",
      entityId: created.id,
      after: {
        billNo: created.billNo,
        periodMonth: input.periodMonth,
        totalAmount: input.totalAmount.toString(),
        status: created.status,
      },
    });

    return this.presentBill(created);
  }

  async transition(
    user: AuthenticatedUser,
    billId: string,
    toStatus: BillStatus,
    action: string,
  ) {
    const bill = await this.prisma.bill.findFirst({
      where: { id: billId, orgId: user.orgId },
    });

    if (!bill) {
      throw new NotFoundException("Bill not found.");
    }

    await this.customers.ensureCustomerAccess(user, bill.customerId);
    await this.periodLocks.ensureOpen(user.orgId, bill.periodMonth);
    this.ensureTransitionAllowed(bill.status, toStatus);

    const updated = await this.prisma.bill.update({
      where: { id: billId },
      data: {
        status: toStatus,
        statusEvents: {
          create: {
            fromStatus: bill.status,
            toStatus,
            actorUserId: user.id,
          },
        },
      },
      include: this.billInclude(),
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action,
      entityType: "bill",
      entityId: billId,
      before: { status: bill.status },
      after: { status: updated.status },
    });

    return this.presentBill(updated);
  }

  async confirmCustomer(
    user: AuthenticatedUser,
    billId: string,
    rawBody: unknown,
  ) {
    const body = bodyObject(rawBody);
    const bill = await this.prisma.bill.findFirst({
      where: { id: billId, orgId: user.orgId },
    });

    if (!bill) {
      throw new NotFoundException("Bill not found.");
    }

    await this.customers.ensureCustomerAccess(user, bill.customerId);
    await this.periodLocks.ensureOpen(user.orgId, bill.periodMonth);
    this.ensureTransitionAllowed(bill.status, BillStatus.CUSTOMER_CONFIRMED);

    const confirmedByName = stringField(body, "confirmedByName", user.name);
    const now = new Date();
    const updated = await this.prisma.bill.update({
      where: { id: billId },
      data: {
        status: BillStatus.CUSTOMER_CONFIRMED,
        confirmedAt: now,
        confirmedBy: confirmedByName,
        confirmationNote: optionalString(body, "note"),
        confirmations: {
          create: {
            confirmedByName,
            confirmedAt: now,
            note: optionalString(body, "note"),
            evidenceAttachmentId: optionalString(body, "evidenceAttachmentId"),
          },
        },
        statusEvents: {
          create: {
            fromStatus: bill.status,
            toStatus: BillStatus.CUSTOMER_CONFIRMED,
            note: optionalString(body, "note"),
            actorUserId: user.id,
          },
        },
      },
      include: this.billInclude(),
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "bill.customer_confirm",
      entityType: "bill",
      entityId: billId,
      before: { status: bill.status },
      after: { status: updated.status, confirmedBy: confirmedByName },
    });

    return this.presentBill(updated);
  }

  async approveReceivable(
    user: AuthenticatedUser,
    billId: string,
    rawBody: unknown = {},
  ) {
    const body = bodyObject(rawBody);
    const bill = await this.prisma.bill.findFirst({
      where: { id: billId, orgId: user.orgId },
    });
    if (!bill) {
      throw new NotFoundException("Bill not found.");
    }
    await this.customers.ensureCustomerAccess(user, bill.customerId);
    const uploadedAttachmentIds = this.attachmentIds(body, "attachmentIds");
    const evidenceAttachmentIds = uploadedAttachmentIds.length
      ? uploadedAttachmentIds
      : this.jsonStringArray(bill.evidenceAttachmentIds);
    if (!evidenceAttachmentIds.length) {
      throw new BadRequestException(
        "Evidence attachments are required before approval.",
      );
    }
    await this.ensureBillAttachments(
      this.prisma,
      user.orgId,
      billId,
      evidenceAttachmentIds,
      "evidenceAttachmentIds",
    );
    await this.periodLocks.ensureOpen(user.orgId, bill.periodMonth);
    this.ensureTransitionAllowed(bill.status, BillStatus.PENDING_SETTLEMENT);

    const updated = await this.prisma.bill.update({
      where: { id: billId },
      data: {
        status: BillStatus.PENDING_SETTLEMENT,
        evidenceAttachmentIds,
        approvedAt: new Date(),
        approvedById: user.id,
        statusEvents: {
          create: {
            fromStatus: bill.status,
            toStatus: BillStatus.PENDING_SETTLEMENT,
            note: "Owner approved receivable bill.",
            actorUserId: user.id,
          },
        },
      },
      include: this.billInclude(),
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "bill.receivable_approve",
      entityType: "bill",
      entityId: billId,
      before: { status: bill.status },
      after: { status: updated.status },
    });

    return this.presentBill(updated);
  }

  async updateEvidenceAttachments(
    user: AuthenticatedUser,
    billId: string,
    rawBody: unknown,
  ) {
    const body = bodyObject(rawBody);
    const evidenceAttachmentIds = this.attachmentIds(body, "attachmentIds");
    const updated = await this.prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findFirst({
        where: { id: billId, orgId: user.orgId },
      });
      if (!bill) {
        throw new NotFoundException("Bill not found.");
      }
      await this.customers.ensureCustomerAccess(user, bill.customerId);
      await this.periodLocks.ensureOpen(user.orgId, bill.periodMonth);
      if (bill.status !== BillStatus.PENDING_APPROVAL) {
        throw new ConflictException(
          "Evidence attachments can only be changed while pending approval.",
        );
      }
      await this.ensureBillAttachments(
        tx,
        user.orgId,
        billId,
        evidenceAttachmentIds,
        "attachmentIds",
      );

      return tx.bill.update({
        where: { id: billId },
        data: { evidenceAttachmentIds },
        include: this.billInclude(),
      });
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "bill.evidence_update",
      entityType: "bill",
      entityId: billId,
      after: { evidenceAttachmentIds },
    });

    return this.presentBill(updated);
  }

  async markInvoiced(
    user: AuthenticatedUser,
    billId: string,
    rawBody: unknown,
  ) {
    const body = bodyObject(rawBody);
    const invoiceAttachmentIds = this.attachmentIds(
      body,
      "invoiceAttachmentIds",
    );
    if (!invoiceAttachmentIds.length) {
      throw new BadRequestException("invoiceAttachmentIds is required.");
    }

    const updated = await this.prisma.$transaction(
      async (tx) => {
        const bill = await tx.bill.findFirst({
          where: { id: billId, orgId: user.orgId },
          include: {
            invoiceAllocations: { include: { invoice: true } },
          },
        });
        if (!bill) {
          throw new NotFoundException("Bill not found.");
        }
        await this.customers.ensureCustomerAccess(user, bill.customerId);
        await this.periodLocks.ensureOpen(user.orgId, bill.periodMonth);
        this.ensureTransitionAllowed(bill.status, BillStatus.INVOICED);
        await this.ensureBillAttachments(
          tx,
          user.orgId,
          billId,
          invoiceAttachmentIds,
          "invoiceAttachmentIds",
        );

        const invoiceAmount = sum(
          bill.invoiceAllocations
            .filter((allocation) => allocation.invoice.status !== "VOIDED")
            .map((allocation) => allocation.amount),
        );
        const amount = new Prisma.Decimal(bill.totalAmount).minus(
          invoiceAmount,
        );
        if (!amount.greaterThan(0)) {
          throw new ConflictException("Bill is already fully invoiced.");
        }

        await tx.invoice.create({
          data: {
            orgId: user.orgId,
            invoiceNo:
              optionalString(body, "invoiceNo") ??
              `INV-${bill.billNo}-${Date.now().toString(36).toUpperCase()}`,
            invoiceType: stringField(body, "invoiceType", "增值税普通发票"),
            status: InvoiceStatus.ISSUED,
            issueDate: optionalDate(body, "issueDate") ?? new Date(),
            amount,
            taxAmount:
              body.taxAmount === undefined
                ? new Prisma.Decimal(0)
                : nonNegativeMoney(body.taxAmount, "taxAmount"),
            remarks: optionalString(body, "remarks"),
            fileAttachmentId: invoiceAttachmentIds[0],
            allocations: {
              create: {
                billId,
                amount,
              },
            },
          },
        });

        return tx.bill.update({
          where: { id: billId },
          data: {
            status: BillStatus.INVOICED,
            invoiceAttachmentIds,
            statusEvents: {
              create: {
                fromStatus: bill.status,
                toStatus: BillStatus.INVOICED,
                note: "Invoice source file uploaded.",
                actorUserId: user.id,
              },
            },
          },
          include: this.billInclude(),
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "bill.receivable_invoiced",
      entityType: "bill",
      entityId: billId,
      after: { status: updated.status, invoiceAttachmentIds },
    });

    return this.presentBill(updated);
  }

  async markReceived(
    user: AuthenticatedUser,
    billId: string,
    rawBody: unknown,
  ) {
    const body = bodyObject(rawBody);
    const receiptAttachmentIds = this.attachmentIds(
      body,
      "receiptAttachmentIds",
    );
    if (!receiptAttachmentIds.length) {
      throw new BadRequestException("receiptAttachmentIds is required.");
    }

    const updated = await this.prisma.$transaction(
      async (tx) => {
        const bill = await tx.bill.findFirst({
          where: { id: billId, orgId: user.orgId },
          include: {
            receiptAllocations: { include: { receipt: true } },
          },
        });
        if (!bill) {
          throw new NotFoundException("Bill not found.");
        }
        await this.customers.ensureCustomerAccess(user, bill.customerId);
        await this.periodLocks.ensureOpen(user.orgId, bill.periodMonth);
        this.ensureTransitionAllowed(bill.status, BillStatus.RECEIVED);
        await this.ensureBillAttachments(
          tx,
          user.orgId,
          billId,
          receiptAttachmentIds,
          "receiptAttachmentIds",
        );

        const receiptAmount = sum(
          bill.receiptAllocations
            .filter((allocation) => allocation.receipt.status !== "REVERSED")
            .map((allocation) => allocation.amount),
        );
        const amount = new Prisma.Decimal(bill.totalAmount).minus(
          receiptAmount,
        );
        if (!amount.greaterThan(0)) {
          throw new ConflictException("Bill is already fully received.");
        }

        await tx.receipt.create({
          data: {
            orgId: user.orgId,
            receiptNo:
              optionalString(body, "receiptNo") ??
              `RCPT-${bill.billNo}-${Date.now().toString(36).toUpperCase()}`,
            receivedAt: optionalDate(body, "receivedAt") ?? new Date(),
            amount,
            account: stringField(body, "account", "默认收款账户"),
            payer: optionalString(body, "payer"),
            remarks: optionalString(body, "remarks"),
            attachmentId: receiptAttachmentIds[0],
            allocations: {
              create: {
                billId,
                amount,
              },
            },
          },
        });

        return tx.bill.update({
          where: { id: billId },
          data: {
            status: BillStatus.RECEIVED,
            receiptAttachmentIds,
            confirmedAt: new Date(),
            statusEvents: {
              create: {
                fromStatus: bill.status,
                toStatus: BillStatus.RECEIVED,
                note: "Bank receipt proof uploaded.",
                actorUserId: user.id,
              },
            },
          },
          include: this.billInclude(),
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "bill.receivable_received",
      entityType: "bill",
      entityId: billId,
      after: { status: updated.status, receiptAttachmentIds },
    });

    await this.periodLocks.autoCloseIfReady(
      user.orgId,
      updated.periodMonth,
      user.id,
    );

    return this.presentBill(updated);
  }

  async adjust(user: AuthenticatedUser, billId: string, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const bill = await this.prisma.bill.findFirst({
      where: { id: billId, orgId: user.orgId },
      include: { adjustments: true, items: true },
    });

    if (!bill) {
      throw new NotFoundException("Bill not found.");
    }

    await this.customers.ensureCustomerAccess(user, bill.customerId);
    await this.periodLocks.ensureOpen(user.orgId, bill.periodMonth);

    if (
      bill.status === BillStatus.VOIDED ||
      bill.status === BillStatus.CLOSED
    ) {
      throw new ConflictException("Closed or voided bills cannot be adjusted.");
    }

    if (
      bill.status !== BillStatus.CUSTOMER_CONFIRMED &&
      bill.status !== BillStatus.ADJUSTED
    ) {
      throw new ConflictException("Only confirmed bills can be adjusted.");
    }

    const amount = money(body.amount);
    const reason = stringField(body, "reason");

    const updated = await this.prisma.$transaction(
      async (tx) => {
        const adjustment = await tx.billAdjustment.create({
          data: {
            billId,
            amount,
            reason,
            createdById: user.id,
          },
        });

        await tx.billItem.create({
          data: {
            billId,
            adjustmentId: adjustment.id,
            sourceType: ChargeSourceType.ADJUSTMENT,
            name: stringField(body, "name", "账单调整"),
            description: reason,
            amount,
            quantity: new Prisma.Decimal(1),
            lineTotal: amount,
          },
        });

        const items = await tx.billItem.findMany({ where: { billId } });
        const subtotal = sum(
          items
            .filter((item) => item.sourceType !== ChargeSourceType.ADJUSTMENT)
            .map((item) => item.lineTotal),
        );
        const adjustmentTotal = sum(
          items
            .filter((item) => item.sourceType === ChargeSourceType.ADJUSTMENT)
            .map((item) => item.lineTotal),
        );

        const totalAmount = subtotal.plus(adjustmentTotal);
        if (totalAmount.lessThan(0)) {
          throw new BadRequestException(
            "Bill total amount cannot be negative.",
          );
        }

        return tx.bill.update({
          where: { id: billId },
          data: {
            status: BillStatus.ADJUSTED,
            subtotal,
            adjustmentTotal,
            totalAmount,
            statusEvents: {
              create: {
                fromStatus: bill.status,
                toStatus: BillStatus.ADJUSTED,
                note: reason,
                actorUserId: user.id,
              },
            },
          },
          include: this.billInclude(),
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "bill.adjust",
      entityType: "bill",
      entityId: billId,
      after: { amount: amount.toString(), reason },
    });

    return this.presentBill(updated);
  }

  private ensureTransitionAllowed(from: BillStatus, to: BillStatus) {
    const allowed: Record<BillStatus, BillStatus[]> = {
      DRAFT: [
        BillStatus.INTERNAL_REVIEW,
        BillStatus.CUSTOMER_PENDING,
        BillStatus.VOIDED,
      ],
      PENDING_APPROVAL: [BillStatus.PENDING_SETTLEMENT, BillStatus.VOIDED],
      PENDING_SETTLEMENT: [BillStatus.INVOICED, BillStatus.VOIDED],
      INVOICED: [BillStatus.RECEIVED],
      RECEIVED: [BillStatus.CLOSED],
      INTERNAL_REVIEW: [BillStatus.FINANCE_REVIEW, BillStatus.VOIDED],
      FINANCE_REVIEW: [BillStatus.CUSTOMER_PENDING, BillStatus.VOIDED],
      CUSTOMER_PENDING: [BillStatus.CUSTOMER_CONFIRMED, BillStatus.VOIDED],
      CUSTOMER_CONFIRMED: [BillStatus.ADJUSTED, BillStatus.CLOSED],
      ADJUSTED: [
        BillStatus.CUSTOMER_CONFIRMED,
        BillStatus.CLOSED,
        BillStatus.VOIDED,
      ],
      CLOSED: [],
      VOIDED: [],
    };

    if (!allowed[from].includes(to)) {
      throw new ConflictException(`Cannot change bill from ${from} to ${to}.`);
    }
  }

  private itemActiveInPeriod(
    item: { startsAt: Date | null; endsAt: Date | null },
    startsOn: Date,
    endsOn: Date,
  ) {
    return (
      (!item.startsAt || item.startsAt <= endsOn) &&
      (!item.endsAt || item.endsAt >= startsOn)
    );
  }

  private presentBill(bill: BillWithDetails) {
    const invoiceAmount = sum(
      bill.invoiceAllocations
        .filter((allocation) => allocation.invoice.status !== "VOIDED")
        .map((allocation) => allocation.amount),
    );
    const receiptAmount = sum(
      bill.receiptAllocations
        .filter((allocation) => allocation.receipt.status !== "REVERSED")
        .map((allocation) => allocation.amount),
    );
    const total = new Prisma.Decimal(bill.totalAmount);

    return {
      ...bill,
      totalAmount: decimalString(total),
      subtotal: decimalString(bill.subtotal),
      adjustmentTotal: decimalString(bill.adjustmentTotal),
      evidenceAttachmentIds: this.jsonStringArray(bill.evidenceAttachmentIds),
      invoiceAttachmentIds: this.jsonStringArray(bill.invoiceAttachmentIds),
      receiptAttachmentIds: this.jsonStringArray(bill.receiptAttachmentIds),
      items: bill.items.map((item) => ({
        ...item,
        amount: decimalString(item.amount),
        quantity: new Prisma.Decimal(item.quantity).toFixed(4),
        lineTotal: decimalString(item.lineTotal),
      })),
      settlements: bill.settlements.map((settlement) => ({
        ...settlement,
        items: settlement.items.map((item) => ({
          ...item,
          cooperationModes: this.jsonStringArray(item.cooperationModes),
          cooperationFee: decimalString(item.cooperationFee),
          serviceFee: decimalString(item.serviceFee),
          totalFee: decimalString(item.totalFee),
        })),
      })),
      invoiceAmount: decimalString(invoiceAmount),
      uninvoicedAmount: decimalString(total.minus(invoiceAmount)),
      receiptAmount: decimalString(receiptAmount),
      unreceivedAmount: decimalString(total.minus(receiptAmount)),
      invoiceState: invoiceAmount.isZero()
        ? "UNINVOICED"
        : invoiceAmount.greaterThanOrEqualTo(total)
          ? "FULLY_INVOICED"
          : "PARTIALLY_INVOICED",
      receiptState: receiptAmount.isZero()
        ? "UNRECEIVED"
        : receiptAmount.greaterThanOrEqualTo(total)
          ? "FULLY_RECEIVED"
          : "PARTIALLY_RECEIVED",
    };
  }

  private presentBillSummary(bill: BillSummary) {
    const invoiceAmount = sum(
      bill.invoiceAllocations
        .filter((allocation) => allocation.invoice.status !== "VOIDED")
        .map((allocation) => allocation.amount),
    );
    const receiptAmount = sum(
      bill.receiptAllocations
        .filter((allocation) => allocation.receipt.status !== "REVERSED")
        .map((allocation) => allocation.amount),
    );
    const total = new Prisma.Decimal(bill.totalAmount);

    return {
      ...bill,
      totalAmount: decimalString(total),
      subtotal: decimalString(bill.subtotal),
      adjustmentTotal: decimalString(bill.adjustmentTotal),
      evidenceAttachmentIds: this.jsonStringArray(bill.evidenceAttachmentIds),
      invoiceAttachmentIds: this.jsonStringArray(bill.invoiceAttachmentIds),
      receiptAttachmentIds: this.jsonStringArray(bill.receiptAttachmentIds),
      invoiceAmount: decimalString(invoiceAmount),
      uninvoicedAmount: decimalString(total.minus(invoiceAmount)),
      receiptAmount: decimalString(receiptAmount),
      unreceivedAmount: decimalString(total.minus(receiptAmount)),
      invoiceState: invoiceAmount.isZero()
        ? "UNINVOICED"
        : invoiceAmount.greaterThanOrEqualTo(total)
          ? "FULLY_INVOICED"
          : "PARTIALLY_INVOICED",
      receiptState: receiptAmount.isZero()
        ? "UNRECEIVED"
        : receiptAmount.greaterThanOrEqualTo(total)
          ? "FULLY_RECEIVED"
          : "PARTIALLY_RECEIVED",
    };
  }

  private billSummaryInclude() {
    return {
      customer: {
        select: { id: true, code: true, name: true, fullName: true },
      },
      contract: {
        select: {
          id: true,
          code: true,
          name: true,
          signingEntity: {
            select: {
              id: true,
              code: true,
              shortName: true,
              fullName: true,
              legalRepresentative: true,
              taxpayerType: true,
            },
          },
        },
      },
      invoiceAllocations: { include: { invoice: true } },
      receiptAllocations: { include: { receipt: true } },
    } satisfies Prisma.BillInclude;
  }

  private billInclude() {
    return {
      customer: {
        select: { id: true, code: true, name: true, fullName: true },
      },
      contract: {
        select: {
          id: true,
          code: true,
          name: true,
          signingEntity: {
            select: {
              id: true,
              code: true,
              shortName: true,
              fullName: true,
              legalRepresentative: true,
              taxpayerType: true,
            },
          },
        },
      },
      items: { orderBy: { createdAt: "asc" } },
      settlements: {
        orderBy: { sortOrder: "asc" },
        include: { items: { orderBy: { createdAt: "asc" } } },
      },
      confirmations: { orderBy: { confirmedAt: "desc" } },
      adjustments: { orderBy: { createdAt: "desc" } },
      statusEvents: { orderBy: { createdAt: "asc" } },
      invoiceAllocations: { include: { invoice: true } },
      receiptAllocations: { include: { receipt: true } },
    } satisfies Prisma.BillInclude;
  }

  private cooperationModes(detail: Payload, detailIndex: number) {
    const modes = Array.from(
      new Set(
        arrayField<unknown>(detail, "cooperationModes")
          .map((mode) => (typeof mode === "string" ? mode.trim() : ""))
          .filter(Boolean),
      ),
    );
    if (!modes.length) {
      throw new BadRequestException(
        `settlement detail ${detailIndex + 1} cooperationModes is required.`,
      );
    }
    const invalid = modes.find((mode) => !cooperationModeOptions.has(mode));
    if (invalid) {
      throw new BadRequestException(`Invalid cooperation mode: ${invalid}.`);
    }
    if (modes.includes("其他") && !optionalString(detail, "otherModeNote")) {
      throw new BadRequestException("otherModeNote is required.");
    }
    return modes;
  }

  private attachmentIds(body: Payload, field = "attachmentIds") {
    return Array.from(
      new Set(
        arrayField<unknown>(body, field)
          .map((id) => (typeof id === "string" ? id.trim() : ""))
          .filter(Boolean),
      ),
    );
  }

  private async ensureBillAttachments(
    client: Pick<Prisma.TransactionClient, "attachment">,
    orgId: string,
    billId: string,
    attachmentIds: string[],
    fieldName: string,
  ) {
    if (!attachmentIds.length) {
      throw new BadRequestException(`${fieldName} is required.`);
    }

    const attachments = await client.attachment.findMany({
      where: { orgId, id: { in: attachmentIds } },
      select: { id: true, ownerType: true, ownerId: true },
    });
    const validIds = new Set(
      attachments
        .filter(
          (attachment) =>
            attachment.ownerType === "bill" && attachment.ownerId === billId,
        )
        .map((attachment) => attachment.id),
    );

    if (validIds.size !== attachmentIds.length) {
      throw new BadRequestException(
        `${fieldName} must be uploaded to this bill.`,
      );
    }
  }

  private jsonStringArray(value: unknown) {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  }
}
