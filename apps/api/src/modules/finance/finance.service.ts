import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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
  ReceiptStatus,
} from "@prisma/client";

import { PERMISSION_CODES, type AuthenticatedUser } from "@erpdog/contracts";

import { AuditService } from "../../common/audit/audit.service";
import { ExcelService } from "../../common/excel/excel.service";
import {
  parsePeriodMonth,
  PeriodLockService,
} from "../../common/periods/period-lock.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { StorageService } from "../../common/storage/storage.service";
import {
  assertMoneyEquals,
  decimalString,
  nonNegativeMoney,
  positiveMoney,
  sum,
} from "../../common/utils/finance";
import {
  arrayField,
  bodyObject,
  dateField,
  optionalDate,
  optionalString,
  stringField,
  type Payload,
} from "../../common/utils/payload";
import {
  paginated,
  parsePagination,
  type PaginationQuery,
} from "../../common/utils/pagination";
import { CustomersService } from "../customers/customers.service";

const CONTRACT_ATTACHMENT_MAX_BYTES = BigInt(20 * 1024 * 1024);

type PeriodCustomerFilters = {
  periodMonth?: string;
  customerId?: string;
} & PaginationQuery;

type AttachmentFilters = {
  ownerType?: string;
  ownerId?: string;
} & PaginationQuery;

type PaymentAllocationInput = {
  payableId?: string;
  amount: Prisma.Decimal;
};

type AttachmentRecord = {
  id: string;
  orgId: string;
  ownerType: string | null;
  ownerId: string | null;
  fileName: string;
  contentType: string | null;
  sizeBytes: bigint | null;
  storageKey: string;
  url: string | null;
  uploadedById: string | null;
  createdAt: Date;
};

@Injectable()
export class FinanceService {
  constructor(
    private readonly audit: AuditService,
    private readonly customers: CustomersService,
    private readonly excel: ExcelService,
    private readonly periodLocks: PeriodLockService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  listExtraChargeCategories(user: AuthenticatedUser) {
    return this.prisma.extraChargeCategory.findMany({
      where: { orgId: user.orgId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async createExtraChargeCategory(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const category = await this.prisma.extraChargeCategory.create({
      data: {
        orgId: user.orgId,
        code: stringField(body, "code"),
        name: stringField(body, "name"),
        kind: this.extraChargeKind(body),
      },
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "extra_charge_category.create",
      entityType: "extra_charge_category",
      entityId: category.id,
      after: { code: category.code, name: category.name },
    });

    return category;
  }

  async listExtraCharges(
    user: AuthenticatedUser,
    filters: PeriodCustomerFilters,
  ) {
    const where: Prisma.ExtraChargeWhereInput = {
      orgId: user.orgId,
      ...(filters.periodMonth ? { periodMonth: filters.periodMonth } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
    };

    if (!user.permissions.includes(PERMISSION_CODES.CUSTOMER_READ_ALL)) {
      where.customer = { owners: { some: { userId: user.id } } };
    }

    const pagination = parsePagination(filters);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.extraCharge.findMany({
        where,
        include: { customer: true, contract: true, category: true },
        orderBy: { incurredDate: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.extraCharge.count({ where }),
    ]);

    return paginated(items, total, pagination);
  }

  async createExtraCharge(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const customerId = stringField(body, "customerId");
    const periodMonth = stringField(body, "periodMonth");
    await this.customers.ensureCustomerAccess(user, customerId);
    await this.periodLocks.ensureOpen(user.orgId, periodMonth);
    const contractId = optionalString(body, "contractId");
    const categoryId = optionalString(body, "categoryId");
    if (contractId) {
      await this.ensureContractForCustomer(user, customerId, contractId);
    }
    await this.ensureExtraChargeCategory(user, categoryId);

    const charge = await this.prisma.extraCharge.create({
      data: {
        orgId: user.orgId,
        customerId,
        contractId,
        categoryId,
        kind: this.extraChargeKind(body),
        name: stringField(body, "name"),
        amount: positiveMoney(body.amount),
        incurredDate: dateField(body, "incurredDate"),
        periodMonth,
        description: optionalString(body, "description"),
        createdById: user.id,
      },
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "extra_charge.create",
      entityType: "extra_charge",
      entityId: charge.id,
      after: { name: charge.name, amount: charge.amount.toString() },
    });

    return charge;
  }

  async cancelExtraCharge(
    user: AuthenticatedUser,
    id: string,
    rawBody: unknown,
  ) {
    const body = bodyObject(rawBody);
    const charge = await this.prisma.extraCharge.findFirst({
      where: { id, orgId: user.orgId },
    });
    if (!charge) {
      throw new NotFoundException("Extra charge not found.");
    }

    await this.customers.ensureCustomerAccess(user, charge.customerId);
    await this.periodLocks.ensureOpen(user.orgId, charge.periodMonth);
    if (charge.status !== ExtraChargeStatus.DRAFT) {
      throw new ConflictException(
        "Only draft extra charges can be cancelled. Included charges must be corrected through bill adjustment.",
      );
    }

    const updated = await this.prisma.extraCharge.update({
      where: { id },
      data: {
        status: ExtraChargeStatus.CANCELLED,
        description:
          optionalString(body, "reason") ?? charge.description ?? undefined,
      },
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "extra_charge.cancel",
      entityType: "extra_charge",
      entityId: id,
      before: { status: charge.status },
      after: { status: updated.status },
      reason: optionalString(body, "reason"),
    });

    return updated;
  }

  async listInvoices(
    user: AuthenticatedUser,
    paginationQuery: PaginationQuery = {},
  ) {
    const where: Prisma.InvoiceWhereInput = { orgId: user.orgId };
    const pagination = parsePagination(paginationQuery);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: { allocations: { include: { bill: true } } },
        orderBy: { issueDate: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return paginated(items, total, pagination);
  }

  async createInvoice(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const allocations = arrayField<Payload>(body, "allocations");
    if (!allocations.length) {
      throw new BadRequestException("allocations is required.");
    }

    const invoiceAmount = positiveMoney(body.amount);
    const allocationTotal = sum(
      allocations.map((allocation) => positiveMoney(allocation.amount)),
    );

    assertMoneyEquals(
      allocationTotal,
      invoiceAmount,
      "Invoice allocations must equal invoice amount.",
    );

    const invoice = await this.prisma.$transaction(
      async (tx) => {
        for (const allocation of allocations) {
          await this.ensureBillAllocationFits(
            tx,
            user,
            stringField(allocation, "billId"),
            positiveMoney(allocation.amount),
            "invoice",
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
            taxAmount:
              body.taxAmount === undefined
                ? new Prisma.Decimal(0)
                : nonNegativeMoney(body.taxAmount, "taxAmount"),
            remarks: optionalString(body, "remarks"),
            fileAttachmentId: optionalString(body, "fileAttachmentId"),
            allocations: {
              create: allocations.map((allocation) => ({
                billId: stringField(allocation, "billId"),
                amount: positiveMoney(allocation.amount),
              })),
            },
          },
          include: { allocations: true },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "invoice.create",
      entityType: "invoice",
      entityId: invoice.id,
      after: {
        invoiceNo: invoice.invoiceNo,
        amount: invoice.amount.toString(),
      },
    });

    return invoice;
  }

  async voidInvoice(user: AuthenticatedUser, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, orgId: user.orgId },
      include: { allocations: { include: { bill: true } } },
    });
    if (!invoice) {
      throw new NotFoundException("Invoice not found.");
    }
    if (invoice.status === InvoiceStatus.VOIDED) {
      throw new ConflictException("Invoice is already voided.");
    }

    for (const allocation of invoice.allocations) {
      await this.customers.ensureCustomerAccess(
        user,
        allocation.bill.customerId,
      );
      await this.periodLocks.ensureOpen(
        user.orgId,
        allocation.bill.periodMonth,
      );
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.VOIDED },
    });
    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "invoice.void",
      entityType: "invoice",
      entityId: id,
      before: { status: invoice.status },
      after: { status: updated.status },
    });
    return updated;
  }

  async listReceipts(
    user: AuthenticatedUser,
    paginationQuery: PaginationQuery = {},
  ) {
    const where: Prisma.ReceiptWhereInput = { orgId: user.orgId };
    const pagination = parsePagination(paginationQuery);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.receipt.findMany({
        where,
        include: { allocations: { include: { bill: true } } },
        orderBy: { receivedAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.receipt.count({ where }),
    ]);

    return paginated(items, total, pagination);
  }

  async createReceipt(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const allocations = arrayField<Payload>(body, "allocations");
    if (!allocations.length) {
      throw new BadRequestException("allocations is required.");
    }

    const receiptAmount = positiveMoney(body.amount);
    const allocationTotal = sum(
      allocations.map((allocation) => positiveMoney(allocation.amount)),
    );

    assertMoneyEquals(
      allocationTotal,
      receiptAmount,
      "Receipt allocations must equal receipt amount.",
    );

    const receipt = await this.prisma.$transaction(
      async (tx) => {
        for (const allocation of allocations) {
          await this.ensureBillAllocationFits(
            tx,
            user,
            stringField(allocation, "billId"),
            positiveMoney(allocation.amount),
            "receipt",
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
                amount: positiveMoney(allocation.amount),
              })),
            },
          },
          include: { allocations: true },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "receipt.create",
      entityType: "receipt",
      entityId: receipt.id,
      after: { amount: receipt.amount.toString() },
    });

    return receipt;
  }

  async reverseReceipt(user: AuthenticatedUser, id: string) {
    const receipt = await this.prisma.receipt.findFirst({
      where: { id, orgId: user.orgId },
      include: { allocations: { include: { bill: true } } },
    });
    if (!receipt) {
      throw new NotFoundException("Receipt not found.");
    }
    if (receipt.status === ReceiptStatus.REVERSED) {
      throw new ConflictException("Receipt is already reversed.");
    }
    for (const allocation of receipt.allocations) {
      await this.customers.ensureCustomerAccess(
        user,
        allocation.bill.customerId,
      );
      await this.periodLocks.ensureOpen(
        user.orgId,
        allocation.bill.periodMonth,
      );
    }

    const updated = await this.prisma.receipt.update({
      where: { id },
      data: { status: ReceiptStatus.REVERSED },
    });
    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "receipt.reverse",
      entityType: "receipt",
      entityId: id,
      before: { status: receipt.status },
      after: { status: updated.status },
    });
    return updated;
  }

  listCostCategories(user: AuthenticatedUser) {
    return this.prisma.costCategory.findMany({
      where: { orgId: user.orgId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async createCostCategory(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const category = await this.prisma.costCategory.create({
      data: {
        orgId: user.orgId,
        code: stringField(body, "code"),
        name: stringField(body, "name"),
      },
    });
    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "cost_category.create",
      entityType: "cost_category",
      entityId: category.id,
      after: { code: category.code, name: category.name },
    });
    return category;
  }

  async listCostEntries(
    user: AuthenticatedUser,
    filters: PeriodCustomerFilters,
  ) {
    const where: Prisma.CostEntryWhereInput = {
      orgId: user.orgId,
      ...(filters.periodMonth ? { periodMonth: filters.periodMonth } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
    };

    if (!user.permissions.includes(PERMISSION_CODES.CUSTOMER_READ_ALL)) {
      where.customer = { owners: { some: { userId: user.id } } };
    }

    const pagination = parsePagination(filters);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.costEntry.findMany({
        where,
        include: { customer: true, category: true, payables: true },
        orderBy: { incurredDate: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.costEntry.count({ where }),
    ]);

    return paginated(items, total, pagination);
  }

  async createCostEntry(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const customerId = stringField(body, "customerId");
    const periodMonth = stringField(body, "periodMonth");
    await this.customers.ensureCustomerAccess(user, customerId);
    await this.periodLocks.ensureOpen(user.orgId, periodMonth);

    const amount = positiveMoney(body.amount);
    const createPayable = body.createPayable === true;
    const categoryId = optionalString(body, "categoryId");
    await this.ensureCostCategory(user, categoryId);

    const entry = await this.prisma.$transaction(async (tx) => {
      const cost = await tx.costEntry.create({
        data: {
          orgId: user.orgId,
          customerId,
          periodMonth,
          categoryId,
          amount,
          incurredDate: dateField(body, "incurredDate"),
          handlerUserId: optionalString(body, "handlerUserId") ?? user.id,
          description: optionalString(body, "description"),
          attachmentId: optionalString(body, "attachmentId"),
          payableCreated: createPayable,
        },
      });

      if (createPayable) {
        await tx.payable.create({
          data: {
            orgId: user.orgId,
            customerId,
            costEntryId: cost.id,
            categoryId,
            vendorName: stringField(body, "vendorName", "未命名供应商"),
            periodMonth,
            amount,
            dueDate: optionalDate(body, "dueDate"),
            remarks: optionalString(body, "description"),
          },
        });
      }

      return tx.costEntry.findUniqueOrThrow({
        where: { id: cost.id },
        include: { payables: true, category: true, customer: true },
      });
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "cost_entry.create",
      entityType: "cost_entry",
      entityId: entry.id,
      after: { amount: entry.amount.toString(), customerId },
    });

    return entry;
  }

  async listPayables(
    user: AuthenticatedUser,
    paginationQuery: PaginationQuery = {},
  ) {
    const where: Prisma.PayableWhereInput = { orgId: user.orgId };
    if (!user.permissions.includes(PERMISSION_CODES.CUSTOMER_READ_ALL)) {
      where.customer = { owners: { some: { userId: user.id } } };
    }

    const pagination = parsePagination(paginationQuery);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payable.findMany({
        where,
        include: { customer: true, category: true, paymentAllocations: true },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.payable.count({ where }),
    ]);

    return paginated(items, total, pagination);
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
    const categoryId = optionalString(body, "categoryId");
    await this.ensureCostCategory(user, categoryId);

    const payable = await this.prisma.payable.create({
      data: {
        orgId: user.orgId,
        customerId,
        categoryId,
        vendorName: stringField(body, "vendorName"),
        periodMonth,
        amount: positiveMoney(body.amount),
        dueDate: optionalDate(body, "dueDate"),
        remarks: optionalString(body, "remarks"),
      },
    });
    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "payable.create",
      entityType: "payable",
      entityId: payable.id,
      after: {
        amount: payable.amount.toString(),
        vendorName: payable.vendorName,
      },
    });
    return payable;
  }

  async listPaymentRequests(
    user: AuthenticatedUser,
    paginationQuery: PaginationQuery = {},
  ) {
    const where: Prisma.PaymentRequestWhereInput = { orgId: user.orgId };
    if (!user.permissions.includes(PERMISSION_CODES.CUSTOMER_READ_ALL)) {
      where.OR = [
        { applicantUserId: user.id },
        { customer: { owners: { some: { userId: user.id } } } },
        {
          items: {
            some: {
              payable: {
                customer: { owners: { some: { userId: user.id } } },
              },
            },
          },
        },
      ];
    }

    const pagination = parsePagination(paginationQuery);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.paymentRequest.findMany({
        where,
        include: {
          customer: true,
          category: true,
          items: { include: { payable: true } },
          approvals: true,
          payments: true,
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.paymentRequest.count({ where }),
    ]);

    return paginated(items, total, pagination);
  }

  async createPaymentRequest(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const items = arrayField<Payload>(body, "items");
    if (!items.length) {
      throw new BadRequestException("items is required.");
    }

    const itemTotal = sum(items.map((item) => positiveMoney(item.amount)));
    const requestedAmount =
      body.requestedAmount !== undefined
        ? positiveMoney(body.requestedAmount)
        : itemTotal;
    assertMoneyEquals(
      itemTotal,
      requestedAmount,
      "Payment request items must equal requested amount.",
    );

    const customerId = optionalString(body, "customerId");
    const periodMonth = optionalString(body, "periodMonth");
    if (customerId) {
      await this.customers.ensureCustomerAccess(user, customerId);
    }
    if (periodMonth) {
      await this.periodLocks.ensureOpen(user.orgId, periodMonth);
    }
    const categoryId = optionalString(body, "categoryId");
    await this.ensureCostCategory(user, categoryId);
    for (const item of items) {
      await this.ensureCostCategory(user, optionalString(item, "categoryId"));
    }

    const request = await this.prisma.$transaction(
      async (tx) => {
        const requestedByPayable = new Map<string, Prisma.Decimal>();
        for (const item of items) {
          const itemCustomerId = optionalString(item, "customerId");
          const itemPeriodMonth = optionalString(item, "periodMonth");
          const itemPayableId = optionalString(item, "payableId");
          const itemAmount = positiveMoney(item.amount);

          if (itemCustomerId) {
            await this.customers.ensureCustomerAccess(user, itemCustomerId);
          }
          if (itemPeriodMonth) {
            await this.periodLocks.ensureOpen(user.orgId, itemPeriodMonth);
          }
          if (itemPayableId) {
            requestedByPayable.set(
              itemPayableId,
              (
                requestedByPayable.get(itemPayableId) ?? new Prisma.Decimal(0)
              ).plus(itemAmount),
            );
          }
        }

        const payableId = optionalString(body, "payableId");
        if (payableId && !requestedByPayable.has(payableId)) {
          requestedByPayable.set(payableId, requestedAmount);
        }
        for (const [nextPayableId, nextAmount] of requestedByPayable) {
          await this.ensurePayableRequestFits(
            tx,
            user,
            nextPayableId,
            nextAmount,
          );
        }

        return tx.paymentRequest.create({
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
            customerId,
            periodMonth,
            categoryId,
            payableId,
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
                amount: positiveMoney(item.amount),
                description: optionalString(item, "description"),
              })),
            },
          },
          include: { items: true, approvals: true },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "payment_request.create",
      entityType: "payment_request",
      entityId: request.id,
      after: {
        requestNo: request.requestNo,
        amount: request.requestedAmount.toString(),
      },
    });

    return request;
  }

  submitPaymentRequest(user: AuthenticatedUser, id: string) {
    return this.decidePaymentRequest(
      user,
      id,
      PaymentRequestStatus.SUBMITTED,
      "submit",
    );
  }

  approvePaymentRequest(user: AuthenticatedUser, id: string, rawBody: unknown) {
    const body = bodyObject(rawBody);
    return this.decidePaymentRequest(
      user,
      id,
      PaymentRequestStatus.APPROVED,
      "approve",
      optionalString(body, "note"),
    );
  }

  rejectPaymentRequest(user: AuthenticatedUser, id: string, rawBody: unknown) {
    const body = bodyObject(rawBody);
    return this.decidePaymentRequest(
      user,
      id,
      PaymentRequestStatus.REJECTED,
      "reject",
      stringField(body, "reason"),
    );
  }

  async cancelPaymentRequest(
    user: AuthenticatedUser,
    id: string,
    rawBody: unknown,
  ) {
    const body = bodyObject(rawBody);
    const reason = stringField(body, "reason", "付款申请取消");
    const request = await this.prisma.paymentRequest.findFirst({
      where: { id, orgId: user.orgId },
      include: { payments: true },
    });
    if (!request) {
      throw new NotFoundException("Payment request not found.");
    }
    if (
      request.status === PaymentRequestStatus.CANCELLED ||
      request.status === PaymentRequestStatus.PAID ||
      request.status === PaymentRequestStatus.PARTIALLY_PAID
    ) {
      throw new ConflictException(
        "Paid, partially paid, or cancelled payment requests cannot be cancelled.",
      );
    }

    const paidAmount = sum(
      request.payments
        .filter((payment) => payment.status !== PaymentStatus.REVERSED)
        .map((payment) => payment.amount),
    );
    if (paidAmount.greaterThan(0)) {
      throw new ConflictException(
        "Payment requests with registered payments cannot be cancelled.",
      );
    }
    this.ensurePaymentRequestActionAccess(user, request, "cancel");

    const updated = await this.prisma.paymentRequest.update({
      where: { id },
      data: {
        status: PaymentRequestStatus.CANCELLED,
        rejectReason: reason,
        approvals: {
          create: {
            approverUserId: user.id,
            action: "cancel",
            note: reason,
          },
        },
      },
      include: { items: true, approvals: true },
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "payment_request.cancel",
      entityType: "payment_request",
      entityId: id,
      before: { status: request.status },
      after: { status: updated.status },
      reason,
    });

    return updated;
  }

  async listPayments(
    user: AuthenticatedUser,
    paginationQuery: PaginationQuery = {},
  ) {
    const where: Prisma.PaymentWhereInput = { orgId: user.orgId };
    const pagination = parsePagination(paginationQuery);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: { request: true, allocations: { include: { payable: true } } },
        orderBy: { paidAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return paginated(items, total, pagination);
  }

  async createPayment(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const requestId = optionalString(body, "requestId");
    const rawAllocations = arrayField<Payload>(body, "allocations");
    const amount = positiveMoney(body.amount);
    const allocationTotal = sum(
      rawAllocations.map((allocation) => positiveMoney(allocation.amount)),
    );

    if (!requestId && !rawAllocations.length) {
      throw new BadRequestException("requestId or allocations is required.");
    }
    if (rawAllocations.length) {
      assertMoneyEquals(
        allocationTotal,
        amount,
        "Payment allocations must equal payment amount.",
      );
    }

    const payment = await this.prisma.$transaction(
      async (tx) => {
        let allocations: PaymentAllocationInput[] = rawAllocations.map(
          (allocation) => ({
            payableId: optionalString(allocation, "payableId"),
            amount: positiveMoney(allocation.amount),
          }),
        );

        if (requestId) {
          const request = await tx.paymentRequest.findFirst({
            where: { id: requestId, orgId: user.orgId },
            include: {
              items: { include: { payable: true } },
              payments: { include: { allocations: true } },
            },
          });
          if (!request) {
            throw new NotFoundException("Payment request not found.");
          }
          if (
            request.status !== PaymentRequestStatus.APPROVED &&
            request.status !== PaymentRequestStatus.PARTIALLY_PAID
          ) {
            throw new ConflictException(
              "Payment request must be approved first.",
            );
          }
          const paidAmount = sum(
            request.payments
              .filter((payment) => payment.status !== PaymentStatus.REVERSED)
              .map((payment) => payment.amount),
          );
          if (paidAmount.plus(amount).greaterThan(request.requestedAmount)) {
            throw new BadRequestException("Payment exceeds request balance.");
          }

          if (!allocations.length) {
            allocations = this.derivePaymentAllocations(request, amount);
          } else {
            this.ensurePaymentAllocationsMatchRequest(request, allocations);
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
                payableId: allocation.payableId,
                amount: allocation.amount,
              })),
            },
          },
          include: { allocations: true },
        });

        for (const allocation of allocations) {
          if (allocation.payableId) {
            await this.applyPayablePayment(
              tx,
              user,
              allocation.payableId,
              allocation.amount,
            );
          }
        }

        if (requestId) {
          await this.refreshPaymentRequestStatus(tx, requestId);
        }

        return created;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "payment.create",
      entityType: "payment",
      entityId: payment.id,
      after: {
        amount: payment.amount.toString(),
        paymentNo: payment.paymentNo,
      },
    });

    return payment;
  }

  async reversePayment(user: AuthenticatedUser, id: string, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const reason = stringField(body, "reason", "付款冲销");
    const payment = await this.prisma.payment.findFirst({
      where: { id, orgId: user.orgId },
      include: { allocations: true },
    });
    if (!payment) {
      throw new NotFoundException("Payment not found.");
    }
    if (payment.status === PaymentStatus.REVERSED) {
      throw new ConflictException("Payment is already reversed.");
    }

    const updated = await this.prisma.$transaction(
      async (tx) => {
        for (const allocation of payment.allocations) {
          if (allocation.payableId) {
            await this.reversePayablePayment(
              tx,
              user,
              allocation.payableId,
              allocation.amount,
            );
          }
        }

        const reversed = await tx.payment.update({
          where: { id },
          data: { status: PaymentStatus.REVERSED },
          include: { allocations: true },
        });

        if (payment.requestId) {
          await this.refreshPaymentRequestStatus(tx, payment.requestId);
        }

        await tx.auditLog.create({
          data: {
            orgId: user.orgId,
            actorUserId: user.id,
            action: "payment.reverse",
            entityType: "payment",
            entityId: id,
            before: { status: payment.status },
            after: { status: reversed.status, reason },
            reason,
          },
        });

        return reversed;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return updated;
  }

  async closePeriod(
    user: AuthenticatedUser,
    periodMonth: string,
    rawBody: unknown,
  ) {
    const body = bodyObject(rawBody);
    parsePeriodMonth(periodMonth);
    const openBills = await this.prisma.bill.count({
      where: {
        orgId: user.orgId,
        periodMonth,
        status: {
          in: [
            "DRAFT",
            "INTERNAL_REVIEW",
            "FINANCE_REVIEW",
            "CUSTOMER_PENDING",
          ],
        },
      },
    });
    if (openBills > 0) {
      throw new ConflictException(
        "There are unconfirmed bills in this period.",
      );
    }
    const [draftExtraCharges, pendingPaymentRequests] = await Promise.all([
      this.prisma.extraCharge.count({
        where: {
          orgId: user.orgId,
          periodMonth,
          status: ExtraChargeStatus.DRAFT,
        },
      }),
      this.prisma.paymentRequest.count({
        where: {
          orgId: user.orgId,
          status: {
            in: [
              PaymentRequestStatus.DRAFT,
              PaymentRequestStatus.SUBMITTED,
              PaymentRequestStatus.APPROVED,
              PaymentRequestStatus.PARTIALLY_PAID,
            ],
          },
          OR: [
            { periodMonth },
            { items: { some: { periodMonth } } },
            { items: { some: { payable: { periodMonth } } } },
          ],
        },
      }),
    ]);
    if (draftExtraCharges > 0) {
      throw new ConflictException(
        "There are draft extra charges not included in bills.",
      );
    }
    if (pendingPaymentRequests > 0) {
      throw new ConflictException(
        "There are unfinished payment requests in this period.",
      );
    }

    const snapshot = await this.periodSnapshot(user.orgId, periodMonth);
    const period = await this.prisma.$transaction(async (tx) => {
      const ensured = await tx.billingPeriod.upsert({
        where: { orgId_periodMonth: { orgId: user.orgId, periodMonth } },
        update: {
          status: PeriodClosingStatus.CLOSED,
          closedAt: new Date(),
          reason: optionalString(body, "reason"),
        },
        create: {
          orgId: user.orgId,
          periodMonth,
          ...parsePeriodMonth(periodMonth),
          status: PeriodClosingStatus.CLOSED,
          closedAt: new Date(),
          reason: optionalString(body, "reason"),
        },
      });

      await tx.periodClosing.create({
        data: {
          orgId: user.orgId,
          periodMonth,
          status: PeriodClosingStatus.CLOSED,
          reason: optionalString(body, "reason"),
          snapshot: snapshot as Prisma.InputJsonValue,
          actorUserId: user.id,
        },
      });

      return ensured;
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "period.close",
      entityType: "billing_period",
      entityId: period.id,
      after: { periodMonth, snapshot },
    });

    return { period, snapshot };
  }

  async reopenPeriod(
    user: AuthenticatedUser,
    periodMonth: string,
    rawBody: unknown,
  ) {
    const body = bodyObject(rawBody);
    const reason = stringField(body, "reason");
    const period = await this.prisma.billingPeriod.upsert({
      where: { orgId_periodMonth: { orgId: user.orgId, periodMonth } },
      update: {
        status: PeriodClosingStatus.REOPENED,
        reopenedAt: new Date(),
        reason,
      },
      create: {
        orgId: user.orgId,
        periodMonth,
        ...parsePeriodMonth(periodMonth),
        status: PeriodClosingStatus.REOPENED,
        reopenedAt: new Date(),
        reason,
      },
    });

    await this.prisma.periodClosing.create({
      data: {
        orgId: user.orgId,
        periodMonth,
        status: PeriodClosingStatus.REOPENED,
        reason,
        actorUserId: user.id,
      },
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "period.reopen",
      entityType: "billing_period",
      entityId: period.id,
      after: { periodMonth, reason },
    });

    return period;
  }

  async listAttachments(
    user: AuthenticatedUser,
    filters: AttachmentFilters = {},
  ) {
    const where: Prisma.AttachmentWhereInput = {
      orgId: user.orgId,
      ...(filters.ownerType ? { ownerType: filters.ownerType } : {}),
      ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
    };
    if (!user.permissions.includes(PERMISSION_CODES.CUSTOMER_READ_ALL)) {
      where.uploadedById = user.id;
    }

    const pagination = parsePagination(filters);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.attachment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.attachment.count({ where }),
    ]);

    return paginated(
      items.map((attachment) => this.presentAttachment(attachment)),
      total,
      pagination,
    );
  }

  async createAttachment(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const ownerType = optionalString(body, "ownerType");
    const ownerId = optionalString(body, "ownerId");
    await this.ensureAttachmentOwnerAccess(user, ownerType, ownerId);
    const fileName = stringField(body, "fileName");
    const contentType = optionalString(body, "contentType");
    const sizeBytes = this.attachmentSize(body);
    this.validateContractAttachment(
      ownerType,
      fileName,
      contentType,
      sizeBytes,
    );

    const attachment = await this.prisma.attachment.create({
      data: {
        orgId: user.orgId,
        ownerType,
        ownerId,
        fileName,
        contentType,
        sizeBytes,
        storageKey:
          optionalString(body, "storageKey") ??
          `attachments/${user.orgId}/${Date.now()}-${fileName}`,
        url: optionalString(body, "url"),
        uploadedById: user.id,
        contractId: this.attachmentContractId(ownerType, ownerId),
      },
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "attachment.create",
      entityType: "attachment",
      entityId: attachment.id,
      after: {
        fileName: attachment.fileName,
        storageKey: attachment.storageKey,
      },
    });

    return this.presentAttachment(attachment);
  }

  async createAttachmentUploadUrl(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const ownerType = optionalString(body, "ownerType");
    const ownerId = optionalString(body, "ownerId");
    await this.ensureAttachmentOwnerAccess(user, ownerType, ownerId);

    const fileName = stringField(body, "fileName");
    const contentType = optionalString(body, "contentType");
    const sizeBytes = this.attachmentSize(body);
    this.validateContractAttachment(
      ownerType,
      fileName,
      contentType,
      sizeBytes,
    );
    const presigned = await this.storage.createPresignedUpload({
      orgId: user.orgId,
      fileName,
      contentType,
      sizeBytes: sizeBytes === undefined ? undefined : Number(sizeBytes),
    });

    const attachment = await this.prisma.attachment.create({
      data: {
        orgId: user.orgId,
        ownerType,
        ownerId,
        fileName,
        contentType,
        sizeBytes,
        storageKey: presigned.storageKey,
        uploadedById: user.id,
        contractId: this.attachmentContractId(ownerType, ownerId),
      },
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "attachment.presign_upload",
      entityType: "attachment",
      entityId: attachment.id,
      after: {
        fileName: attachment.fileName,
        storageKey: attachment.storageKey,
      },
    });

    return {
      attachment: this.presentAttachment(attachment),
      upload: presigned.upload,
    };
  }

  async attachmentDownloadUrl(user: AuthenticatedUser, id: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id, orgId: user.orgId },
    });
    if (!attachment) {
      throw new NotFoundException("Attachment not found.");
    }

    await this.ensureAttachmentAccess(user, attachment);
    if (attachment.url) {
      return {
        attachment: this.presentAttachment(attachment),
        download: {
          url: attachment.url,
          expiresIn: null,
        },
      };
    }

    return {
      attachment: this.presentAttachment(attachment),
      download: await this.storage.createPresignedDownload(
        attachment.storageKey,
        attachment.fileName,
      ),
    };
  }

  async customerProfit(user: AuthenticatedUser, periodMonth?: string) {
    const customerWhere: Prisma.CustomerWhereInput = { orgId: user.orgId };
    if (!user.permissions.includes(PERMISSION_CODES.CUSTOMER_READ_ALL)) {
      customerWhere.owners = { some: { userId: user.id } };
    }
    const customers = await this.prisma.customer.findMany({
      where: customerWhere,
      include: { owners: { include: { user: true } } },
    });
    const customerIds = customers.map((customer) => customer.id);

    const billGroups = await this.prisma.bill.groupBy({
      by: ["customerId"],
      where: {
        orgId: user.orgId,
        customerId: { in: customerIds },
        status: { not: "VOIDED" },
        ...(periodMonth ? { periodMonth } : {}),
      },
      _sum: { totalAmount: true },
    });
    const costGroups = await this.prisma.costEntry.groupBy({
      by: ["customerId"],
      where: {
        orgId: user.orgId,
        customerId: { in: customerIds },
        ...(periodMonth ? { periodMonth } : {}),
      },
      _sum: { amount: true },
    });
    const incomeByCustomer = new Map(
      billGroups.map((group) => [
        group.customerId,
        new Prisma.Decimal(group._sum.totalAmount ?? 0),
      ]),
    );
    const costByCustomer = new Map(
      costGroups.map((group) => [
        group.customerId,
        new Prisma.Decimal(group._sum.amount ?? 0),
      ]),
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
          : profit.div(income).mul(100).toDecimalPlaces(2).toString(),
      };
    });
  }

  async ownerRanking(user: AuthenticatedUser, periodMonth?: string) {
    const rows = await this.customerProfit(user, periodMonth);
    const byOwner = new Map<
      string,
      {
        ownerName: string;
        income: Prisma.Decimal;
        cost: Prisma.Decimal;
        profit: Prisma.Decimal;
      }
    >();

    for (const row of rows) {
      const ownerNames = row.ownerNames.length ? row.ownerNames : ["未分配"];
      for (const ownerName of ownerNames) {
        const current = byOwner.get(ownerName) ?? {
          ownerName,
          income: new Prisma.Decimal(0),
          cost: new Prisma.Decimal(0),
          profit: new Prisma.Decimal(0),
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
          : row.profit.div(row.income).mul(100).toDecimalPlaces(2).toString(),
      }))
      .sort((a, b) =>
        new Prisma.Decimal(b.profitAmount).cmp(
          new Prisma.Decimal(a.profitAmount),
        ),
      );
  }

  async customerProfitWorkbook(user: AuthenticatedUser, periodMonth?: string) {
    const rows = await this.customerProfit(user, periodMonth);
    return this.excel.createWorkbook(
      `customer-profit-${periodMonth ?? "all"}.xlsx`,
      [
        {
          name: "客户利润",
          headers: [
            "期间",
            "客户编码",
            "客户名称",
            "负责人",
            "收入",
            "成本",
            "利润",
            "毛利率%",
          ],
          rows: rows.map((row) => ({
            期间: row.periodMonth,
            客户编码: row.customerCode,
            客户名称: row.customerName,
            负责人: row.ownerNames.join(", "),
            收入: row.incomeAmount,
            成本: row.costAmount,
            利润: row.profitAmount,
            "毛利率%": row.grossMargin ?? "",
          })),
        },
      ],
    );
  }

  async ownerRankingWorkbook(user: AuthenticatedUser, periodMonth?: string) {
    const rows = await this.ownerRanking(user, periodMonth);
    return this.excel.createWorkbook(
      `owner-ranking-${periodMonth ?? "all"}.xlsx`,
      [
        {
          name: "负责人排行",
          headers: [
            "排名",
            "期间",
            "负责人",
            "收入",
            "成本",
            "利润",
            "毛利率%",
          ],
          rows: rows.map((row, index) => ({
            排名: index + 1,
            期间: row.periodMonth,
            负责人: row.ownerName,
            收入: row.incomeAmount,
            成本: row.costAmount,
            利润: row.profitAmount,
            "毛利率%": row.grossMargin ?? "",
          })),
        },
      ],
    );
  }

  private async decidePaymentRequest(
    user: AuthenticatedUser,
    id: string,
    status: PaymentRequestStatus,
    action: string,
    note?: string,
  ) {
    const request = await this.prisma.paymentRequest.findFirst({
      where: { id, orgId: user.orgId },
    });
    if (!request) {
      throw new NotFoundException("Payment request not found.");
    }
    this.ensurePaymentRequestActionAccess(user, request, action);

    if (
      status === PaymentRequestStatus.SUBMITTED &&
      request.status !== PaymentRequestStatus.DRAFT
    ) {
      throw new ConflictException(
        "Only draft payment requests can be submitted.",
      );
    }
    if (
      (status === PaymentRequestStatus.APPROVED ||
        status === PaymentRequestStatus.REJECTED) &&
      request.status !== PaymentRequestStatus.SUBMITTED
    ) {
      throw new ConflictException(
        "Only submitted payment requests can be decided.",
      );
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
          status === PaymentRequestStatus.REJECTED
            ? note
            : request.rejectReason,
        approvals:
          status === PaymentRequestStatus.APPROVED ||
          status === PaymentRequestStatus.REJECTED
            ? {
                create: {
                  approverUserId: user.id,
                  action,
                  note,
                },
              }
            : undefined,
      },
      include: { items: true, approvals: true },
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: `payment_request.${action}`,
      entityType: "payment_request",
      entityId: id,
      before: { status: request.status },
      after: { status: updated.status, note },
    });

    return updated;
  }

  private async ensureBillAllocationFits(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    billId: string,
    amount: Prisma.Decimal,
    kind: "invoice" | "receipt",
  ) {
    const bill = await tx.bill.findFirst({
      where: { id: billId, orgId: user.orgId },
      include: {
        invoiceAllocations: { include: { invoice: true } },
        receiptAllocations: { include: { receipt: true } },
      },
    });
    if (!bill) {
      throw new NotFoundException("Bill not found.");
    }
    if (bill.status === "VOIDED") {
      throw new ConflictException("Voided bills cannot be allocated.");
    }
    if (bill.status !== "CUSTOMER_CONFIRMED" && bill.status !== "ADJUSTED") {
      throw new ConflictException(
        "Bill must be customer confirmed before allocation.",
      );
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
            .map((allocation) => allocation.amount),
    );

    if (allocated.plus(amount).greaterThan(bill.totalAmount)) {
      throw new BadRequestException(`${kind} allocation exceeds bill balance.`);
    }
  }

  private async applyPayablePayment(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    payableId: string,
    amount: Prisma.Decimal,
  ) {
    const payable = await tx.payable.findFirst({
      where: { id: payableId, orgId: user.orgId },
    });
    if (!payable) {
      throw new NotFoundException("Payable not found.");
    }
    if (payable.status === PayableStatus.VOIDED) {
      throw new ConflictException("Voided payable cannot be paid.");
    }
    if (payable.customerId) {
      await this.customers.ensureCustomerAccess(user, payable.customerId);
    }
    if (payable.periodMonth) {
      await this.periodLocks.ensureOpen(user.orgId, payable.periodMonth);
    }
    const paidAmount = payable.paidAmount.plus(amount);
    if (paidAmount.greaterThan(payable.amount)) {
      throw new BadRequestException("Payment exceeds payable balance.");
    }
    const status = paidAmount.greaterThanOrEqualTo(payable.amount)
      ? PayableStatus.PAID
      : paidAmount.isZero()
        ? PayableStatus.UNPAID
        : PayableStatus.PARTIALLY_PAID;

    await tx.payable.update({
      where: { id: payableId },
      data: { paidAmount, status },
    });
  }

  private derivePaymentAllocations(
    request: Prisma.PaymentRequestGetPayload<{
      include: {
        items: { include: { payable: true } };
        payments: { include: { allocations: true } };
      };
    }>,
    amount: Prisma.Decimal,
  ): PaymentAllocationInput[] {
    const requestedByPayable = new Map<string, Prisma.Decimal>();
    for (const item of request.items) {
      if (!item.payableId) {
        continue;
      }
      requestedByPayable.set(
        item.payableId,
        (requestedByPayable.get(item.payableId) ?? new Prisma.Decimal(0)).plus(
          item.amount,
        ),
      );
    }

    if (!requestedByPayable.size) {
      return [];
    }

    const paidByPayable = new Map<string, Prisma.Decimal>();
    for (const payment of request.payments) {
      if (payment.status === PaymentStatus.REVERSED) {
        continue;
      }
      for (const allocation of payment.allocations) {
        if (!allocation.payableId) {
          continue;
        }
        paidByPayable.set(
          allocation.payableId,
          (
            paidByPayable.get(allocation.payableId) ?? new Prisma.Decimal(0)
          ).plus(allocation.amount),
        );
      }
    }

    const remainingRequestByPayable = new Map(requestedByPayable);
    for (const [payableId, paidAmount] of paidByPayable) {
      remainingRequestByPayable.set(
        payableId,
        (
          remainingRequestByPayable.get(payableId) ?? new Prisma.Decimal(0)
        ).minus(paidAmount),
      );
    }

    const allocations: PaymentAllocationInput[] = [];
    let remaining = amount;
    for (const item of request.items) {
      if (!item.payableId || !item.payable) {
        continue;
      }

      const requestBalance =
        remainingRequestByPayable.get(item.payableId) ?? new Prisma.Decimal(0);
      const payableBalance = item.payable.amount.minus(item.payable.paidAmount);
      const nextAmount = Prisma.Decimal.min(
        remaining,
        requestBalance,
        payableBalance,
      );
      if (nextAmount.greaterThan(0)) {
        allocations.push({
          payableId: item.payableId,
          amount: nextAmount,
        });
        remaining = remaining.minus(nextAmount);
        remainingRequestByPayable.set(
          item.payableId,
          requestBalance.minus(nextAmount),
        );
      }
      if (remaining.isZero()) {
        break;
      }
    }

    if (remaining.greaterThan(0)) {
      throw new BadRequestException(
        "Payment amount cannot be fully allocated to request payables.",
      );
    }

    return allocations;
  }

  private ensurePaymentAllocationsMatchRequest(
    request: Prisma.PaymentRequestGetPayload<{
      include: {
        items: { include: { payable: true } };
        payments: { include: { allocations: true } };
      };
    }>,
    allocations: PaymentAllocationInput[],
  ) {
    const requestedPayableIds = new Set(
      request.items
        .map((item) => item.payableId)
        .filter((payableId): payableId is string => Boolean(payableId)),
    );
    if (!requestedPayableIds.size) {
      return;
    }

    for (const allocation of allocations) {
      if (
        !allocation.payableId ||
        !requestedPayableIds.has(allocation.payableId)
      ) {
        throw new BadRequestException(
          "Payment allocations must match payables in the payment request.",
        );
      }
    }
  }

  private ensurePaymentRequestActionAccess(
    user: AuthenticatedUser,
    request: {
      applicantUserId: string | null;
      customerId: string | null;
    },
    action: string,
  ) {
    if (
      user.permissions.includes(PERMISSION_CODES.CUSTOMER_READ_ALL) ||
      user.permissions.includes(PERMISSION_CODES.PAYMENT_REQUEST_APPROVE)
    ) {
      return;
    }

    if (
      (action === "submit" || action === "cancel") &&
      request.applicantUserId === user.id
    ) {
      return;
    }

    throw new ForbiddenException(
      "You can only change payment requests that you created.",
    );
  }

  private async reversePayablePayment(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    payableId: string,
    amount: Prisma.Decimal,
  ) {
    const payable = await tx.payable.findFirst({
      where: { id: payableId, orgId: user.orgId },
    });
    if (!payable) {
      throw new NotFoundException("Payable not found.");
    }
    if (payable.customerId) {
      await this.customers.ensureCustomerAccess(user, payable.customerId);
    }
    if (payable.periodMonth) {
      await this.periodLocks.ensureOpen(user.orgId, payable.periodMonth);
    }

    const paidAmount = payable.paidAmount.minus(amount);
    if (paidAmount.lessThan(0)) {
      throw new BadRequestException("Payment reversal exceeds paid amount.");
    }

    const status = paidAmount.greaterThanOrEqualTo(payable.amount)
      ? PayableStatus.PAID
      : paidAmount.isZero()
        ? PayableStatus.UNPAID
        : PayableStatus.PARTIALLY_PAID;

    await tx.payable.update({
      where: { id: payableId },
      data: { paidAmount, status },
    });
  }

  private async ensurePayableRequestFits(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    payableId: string,
    amount: Prisma.Decimal,
  ) {
    const payable = await tx.payable.findFirst({
      where: { id: payableId, orgId: user.orgId },
    });
    if (!payable) {
      throw new NotFoundException("Payable not found.");
    }
    if (payable.status === PayableStatus.VOIDED) {
      throw new ConflictException("Voided payable cannot be requested.");
    }
    if (payable.customerId) {
      await this.customers.ensureCustomerAccess(user, payable.customerId);
    }
    if (payable.periodMonth) {
      await this.periodLocks.ensureOpen(user.orgId, payable.periodMonth);
    }

    const reserved = await tx.paymentRequestItem.aggregate({
      where: {
        payableId,
        request: {
          status: {
            notIn: [
              PaymentRequestStatus.REJECTED,
              PaymentRequestStatus.CANCELLED,
              PaymentRequestStatus.PAID,
            ],
          },
        },
      },
      _sum: { amount: true },
    });
    const available = payable.amount
      .minus(payable.paidAmount)
      .minus(reserved._sum.amount ?? 0);

    if (amount.greaterThan(available)) {
      throw new BadRequestException("Payment request exceeds payable balance.");
    }
  }

  private async ensureContractForCustomer(
    user: AuthenticatedUser,
    customerId: string,
    contractId: string,
  ) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, orgId: user.orgId, customerId },
    });
    if (!contract) {
      throw new NotFoundException("Contract not found for customer.");
    }
  }

  private async ensureExtraChargeCategory(
    user: AuthenticatedUser,
    categoryId?: string,
  ) {
    if (!categoryId) {
      return;
    }

    const category = await this.prisma.extraChargeCategory.findFirst({
      where: { id: categoryId, orgId: user.orgId, isActive: true },
    });
    if (!category) {
      throw new NotFoundException("Extra charge category not found.");
    }
  }

  private async ensureCostCategory(
    user: AuthenticatedUser,
    categoryId?: string,
  ) {
    if (!categoryId) {
      return;
    }

    const category = await this.prisma.costCategory.findFirst({
      where: { id: categoryId, orgId: user.orgId, isActive: true },
    });
    if (!category) {
      throw new NotFoundException("Cost category not found.");
    }
  }

  private attachmentSize(body: Payload) {
    const value = body.sizeBytes;
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    const parsed =
      typeof value === "bigint"
        ? value
        : typeof value === "number" && Number.isInteger(value)
          ? BigInt(value)
          : typeof value === "string" && /^\d+$/.test(value)
            ? BigInt(value)
            : undefined;

    if (parsed === undefined || parsed <= 0n) {
      throw new BadRequestException("sizeBytes must be a positive integer.");
    }

    return parsed;
  }

  private attachmentContractId(ownerType?: string, ownerId?: string) {
    return ownerType === "contract" ? ownerId : undefined;
  }

  private validateContractAttachment(
    ownerType: string | undefined,
    fileName: string,
    contentType: string | undefined,
    sizeBytes: bigint | undefined,
  ) {
    if (ownerType !== "contract") {
      return;
    }

    const normalizedName = fileName.toLowerCase();
    const normalizedContentType = contentType?.toLowerCase();
    if (
      !normalizedName.endsWith(".pdf") ||
      (normalizedContentType !== undefined &&
        normalizedContentType !== "application/pdf")
    ) {
      throw new BadRequestException("Contract attachments must be PDF files.");
    }

    if (sizeBytes === undefined) {
      throw new BadRequestException(
        "Contract attachment sizeBytes is required.",
      );
    }

    if (sizeBytes > CONTRACT_ATTACHMENT_MAX_BYTES) {
      throw new BadRequestException(
        "Contract attachments must be smaller than 20MB.",
      );
    }
  }

  private presentAttachment(attachment: AttachmentRecord) {
    return {
      ...attachment,
      sizeBytes: attachment.sizeBytes?.toString() ?? null,
    };
  }

  private async ensureAttachmentAccess(
    user: AuthenticatedUser,
    attachment: AttachmentRecord,
  ) {
    if (user.permissions.includes(PERMISSION_CODES.CUSTOMER_READ_ALL)) {
      return;
    }

    if (attachment.uploadedById === user.id) {
      return;
    }

    if (attachment.ownerType && attachment.ownerId) {
      await this.ensureAttachmentOwnerAccess(
        user,
        attachment.ownerType,
        attachment.ownerId,
      );
      return;
    }

    throw new ForbiddenException("You can only access your own attachments.");
  }

  private async ensureAttachmentOwnerAccess(
    user: AuthenticatedUser,
    ownerType?: string,
    ownerId?: string,
  ) {
    if (!ownerType && !ownerId) {
      return;
    }
    if (!ownerType || !ownerId) {
      throw new BadRequestException(
        "ownerType and ownerId must be provided together.",
      );
    }
    if (user.permissions.includes(PERMISSION_CODES.CUSTOMER_READ_ALL)) {
      return;
    }

    if (ownerType === "customer") {
      await this.customers.ensureCustomerAccess(user, ownerId);
      return;
    }

    if (ownerType === "contract") {
      const contract = await this.prisma.contract.findFirst({
        where: { id: ownerId, orgId: user.orgId },
      });
      if (!contract) {
        throw new NotFoundException("Contract not found.");
      }
      await this.customers.ensureCustomerAccess(user, contract.customerId);
      return;
    }

    if (ownerType === "bill") {
      const bill = await this.prisma.bill.findFirst({
        where: { id: ownerId, orgId: user.orgId },
      });
      if (!bill) {
        throw new NotFoundException("Bill not found.");
      }
      await this.customers.ensureCustomerAccess(user, bill.customerId);
      return;
    }

    if (ownerType === "cost_entry") {
      const cost = await this.prisma.costEntry.findFirst({
        where: { id: ownerId, orgId: user.orgId },
      });
      if (!cost) {
        throw new NotFoundException("Cost entry not found.");
      }
      await this.customers.ensureCustomerAccess(user, cost.customerId);
      return;
    }

    if (ownerType === "payable") {
      const payable = await this.prisma.payable.findFirst({
        where: { id: ownerId, orgId: user.orgId },
      });
      if (!payable) {
        throw new NotFoundException("Payable not found.");
      }
      if (payable.customerId) {
        await this.customers.ensureCustomerAccess(user, payable.customerId);
      }
      return;
    }

    if (ownerType === "payment_request") {
      const request = await this.prisma.paymentRequest.findFirst({
        where: { id: ownerId, orgId: user.orgId },
      });
      if (!request) {
        throw new NotFoundException("Payment request not found.");
      }
      if (request.applicantUserId !== user.id && request.customerId) {
        await this.customers.ensureCustomerAccess(user, request.customerId);
      }
      return;
    }

    throw new BadRequestException(
      "Unsupported attachment ownerType for this role.",
    );
  }

  private async refreshPaymentRequestStatus(
    tx: Prisma.TransactionClient,
    requestId: string,
  ) {
    const request = await tx.paymentRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { payments: true },
    });
    const paid = sum(
      request.payments
        .filter((payment) => payment.status !== PaymentStatus.REVERSED)
        .map((payment) => payment.amount),
    );
    const status = paid.greaterThanOrEqualTo(request.requestedAmount)
      ? PaymentRequestStatus.PAID
      : paid.greaterThan(0)
        ? PaymentRequestStatus.PARTIALLY_PAID
        : request.status === PaymentRequestStatus.PAID ||
            request.status === PaymentRequestStatus.PARTIALLY_PAID
          ? PaymentRequestStatus.APPROVED
          : request.status;

    await tx.paymentRequest.update({
      where: { id: requestId },
      data: { status },
    });
  }

  private async periodSnapshot(orgId: string, periodMonth: string) {
    const [billSum, costSum, receiptSum, payableOpen] = await Promise.all([
      this.prisma.bill.aggregate({
        where: { orgId, periodMonth, status: { not: "VOIDED" } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      this.prisma.costEntry.aggregate({
        where: { orgId, periodMonth },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.receiptAllocation.aggregate({
        where: {
          bill: { orgId, periodMonth },
          receipt: { status: { not: "REVERSED" } },
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.payable.count({
        where: { orgId, periodMonth, status: { notIn: ["PAID", "VOIDED"] } },
      }),
    ]);

    return {
      billCount: billSum._count,
      billAmount: decimalString(billSum._sum.totalAmount ?? 0),
      costCount: costSum._count,
      costAmount: decimalString(costSum._sum.amount ?? 0),
      receiptAllocationCount: receiptSum._count,
      receiptAmount: decimalString(receiptSum._sum.amount ?? 0),
      openPayableCount: payableOpen,
    };
  }

  private extraChargeKind(body: Payload) {
    const value = stringField(body, "kind", ExtraChargeKind.VALUE_ADDED);
    return value in ExtraChargeKind
      ? (value as ExtraChargeKind)
      : ExtraChargeKind.VALUE_ADDED;
  }
}
