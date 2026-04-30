import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  ExtraChargeKind,
  ExtraChargeStatus,
  InvoiceStatus,
  PayableStatus,
  PaymentRequestStatus,
  PaymentStatus,
  PeriodClosingStatus,
  Prisma,
  ReceiptStatus
} from "@prisma/client";

import {
  PERMISSION_CODES,
  type AuthenticatedUser
} from "@erpdog/contracts";

import { AuditService } from "../../common/audit/audit.service";
import {
  parsePeriodMonth,
  PeriodLockService
} from "../../common/periods/period-lock.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { decimal, decimalString, optionalDecimal, sum } from "../../common/utils/finance";
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

type PeriodCustomerFilters = {
  periodMonth?: string;
  customerId?: string;
};

@Injectable()
export class FinanceService {
  constructor(
    private readonly audit: AuditService,
    private readonly customers: CustomersService,
    private readonly periodLocks: PeriodLockService,
    private readonly prisma: PrismaService
  ) {}

  listExtraChargeCategories(user: AuthenticatedUser) {
    return this.prisma.extraChargeCategory.findMany({
      where: { orgId: user.orgId, isActive: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async createExtraChargeCategory(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const category = await this.prisma.extraChargeCategory.create({
      data: {
        orgId: user.orgId,
        code: stringField(body, "code"),
        name: stringField(body, "name"),
        kind: this.extraChargeKind(body)
      }
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "extra_charge_category.create",
      entityType: "extra_charge_category",
      entityId: category.id,
      after: { code: category.code, name: category.name }
    });

    return category;
  }

  async listExtraCharges(
    user: AuthenticatedUser,
    filters: PeriodCustomerFilters
  ) {
    const where: Prisma.ExtraChargeWhereInput = {
      orgId: user.orgId,
      ...(filters.periodMonth ? { periodMonth: filters.periodMonth } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {})
    };

    if (!user.permissions.includes(PERMISSION_CODES.CUSTOMER_READ_ALL)) {
      where.customer = { owners: { some: { userId: user.id } } };
    }

    return this.prisma.extraCharge.findMany({
      where,
      include: { customer: true, contract: true, category: true },
      orderBy: { incurredDate: "desc" }
    });
  }

  async createExtraCharge(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const customerId = stringField(body, "customerId");
    const periodMonth = stringField(body, "periodMonth");
    await this.customers.ensureCustomerAccess(user, customerId);
    await this.periodLocks.ensureOpen(user.orgId, periodMonth);

    const charge = await this.prisma.extraCharge.create({
      data: {
        orgId: user.orgId,
        customerId,
        contractId: optionalString(body, "contractId"),
        categoryId: optionalString(body, "categoryId"),
        kind: this.extraChargeKind(body),
        name: stringField(body, "name"),
        amount: decimal(body.amount),
        incurredDate: dateField(body, "incurredDate"),
        periodMonth,
        description: optionalString(body, "description"),
        createdById: user.id
      }
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "extra_charge.create",
      entityType: "extra_charge",
      entityId: charge.id,
      after: { name: charge.name, amount: charge.amount.toString() }
    });

    return charge;
  }

  listInvoices(user: AuthenticatedUser) {
    return this.prisma.invoice.findMany({
      where: { orgId: user.orgId },
      include: { allocations: { include: { bill: true } } },
      orderBy: { issueDate: "desc" }
    });
  }

  async createInvoice(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const allocations = arrayField<Payload>(body, "allocations");
    if (!allocations.length) {
      throw new BadRequestException("allocations is required.");
    }

    const invoiceAmount = decimal(body.amount);
    const allocationTotal = sum(
      allocations.map((allocation) => decimal(allocation.amount))
    );

    if (allocationTotal.greaterThan(invoiceAmount)) {
      throw new BadRequestException("Invoice allocations exceed invoice amount.");
    }

    const invoice = await this.prisma.$transaction(async (tx) => {
      for (const allocation of allocations) {
        await this.ensureBillAllocationFits(
          tx,
          user,
          stringField(allocation, "billId"),
          decimal(allocation.amount),
          "invoice"
        );
      }

      return tx.invoice.create({
        data: {
          orgId: user.orgId,
          invoiceNo: stringField(body, "invoiceNo"),
          invoiceType: stringField(body, "invoiceType", "增值税普通发票"),
          status: InvoiceStatus.ISSUED,
          issueDate: dateField(body, "issueDate"),
          amount: invoiceAmount,
          taxAmount: optionalDecimal(body.taxAmount, new Prisma.Decimal(0)),
          remarks: optionalString(body, "remarks"),
          fileAttachmentId: optionalString(body, "fileAttachmentId"),
          allocations: {
            create: allocations.map((allocation) => ({
              billId: stringField(allocation, "billId"),
              amount: decimal(allocation.amount)
            }))
          }
        },
        include: { allocations: true }
      });
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "invoice.create",
      entityType: "invoice",
      entityId: invoice.id,
      after: { invoiceNo: invoice.invoiceNo, amount: invoice.amount.toString() }
    });

    return invoice;
  }

  async voidInvoice(user: AuthenticatedUser, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, orgId: user.orgId }
    });
    if (!invoice) {
      throw new NotFoundException("Invoice not found.");
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.VOIDED }
    });
    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "invoice.void",
      entityType: "invoice",
      entityId: id,
      before: { status: invoice.status },
      after: { status: updated.status }
    });
    return updated;
  }

  listReceipts(user: AuthenticatedUser) {
    return this.prisma.receipt.findMany({
      where: { orgId: user.orgId },
      include: { allocations: { include: { bill: true } } },
      orderBy: { receivedAt: "desc" }
    });
  }

  async createReceipt(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const allocations = arrayField<Payload>(body, "allocations");
    if (!allocations.length) {
      throw new BadRequestException("allocations is required.");
    }

    const receiptAmount = decimal(body.amount);
    const allocationTotal = sum(
      allocations.map((allocation) => decimal(allocation.amount))
    );

    if (allocationTotal.greaterThan(receiptAmount)) {
      throw new BadRequestException("Receipt allocations exceed receipt amount.");
    }

    const receipt = await this.prisma.$transaction(async (tx) => {
      for (const allocation of allocations) {
        await this.ensureBillAllocationFits(
          tx,
          user,
          stringField(allocation, "billId"),
          decimal(allocation.amount),
          "receipt"
        );
      }

      return tx.receipt.create({
        data: {
          orgId: user.orgId,
          receiptNo: optionalString(body, "receiptNo"),
          receivedAt: dateField(body, "receivedAt"),
          amount: receiptAmount,
          account: stringField(body, "account"),
          payer: optionalString(body, "payer"),
          remarks: optionalString(body, "remarks"),
          attachmentId: optionalString(body, "attachmentId"),
          allocations: {
            create: allocations.map((allocation) => ({
              billId: stringField(allocation, "billId"),
              amount: decimal(allocation.amount)
            }))
          }
        },
        include: { allocations: true }
      });
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "receipt.create",
      entityType: "receipt",
      entityId: receipt.id,
      after: { amount: receipt.amount.toString() }
    });

    return receipt;
  }

  async reverseReceipt(user: AuthenticatedUser, id: string) {
    const receipt = await this.prisma.receipt.findFirst({
      where: { id, orgId: user.orgId }
    });
    if (!receipt) {
      throw new NotFoundException("Receipt not found.");
    }
    const updated = await this.prisma.receipt.update({
      where: { id },
      data: { status: ReceiptStatus.REVERSED }
    });
    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "receipt.reverse",
      entityType: "receipt",
      entityId: id,
      before: { status: receipt.status },
      after: { status: updated.status }
    });
    return updated;
  }

  listCostCategories(user: AuthenticatedUser) {
    return this.prisma.costCategory.findMany({
      where: { orgId: user.orgId, isActive: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async createCostCategory(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const category = await this.prisma.costCategory.create({
      data: {
        orgId: user.orgId,
        code: stringField(body, "code"),
        name: stringField(body, "name")
      }
    });
    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "cost_category.create",
      entityType: "cost_category",
      entityId: category.id,
      after: { code: category.code, name: category.name }
    });
    return category;
  }

  async listCostEntries(
    user: AuthenticatedUser,
    filters: PeriodCustomerFilters
  ) {
    const where: Prisma.CostEntryWhereInput = {
      orgId: user.orgId,
      ...(filters.periodMonth ? { periodMonth: filters.periodMonth } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {})
    };

    if (!user.permissions.includes(PERMISSION_CODES.CUSTOMER_READ_ALL)) {
      where.customer = { owners: { some: { userId: user.id } } };
    }

    return this.prisma.costEntry.findMany({
      where,
      include: { customer: true, category: true, payables: true },
      orderBy: { incurredDate: "desc" }
    });
  }

  async createCostEntry(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const customerId = stringField(body, "customerId");
    const periodMonth = stringField(body, "periodMonth");
    await this.customers.ensureCustomerAccess(user, customerId);
    await this.periodLocks.ensureOpen(user.orgId, periodMonth);

    const amount = decimal(body.amount);
    const createPayable = body.createPayable === true;

    const entry = await this.prisma.$transaction(async (tx) => {
      const cost = await tx.costEntry.create({
        data: {
          orgId: user.orgId,
          customerId,
          periodMonth,
          categoryId: optionalString(body, "categoryId"),
          amount,
          incurredDate: dateField(body, "incurredDate"),
          handlerUserId: optionalString(body, "handlerUserId") ?? user.id,
          description: optionalString(body, "description"),
          attachmentId: optionalString(body, "attachmentId"),
          payableCreated: createPayable
        }
      });

      if (createPayable) {
        await tx.payable.create({
          data: {
            orgId: user.orgId,
            customerId,
            costEntryId: cost.id,
            categoryId: optionalString(body, "categoryId"),
            vendorName: stringField(body, "vendorName", "未命名供应商"),
            periodMonth,
            amount,
            dueDate: optionalDate(body, "dueDate"),
            remarks: optionalString(body, "description")
          }
        });
      }

      return tx.costEntry.findUniqueOrThrow({
        where: { id: cost.id },
        include: { payables: true, category: true, customer: true }
      });
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "cost_entry.create",
      entityType: "cost_entry",
      entityId: entry.id,
      after: { amount: entry.amount.toString(), customerId }
    });

    return entry;
  }

  listPayables(user: AuthenticatedUser) {
    return this.prisma.payable.findMany({
      where: { orgId: user.orgId },
      include: { customer: true, category: true, paymentAllocations: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async createPayable(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const customerId = optionalString(body, "customerId");
    const periodMonth = optionalString(body, "periodMonth");
    if (customerId) {
      await this.customers.ensureCustomerAccess(user, customerId);
    }
    if (periodMonth) {
      await this.periodLocks.ensureOpen(user.orgId, periodMonth);
    }

    const payable = await this.prisma.payable.create({
      data: {
        orgId: user.orgId,
        customerId,
        categoryId: optionalString(body, "categoryId"),
        vendorName: stringField(body, "vendorName"),
        periodMonth,
        amount: decimal(body.amount),
        dueDate: optionalDate(body, "dueDate"),
        remarks: optionalString(body, "remarks")
      }
    });
    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "payable.create",
      entityType: "payable",
      entityId: payable.id,
      after: { amount: payable.amount.toString(), vendorName: payable.vendorName }
    });
    return payable;
  }

  listPaymentRequests(user: AuthenticatedUser) {
    return this.prisma.paymentRequest.findMany({
      where: { orgId: user.orgId },
      include: { items: { include: { payable: true } }, approvals: true, payments: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async createPaymentRequest(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const items = arrayField<Payload>(body, "items");
    const requestedAmount = body.requestedAmount
      ? decimal(body.requestedAmount)
      : sum(items.map((item) => decimal(item.amount)));

    const request = await this.prisma.paymentRequest.create({
      data: {
        orgId: user.orgId,
        requestNo:
          optionalString(body, "requestNo") ??
          `PAYREQ-${Date.now().toString(36).toUpperCase()}`,
        status:
          body.autoSubmit === false
            ? PaymentRequestStatus.DRAFT
            : PaymentRequestStatus.SUBMITTED,
        applicantUserId: user.id,
        supplierName: stringField(body, "supplierName"),
        customerId: optionalString(body, "customerId"),
        periodMonth: optionalString(body, "periodMonth"),
        categoryId: optionalString(body, "categoryId"),
        payableId: optionalString(body, "payableId"),
        totalAmount: requestedAmount,
        requestedAmount,
        accountInfo: (body.accountInfo ?? {}) as Prisma.InputJsonValue,
        reason: optionalString(body, "reason"),
        expectedPaymentDate: optionalDate(body, "expectedPaymentDate"),
        submittedAt: body.autoSubmit === false ? undefined : new Date(),
        items: {
          create: items.map((item) => ({
            payableId: optionalString(item, "payableId"),
            customerId: optionalString(item, "customerId"),
            periodMonth: optionalString(item, "periodMonth"),
            categoryId: optionalString(item, "categoryId"),
            amount: decimal(item.amount),
            description: optionalString(item, "description")
          }))
        }
      },
      include: { items: true, approvals: true }
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "payment_request.create",
      entityType: "payment_request",
      entityId: request.id,
      after: { requestNo: request.requestNo, amount: request.requestedAmount.toString() }
    });

    return request;
  }

  submitPaymentRequest(user: AuthenticatedUser, id: string) {
    return this.decidePaymentRequest(user, id, PaymentRequestStatus.SUBMITTED, "submit");
  }

  approvePaymentRequest(user: AuthenticatedUser, id: string, rawBody: unknown) {
    const body = bodyObject(rawBody);
    return this.decidePaymentRequest(
      user,
      id,
      PaymentRequestStatus.APPROVED,
      "approve",
      optionalString(body, "note")
    );
  }

  rejectPaymentRequest(user: AuthenticatedUser, id: string, rawBody: unknown) {
    const body = bodyObject(rawBody);
    return this.decidePaymentRequest(
      user,
      id,
      PaymentRequestStatus.REJECTED,
      "reject",
      stringField(body, "reason")
    );
  }

  listPayments(user: AuthenticatedUser) {
    return this.prisma.payment.findMany({
      where: { orgId: user.orgId },
      include: { request: true, allocations: { include: { payable: true } } },
      orderBy: { paidAt: "desc" }
    });
  }

  async createPayment(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const requestId = optionalString(body, "requestId");
    const allocations = arrayField<Payload>(body, "allocations");
    const amount = decimal(body.amount);

    const payment = await this.prisma.$transaction(async (tx) => {
      if (requestId) {
        const request = await tx.paymentRequest.findFirst({
          where: { id: requestId, orgId: user.orgId }
        });
        if (!request) {
          throw new NotFoundException("Payment request not found.");
        }
        if (
          request.status !== PaymentRequestStatus.APPROVED &&
          request.status !== PaymentRequestStatus.PARTIALLY_PAID
        ) {
          throw new ConflictException("Payment request must be approved first.");
        }
      }

      const created = await tx.payment.create({
        data: {
          orgId: user.orgId,
          paymentNo:
            optionalString(body, "paymentNo") ??
            `PAY-${Date.now().toString(36).toUpperCase()}`,
          requestId,
          paidAt: dateField(body, "paidAt"),
          amount,
          account: stringField(body, "account"),
          payeeName: stringField(body, "payeeName"),
          remarks: optionalString(body, "remarks"),
          attachmentId: optionalString(body, "attachmentId"),
          allocations: {
            create: allocations.map((allocation) => ({
              payableId: optionalString(allocation, "payableId"),
              amount: decimal(allocation.amount)
            }))
          }
        },
        include: { allocations: true }
      });

      for (const allocation of allocations) {
        const payableId = optionalString(allocation, "payableId");
        if (payableId) {
          await this.applyPayablePayment(tx, payableId, decimal(allocation.amount));
        }
      }

      if (requestId) {
        await this.refreshPaymentRequestStatus(tx, requestId);
      }

      return created;
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "payment.create",
      entityType: "payment",
      entityId: payment.id,
      after: { amount: payment.amount.toString(), paymentNo: payment.paymentNo }
    });

    return payment;
  }

  async closePeriod(user: AuthenticatedUser, periodMonth: string, rawBody: unknown) {
    const body = bodyObject(rawBody);
    parsePeriodMonth(periodMonth);
    const openBills = await this.prisma.bill.count({
      where: {
        orgId: user.orgId,
        periodMonth,
        status: { in: ["DRAFT", "INTERNAL_REVIEW", "FINANCE_REVIEW", "CUSTOMER_PENDING"] }
      }
    });
    if (openBills > 0) {
      throw new ConflictException("There are unconfirmed bills in this period.");
    }

    const snapshot = await this.periodSnapshot(user.orgId, periodMonth);
    const period = await this.prisma.$transaction(async (tx) => {
      const ensured = await tx.billingPeriod.upsert({
        where: { orgId_periodMonth: { orgId: user.orgId, periodMonth } },
        update: {
          status: PeriodClosingStatus.CLOSED,
          closedAt: new Date(),
          reason: optionalString(body, "reason")
        },
        create: {
          orgId: user.orgId,
          periodMonth,
          ...parsePeriodMonth(periodMonth),
          status: PeriodClosingStatus.CLOSED,
          closedAt: new Date(),
          reason: optionalString(body, "reason")
        }
      });

      await tx.periodClosing.create({
        data: {
          orgId: user.orgId,
          periodMonth,
          status: PeriodClosingStatus.CLOSED,
          reason: optionalString(body, "reason"),
          snapshot: snapshot as Prisma.InputJsonValue,
          actorUserId: user.id
        }
      });

      return ensured;
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "period.close",
      entityType: "billing_period",
      entityId: period.id,
      after: { periodMonth, snapshot }
    });

    return { period, snapshot };
  }

  async reopenPeriod(
    user: AuthenticatedUser,
    periodMonth: string,
    rawBody: unknown
  ) {
    const body = bodyObject(rawBody);
    const reason = stringField(body, "reason");
    const period = await this.prisma.billingPeriod.upsert({
      where: { orgId_periodMonth: { orgId: user.orgId, periodMonth } },
      update: {
        status: PeriodClosingStatus.REOPENED,
        reopenedAt: new Date(),
        reason
      },
      create: {
        orgId: user.orgId,
        periodMonth,
        ...parsePeriodMonth(periodMonth),
        status: PeriodClosingStatus.REOPENED,
        reopenedAt: new Date(),
        reason
      }
    });

    await this.prisma.periodClosing.create({
      data: {
        orgId: user.orgId,
        periodMonth,
        status: PeriodClosingStatus.REOPENED,
        reason,
        actorUserId: user.id
      }
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "period.reopen",
      entityType: "billing_period",
      entityId: period.id,
      after: { periodMonth, reason }
    });

    return period;
  }

  listAttachments(user: AuthenticatedUser) {
    return this.prisma.attachment.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: "desc" }
    });
  }

  async createAttachment(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const attachment = await this.prisma.attachment.create({
      data: {
        orgId: user.orgId,
        ownerType: optionalString(body, "ownerType"),
        ownerId: optionalString(body, "ownerId"),
        fileName: stringField(body, "fileName"),
        contentType: optionalString(body, "contentType"),
        sizeBytes:
          typeof body.sizeBytes === "number" ? BigInt(body.sizeBytes) : undefined,
        storageKey:
          optionalString(body, "storageKey") ??
          `attachments/${user.orgId}/${Date.now()}-${stringField(body, "fileName")}`,
        url: optionalString(body, "url"),
        uploadedById: user.id
      }
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "attachment.create",
      entityType: "attachment",
      entityId: attachment.id,
      after: { fileName: attachment.fileName, storageKey: attachment.storageKey }
    });

    return attachment;
  }

  async customerProfit(user: AuthenticatedUser, periodMonth?: string) {
    const customerWhere: Prisma.CustomerWhereInput = { orgId: user.orgId };
    if (!user.permissions.includes(PERMISSION_CODES.CUSTOMER_READ_ALL)) {
      customerWhere.owners = { some: { userId: user.id } };
    }
    const customers = await this.prisma.customer.findMany({
      where: customerWhere,
      include: { owners: { include: { user: true } } }
    });
    const customerIds = customers.map((customer) => customer.id);

    const billGroups = await this.prisma.bill.groupBy({
      by: ["customerId"],
      where: {
        orgId: user.orgId,
        customerId: { in: customerIds },
        status: { not: "VOIDED" },
        ...(periodMonth ? { periodMonth } : {})
      },
      _sum: { totalAmount: true }
    });
    const costGroups = await this.prisma.costEntry.groupBy({
      by: ["customerId"],
      where: {
        orgId: user.orgId,
        customerId: { in: customerIds },
        ...(periodMonth ? { periodMonth } : {})
      },
      _sum: { amount: true }
    });
    const incomeByCustomer = new Map(
      billGroups.map((group) => [
        group.customerId,
        new Prisma.Decimal(group._sum.totalAmount ?? 0)
      ])
    );
    const costByCustomer = new Map(
      costGroups.map((group) => [
        group.customerId,
        new Prisma.Decimal(group._sum.amount ?? 0)
      ])
    );

    return customers.map((customer) => {
      const income = incomeByCustomer.get(customer.id) ?? new Prisma.Decimal(0);
      const cost = costByCustomer.get(customer.id) ?? new Prisma.Decimal(0);
      const profit = income.minus(cost);
      return {
        customerId: customer.id,
        customerCode: customer.code,
        customerName: customer.name,
        ownerNames: customer.owners.map((owner) => owner.user.name),
        periodMonth: periodMonth ?? "ALL",
        incomeAmount: decimalString(income),
        costAmount: decimalString(cost),
        profitAmount: decimalString(profit),
        grossMargin: income.isZero()
          ? null
          : profit.div(income).mul(100).toDecimalPlaces(2).toString()
      };
    });
  }

  async ownerRanking(user: AuthenticatedUser, periodMonth?: string) {
    const rows = await this.customerProfit(user, periodMonth);
    const byOwner = new Map<
      string,
      { ownerName: string; income: Prisma.Decimal; cost: Prisma.Decimal; profit: Prisma.Decimal }
    >();

    for (const row of rows) {
      const ownerNames = row.ownerNames.length ? row.ownerNames : ["未分配"];
      for (const ownerName of ownerNames) {
        const current =
          byOwner.get(ownerName) ??
          {
            ownerName,
            income: new Prisma.Decimal(0),
            cost: new Prisma.Decimal(0),
            profit: new Prisma.Decimal(0)
          };
        current.income = current.income.plus(row.incomeAmount);
        current.cost = current.cost.plus(row.costAmount);
        current.profit = current.profit.plus(row.profitAmount);
        byOwner.set(ownerName, current);
      }
    }

    return Array.from(byOwner.values())
      .map((row) => ({
        ownerName: row.ownerName,
        periodMonth: periodMonth ?? "ALL",
        incomeAmount: decimalString(row.income),
        costAmount: decimalString(row.cost),
        profitAmount: decimalString(row.profit),
        grossMargin: row.income.isZero()
          ? null
          : row.profit.div(row.income).mul(100).toDecimalPlaces(2).toString()
      }))
      .sort((a, b) =>
        new Prisma.Decimal(b.profitAmount).cmp(new Prisma.Decimal(a.profitAmount))
      );
  }

  private async decidePaymentRequest(
    user: AuthenticatedUser,
    id: string,
    status: PaymentRequestStatus,
    action: string,
    note?: string
  ) {
    const request = await this.prisma.paymentRequest.findFirst({
      where: { id, orgId: user.orgId }
    });
    if (!request) {
      throw new NotFoundException("Payment request not found.");
    }

    const updated = await this.prisma.paymentRequest.update({
      where: { id },
      data: {
        status,
        submittedAt:
          status === PaymentRequestStatus.SUBMITTED
            ? new Date()
            : request.submittedAt,
        decidedAt:
          status === PaymentRequestStatus.APPROVED ||
          status === PaymentRequestStatus.REJECTED
            ? new Date()
            : request.decidedAt,
        decidedById:
          status === PaymentRequestStatus.APPROVED ||
          status === PaymentRequestStatus.REJECTED
            ? user.id
            : request.decidedById,
        rejectReason:
          status === PaymentRequestStatus.REJECTED ? note : request.rejectReason,
        approvals:
          status === PaymentRequestStatus.APPROVED ||
          status === PaymentRequestStatus.REJECTED
            ? {
                create: {
                  approverUserId: user.id,
                  action,
                  note
                }
              }
            : undefined
      },
      include: { items: true, approvals: true }
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: `payment_request.${action}`,
      entityType: "payment_request",
      entityId: id,
      before: { status: request.status },
      after: { status: updated.status, note }
    });

    return updated;
  }

  private async ensureBillAllocationFits(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    billId: string,
    amount: Prisma.Decimal,
    kind: "invoice" | "receipt"
  ) {
    const bill = await tx.bill.findFirst({
      where: { id: billId, orgId: user.orgId },
      include: {
        invoiceAllocations: { include: { invoice: true } },
        receiptAllocations: { include: { receipt: true } }
      }
    });
    if (!bill) {
      throw new NotFoundException("Bill not found.");
    }
    await this.customers.ensureCustomerAccess(user, bill.customerId);
    await this.periodLocks.ensureOpen(user.orgId, bill.periodMonth);

    const allocated = sum(
      kind === "invoice"
        ? bill.invoiceAllocations
            .filter((allocation) => allocation.invoice.status !== "VOIDED")
            .map((allocation) => allocation.amount)
        : bill.receiptAllocations
            .filter((allocation) => allocation.receipt.status !== "REVERSED")
            .map((allocation) => allocation.amount)
    );

    if (allocated.plus(amount).greaterThan(bill.totalAmount)) {
      throw new BadRequestException(`${kind} allocation exceeds bill balance.`);
    }
  }

  private async applyPayablePayment(
    tx: Prisma.TransactionClient,
    payableId: string,
    amount: Prisma.Decimal
  ) {
    const payable = await tx.payable.findUnique({ where: { id: payableId } });
    if (!payable) {
      throw new NotFoundException("Payable not found.");
    }
    const paidAmount = payable.paidAmount.plus(amount);
    const status = paidAmount.greaterThanOrEqualTo(payable.amount)
      ? PayableStatus.PAID
      : paidAmount.isZero()
        ? PayableStatus.UNPAID
        : PayableStatus.PARTIALLY_PAID;

    await tx.payable.update({
      where: { id: payableId },
      data: { paidAmount, status }
    });
  }

  private async refreshPaymentRequestStatus(
    tx: Prisma.TransactionClient,
    requestId: string
  ) {
    const request = await tx.paymentRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { payments: true }
    });
    const paid = sum(
      request.payments
        .filter((payment) => payment.status !== PaymentStatus.REVERSED)
        .map((payment) => payment.amount)
    );
    const status = paid.greaterThanOrEqualTo(request.requestedAmount)
      ? PaymentRequestStatus.PAID
      : paid.isZero()
        ? request.status
        : PaymentRequestStatus.PARTIALLY_PAID;

    await tx.paymentRequest.update({
      where: { id: requestId },
      data: { status }
    });
  }

  private async periodSnapshot(orgId: string, periodMonth: string) {
    const [billSum, costSum, receiptSum, payableOpen] = await Promise.all([
      this.prisma.bill.aggregate({
        where: { orgId, periodMonth, status: { not: "VOIDED" } },
        _sum: { totalAmount: true },
        _count: true
      }),
      this.prisma.costEntry.aggregate({
        where: { orgId, periodMonth },
        _sum: { amount: true },
        _count: true
      }),
      this.prisma.receiptAllocation.aggregate({
        where: { bill: { orgId, periodMonth }, receipt: { status: { not: "REVERSED" } } },
        _sum: { amount: true },
        _count: true
      }),
      this.prisma.payable.count({
        where: { orgId, periodMonth, status: { notIn: ["PAID", "VOIDED"] } }
      })
    ]);

    return {
      billCount: billSum._count,
      billAmount: decimalString(billSum._sum.totalAmount ?? 0),
      costCount: costSum._count,
      costAmount: decimalString(costSum._sum.amount ?? 0),
      receiptAllocationCount: receiptSum._count,
      receiptAmount: decimalString(receiptSum._sum.amount ?? 0),
      openPayableCount: payableOpen
    };
  }

  private extraChargeKind(body: Payload) {
    const value = stringField(body, "kind", ExtraChargeKind.VALUE_ADDED);
    return value in ExtraChargeKind
      ? (value as ExtraChargeKind)
      : ExtraChargeKind.VALUE_ADDED;
  }
}
