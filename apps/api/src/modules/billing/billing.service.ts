import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  BillStatus,
  ChargeSourceType,
  ContractStatus,
  ExtraChargeStatus,
  Prisma
} from "@prisma/client";

import {
  PERMISSION_CODES,
  type AuthenticatedUser
} from "@erpdog/contracts";

import { AuditService } from "../../common/audit/audit.service";
import {
  parsePeriodMonth,
  PeriodLockService,
  previousPeriodMonth
} from "../../common/periods/period-lock.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  decimal,
  decimalString,
  lineTotal,
  optionalDecimal,
  sum
} from "../../common/utils/finance";
import {
  arrayField,
  bodyObject,
  dateField,
  optionalDate,
  optionalString,
  stringField,
  type Payload
} from "../../common/utils/payload";
import { CustomersService } from "../customers/customers.service";

type BillFilters = {
  periodMonth?: string;
  customerId?: string;
  status?: string;
};

type BillWithDetails = Prisma.BillGetPayload<{
  include: ReturnType<BillingService["billInclude"]>;
}>;

@Injectable()
export class BillingService {
  constructor(
    private readonly audit: AuditService,
    private readonly customers: CustomersService,
    private readonly periodLocks: PeriodLockService,
    private readonly prisma: PrismaService
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
        OR: [{ endDate: null }, { endDate: { gte: startsOn } }]
      },
      include: {
        chargeItems: {
          where: { isActive: true }
        },
        customer: true
      }
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
              periodMonth
            }
          }
        });

        if (existing) {
          results.push({ contractId: contract.id, billId: existing.id, skipped: true });
          continue;
        }

        const bill = await this.prisma.$transaction(async (tx) => {
          const extraCharges = await tx.extraCharge.findMany({
            where: {
              orgId: user.orgId,
              customerId: contract.customerId,
              periodMonth,
              status: ExtraChargeStatus.DRAFT,
              OR: [{ contractId: null }, { contractId: contract.id }]
            }
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
                lineTotal: total
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
            occurredDate: charge.incurredDate
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
              dueDate: new Date(Date.UTC(endsOn.getUTCFullYear(), endsOn.getUTCMonth(), endsOn.getUTCDate() + 15)),
              items: { create: items },
              statusEvents: {
                create: {
                  toStatus: BillStatus.DRAFT,
                  note: "Generated from active contract.",
                  actorUserId: user.id
                }
              }
            },
            include: this.billInclude()
          });

          if (extraCharges.length) {
            await tx.extraCharge.updateMany({
              where: { id: { in: extraCharges.map((charge) => charge.id) } },
              data: { status: ExtraChargeStatus.BILLING_INCLUDED }
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
                totalAmount: created.totalAmount.toString()
              }
            }
          });

          return created;
        });

        results.push({ contractId: contract.id, billId: bill.id });
      } catch (error) {
        results.push({
          contractId: contract.id,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    return {
      periodMonth,
      totalContracts: contracts.length,
      created: results.filter((result) => result.billId && !result.skipped).length,
      skipped: results.filter((result) => result.skipped).length,
      failed: results.filter((result) => result.error).length,
      results
    };
  }

  async list(user: AuthenticatedUser, filters: BillFilters) {
    const where: Prisma.BillWhereInput = {
      orgId: user.orgId,
      ...(filters.periodMonth ? { periodMonth: filters.periodMonth } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.status ? { status: filters.status as BillStatus } : {})
    };

    if (!user.permissions.includes(PERMISSION_CODES.CUSTOMER_READ_ALL)) {
      where.customer = { owners: { some: { userId: user.id } } };
    }

    const bills = await this.prisma.bill.findMany({
      where,
      include: this.billInclude(),
      orderBy: [{ periodMonth: "desc" }, { createdAt: "desc" }]
    });

    return bills.map((bill) => this.presentBill(bill));
  }

  async get(user: AuthenticatedUser, id: string) {
    const bill = await this.prisma.bill.findFirst({
      where: { id, orgId: user.orgId },
      include: this.billInclude()
    });

    if (!bill) {
      throw new NotFoundException("Bill not found.");
    }

    await this.customers.ensureCustomerAccess(user, bill.customerId);
    return this.presentBill(bill);
  }

  async createManualBill(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const customerId = stringField(body, "customerId");
    const periodMonth = stringField(body, "periodMonth");
    await this.customers.ensureCustomerAccess(user, customerId);
    await this.periodLocks.ensureOpen(user.orgId, periodMonth);

    const rawItems = arrayField<Payload>(body, "items");
    if (!rawItems.length) {
      throw new BadRequestException("items is required.");
    }

    const items = rawItems.map((item) => {
      const amount = decimal(item.amount);
      const quantity = optionalDecimal(item.quantity, new Prisma.Decimal(1));
      return {
        sourceType: (optionalString(item, "sourceType") ??
          ChargeSourceType.MANUAL) as ChargeSourceType,
        name: stringField(item, "name"),
        description: optionalString(item, "description"),
        amount,
        quantity,
        lineTotal: lineTotal(amount, quantity),
        occurredDate: optionalDate(item, "occurredDate")
      };
    });
    const subtotal = sum(items.map((item) => item.lineTotal));

    const bill = await this.prisma.bill.create({
      data: {
        orgId: user.orgId,
        customerId,
        contractId: optionalString(body, "contractId"),
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
            actorUserId: user.id
          }
        }
      },
      include: this.billInclude()
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "bill.create_manual",
      entityType: "bill",
      entityId: bill.id,
      after: { billNo: bill.billNo, totalAmount: bill.totalAmount.toString() }
    });

    return this.presentBill(bill);
  }

  async transition(
    user: AuthenticatedUser,
    billId: string,
    toStatus: BillStatus,
    action: string
  ) {
    const bill = await this.prisma.bill.findFirst({
      where: { id: billId, orgId: user.orgId }
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
            actorUserId: user.id
          }
        }
      },
      include: this.billInclude()
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action,
      entityType: "bill",
      entityId: billId,
      before: { status: bill.status },
      after: { status: updated.status }
    });

    return this.presentBill(updated);
  }

  async confirmCustomer(
    user: AuthenticatedUser,
    billId: string,
    rawBody: unknown
  ) {
    const body = bodyObject(rawBody);
    const bill = await this.prisma.bill.findFirst({
      where: { id: billId, orgId: user.orgId }
    });

    if (!bill) {
      throw new NotFoundException("Bill not found.");
    }

    await this.customers.ensureCustomerAccess(user, bill.customerId);
    await this.periodLocks.ensureOpen(user.orgId, bill.periodMonth);

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
            evidenceAttachmentId: optionalString(body, "evidenceAttachmentId")
          }
        },
        statusEvents: {
          create: {
            fromStatus: bill.status,
            toStatus: BillStatus.CUSTOMER_CONFIRMED,
            note: optionalString(body, "note"),
            actorUserId: user.id
          }
        }
      },
      include: this.billInclude()
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "bill.customer_confirm",
      entityType: "bill",
      entityId: billId,
      before: { status: bill.status },
      after: { status: updated.status, confirmedBy: confirmedByName }
    });

    return this.presentBill(updated);
  }

  async adjust(user: AuthenticatedUser, billId: string, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const bill = await this.prisma.bill.findFirst({
      where: { id: billId, orgId: user.orgId },
      include: { adjustments: true, items: true }
    });

    if (!bill) {
      throw new NotFoundException("Bill not found.");
    }

    await this.customers.ensureCustomerAccess(user, bill.customerId);
    await this.periodLocks.ensureOpen(user.orgId, bill.periodMonth);

    if (bill.status === BillStatus.VOIDED || bill.status === BillStatus.CLOSED) {
      throw new ConflictException("Closed or voided bills cannot be adjusted.");
    }

    const amount = decimal(body.amount);
    const reason = stringField(body, "reason");

    const updated = await this.prisma.$transaction(async (tx) => {
      const adjustment = await tx.billAdjustment.create({
        data: {
          billId,
          amount,
          reason,
          createdById: user.id
        }
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
          lineTotal: amount
        }
      });

      const items = await tx.billItem.findMany({ where: { billId } });
      const subtotal = sum(
        items
          .filter((item) => item.sourceType !== ChargeSourceType.ADJUSTMENT)
          .map((item) => item.lineTotal)
      );
      const adjustmentTotal = sum(
        items
          .filter((item) => item.sourceType === ChargeSourceType.ADJUSTMENT)
          .map((item) => item.lineTotal)
      );

      return tx.bill.update({
        where: { id: billId },
        data: {
          status: BillStatus.ADJUSTED,
          subtotal,
          adjustmentTotal,
          totalAmount: subtotal.plus(adjustmentTotal),
          statusEvents: {
            create: {
              fromStatus: bill.status,
              toStatus: BillStatus.ADJUSTED,
              note: reason,
              actorUserId: user.id
            }
          }
        },
        include: this.billInclude()
      });
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "bill.adjust",
      entityType: "bill",
      entityId: billId,
      after: { amount: amount.toString(), reason }
    });

    return this.presentBill(updated);
  }

  private ensureTransitionAllowed(from: BillStatus, to: BillStatus) {
    const allowed: Record<BillStatus, BillStatus[]> = {
      DRAFT: [BillStatus.INTERNAL_REVIEW, BillStatus.VOIDED],
      INTERNAL_REVIEW: [BillStatus.FINANCE_REVIEW, BillStatus.VOIDED],
      FINANCE_REVIEW: [BillStatus.CUSTOMER_PENDING, BillStatus.VOIDED],
      CUSTOMER_PENDING: [BillStatus.CUSTOMER_CONFIRMED, BillStatus.VOIDED],
      CUSTOMER_CONFIRMED: [BillStatus.ADJUSTED, BillStatus.CLOSED],
      ADJUSTED: [BillStatus.CUSTOMER_CONFIRMED, BillStatus.CLOSED, BillStatus.VOIDED],
      CLOSED: [],
      VOIDED: []
    };

    if (!allowed[from].includes(to)) {
      throw new ConflictException(`Cannot change bill from ${from} to ${to}.`);
    }
  }

  private itemActiveInPeriod(
    item: { startsAt: Date | null; endsAt: Date | null },
    startsOn: Date,
    endsOn: Date
  ) {
    return (!item.startsAt || item.startsAt <= endsOn) && (!item.endsAt || item.endsAt >= startsOn);
  }

  private presentBill(bill: BillWithDetails) {
    const invoiceAmount = sum(
      bill.invoiceAllocations
        .filter((allocation) => allocation.invoice.status !== "VOIDED")
        .map((allocation) => allocation.amount)
    );
    const receiptAmount = sum(
      bill.receiptAllocations
        .filter((allocation) => allocation.receipt.status !== "REVERSED")
        .map((allocation) => allocation.amount)
    );
    const total = new Prisma.Decimal(bill.totalAmount);

    return {
      ...bill,
      totalAmount: decimalString(total),
      subtotal: decimalString(bill.subtotal),
      adjustmentTotal: decimalString(bill.adjustmentTotal),
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
          : "PARTIALLY_RECEIVED"
    };
  }

  private billInclude() {
    return {
      customer: { select: { id: true, code: true, name: true } },
      contract: { select: { id: true, code: true, name: true } },
      items: { orderBy: { createdAt: "asc" } },
      confirmations: { orderBy: { confirmedAt: "desc" } },
      adjustments: { orderBy: { createdAt: "desc" } },
      statusEvents: { orderBy: { createdAt: "asc" } },
      invoiceAllocations: { include: { invoice: true } },
      receiptAllocations: { include: { receipt: true } }
    } satisfies Prisma.BillInclude;
  }
}
