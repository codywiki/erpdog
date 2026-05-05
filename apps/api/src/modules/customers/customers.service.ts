import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CustomerStatus, Prisma } from "@prisma/client";

import { PERMISSION_CODES, type AuthenticatedUser } from "@erpdog/contracts";

import { AuditService } from "../../common/audit/audit.service";
import { ExcelService } from "../../common/excel/excel.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  paginated,
  parsePagination,
  type PaginationQuery,
} from "../../common/utils/pagination";
import {
  arrayField,
  bodyObject,
  booleanField,
  optionalString,
  stringField,
  type Payload,
} from "../../common/utils/payload";

type CustomerFilters = {
  q?: string;
  status?: string;
} & PaginationQuery;

const CUSTOMER_IMPORT_HEADERS = [
  "客户简称",
  "客户全称",
  "状态",
  "行业",
  "来源",
  "负责人邮箱",
  "联系人姓名",
  "联系人职务",
  "联系人电话",
  "联系人邮箱",
  "开票抬头",
  "税号",
  "开户行",
  "银行账号",
  "开票地址",
  "开票电话",
  "备注",
];

const customerCodePrefix = "KH";

@Injectable()
export class CustomersService {
  constructor(
    private readonly audit: AuditService,
    private readonly excel: ExcelService,
    private readonly prisma: PrismaService,
  ) {}

  async list(user: AuthenticatedUser, filters: CustomerFilters) {
    const where: Prisma.CustomerWhereInput = {
      orgId: user.orgId,
      ...(filters.status ? { status: filters.status as CustomerStatus } : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" } },
              { fullName: { contains: filters.q, mode: "insensitive" } },
              { code: { contains: filters.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    if (!this.canReadAll(user)) {
      where.owners = { some: { userId: user.id } };
    }

    const pagination = parsePagination(filters);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        include: this.customerInclude(),
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return paginated(items, total, pagination);
  }

  async get(user: AuthenticatedUser, id: string) {
    await this.ensureCustomerAccess(user, id);

    return this.prisma.customer.findUniqueOrThrow({
      where: { id },
      include: this.customerInclude(),
    });
  }

  async create(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const ownerUserIds = this.ownerIds(body, user);
    this.ensureOwnerAssignmentAllowed(user, ownerUserIds);
    const contacts = arrayField<Payload>(body, "contacts");
    const billingProfiles = arrayField<Payload>(body, "billingProfiles");

    const customer = await this.prisma.$transaction(async (tx) => {
      await this.lockCustomerRegistry(tx, user.orgId);
      await this.ensureUsersInOrg(tx, user.orgId, ownerUserIds);
      const name = stringField(body, "name");
      const fullName = stringField(body, "fullName");
      await this.ensureCustomerUnique(tx, user.orgId, name, fullName);
      const code = await this.nextCustomerCode(tx, user.orgId);
      const created = await tx.customer.create({
        data: {
          orgId: user.orgId,
          code,
          name,
          fullName,
          status: this.status(body),
          industry: optionalString(body, "industry"),
          source: optionalString(body, "source"),
          notes: optionalString(body, "notes"),
          owners: {
            create: ownerUserIds.map((userId, index) => ({
              userId,
              isPrimary: index === 0,
            })),
          },
          contacts: {
            create: contacts.map((contact) => this.contactData(contact)),
          },
          billingProfiles: {
            create: billingProfiles.map((profile) =>
              this.billingProfileData(profile),
            ),
          },
        },
        include: this.customerInclude(),
      });

      await tx.auditLog.create({
        data: {
          orgId: user.orgId,
          actorUserId: user.id,
          action: "customer.create",
          entityType: "customer",
          entityId: created.id,
          after: {
            id: created.id,
            code: created.code,
            name: created.name,
            fullName: created.fullName,
          },
        },
      });

      return created;
    });

    return customer;
  }

  async update(user: AuthenticatedUser, id: string, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const before = await this.ensureCustomerAccess(user, id);
    const name = optionalString(body, "name") ?? before.name;
    const fullName =
      optionalString(body, "fullName") ?? before.fullName ?? before.name;

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.lockCustomerRegistry(tx, user.orgId);
      await this.ensureCustomerUnique(tx, user.orgId, name, fullName, id);

      return tx.customer.update({
        where: { id },
        data: {
          code: before.code,
          name,
          fullName,
          status: this.status(body, before.status),
          industry: optionalString(body, "industry") ?? before.industry,
          source: optionalString(body, "source") ?? before.source,
          notes: optionalString(body, "notes") ?? before.notes,
        },
        include: this.customerInclude(),
      });
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "customer.update",
      entityType: "customer",
      entityId: id,
      before: {
        code: before.code,
        name: before.name,
        fullName: before.fullName,
        status: before.status,
      },
      after: {
        code: updated.code,
        name: updated.name,
        fullName: updated.fullName,
        status: updated.status,
      },
    });

    return updated;
  }

  async remove(user: AuthenticatedUser, id: string) {
    const customer = await this.ensureCustomerAccess(user, id);
    const usage = await this.prisma.$transaction([
      this.prisma.contract.count({ where: { customerId: id } }),
      this.prisma.bill.count({ where: { customerId: id } }),
      this.prisma.extraCharge.count({ where: { customerId: id } }),
      this.prisma.costEntry.count({ where: { customerId: id } }),
      this.prisma.payable.count({ where: { customerId: id } }),
      this.prisma.paymentRequest.count({ where: { customerId: id } }),
      this.prisma.monthlyCustomerMetric.count({ where: { customerId: id } }),
    ]);
    if (usage.some((count) => count > 0)) {
      throw new ConflictException(
        "Customer is already used by business records and cannot be deleted.",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.customer.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          orgId: user.orgId,
          actorUserId: user.id,
          action: "customer.delete",
          entityType: "customer",
          entityId: id,
          before: {
            code: customer.code,
            name: customer.name,
            fullName: customer.fullName,
          },
        },
      });
    });

    return { id, deleted: true };
  }

  async setOwners(
    user: AuthenticatedUser,
    customerId: string,
    rawBody: unknown,
  ) {
    const body = bodyObject(rawBody);
    const before = await this.ensureCustomerAccess(user, customerId);
    if (!this.canReadAll(user)) {
      throw new ForbiddenException(
        "Only organization-wide roles can reassign customer owners.",
      );
    }
    const ownerUserIds = this.ownerIds(body, user);

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.ensureUsersInOrg(tx, user.orgId, ownerUserIds);
      const previousOwners = await tx.customerOwner.findMany({
        where: { customerId },
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: "asc" },
      });

      await tx.customerOwner.deleteMany({ where: { customerId } });
      await tx.customerOwner.createMany({
        data: ownerUserIds.map((userId, index) => ({
          customerId,
          userId,
          isPrimary: index === 0,
        })),
      });

      const nextCustomer = await tx.customer.findUniqueOrThrow({
        where: { id: customerId },
        include: this.customerInclude(),
      });

      await tx.auditLog.create({
        data: {
          orgId: user.orgId,
          actorUserId: user.id,
          action: "customer.owners.set",
          entityType: "customer",
          entityId: customerId,
          before: {
            code: before.code,
            owners: previousOwners.map((owner) => ({
              userId: owner.userId,
              name: owner.user.name,
            })),
          },
          after: {
            code: nextCustomer.code,
            owners: nextCustomer.owners.map((owner) => ({
              userId: owner.userId,
              name: owner.user.name,
            })),
          },
        },
      });

      return nextCustomer;
    });

    return updated;
  }

  async addContact(
    user: AuthenticatedUser,
    customerId: string,
    rawBody: unknown,
  ) {
    await this.ensureCustomerAccess(user, customerId);
    const body = bodyObject(rawBody);

    const contact = await this.prisma.customerContact.create({
      data: {
        customerId,
        ...this.contactData(body),
      },
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "customer.contact.create",
      entityType: "customer",
      entityId: customerId,
      after: { id: contact.id, name: contact.name },
    });

    return contact;
  }

  async addBillingProfile(
    user: AuthenticatedUser,
    customerId: string,
    rawBody: unknown,
  ) {
    await this.ensureCustomerAccess(user, customerId);
    const body = bodyObject(rawBody);

    const profile = await this.prisma.customerBillingProfile.create({
      data: {
        customerId,
        ...this.billingProfileData(body),
      },
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "customer.billing_profile.create",
      entityType: "customer",
      entityId: customerId,
      after: { id: profile.id, title: profile.title },
    });

    return profile;
  }

  async importCustomers(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const rows = arrayField<Payload>(body, "rows");
    const results: Array<{ row: number; id?: string; error?: string }> = [];

    for (const [index, row] of rows.entries()) {
      try {
        const created = await this.create(user, {
          ...row,
          ownerUserIds: arrayField<string>(row, "ownerUserIds"),
        });
        results.push({ row: index + 1, id: created.id });
      } catch (error) {
        results.push({
          row: index + 1,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      total: rows.length,
      succeeded: results.filter((result) => result.id).length,
      failed: results.filter((result) => result.error).length,
      results,
    };
  }

  customerImportTemplate() {
    return this.excel.createWorkbook("customers-import-template.xlsx", [
      {
        name: "客户导入",
        headers: CUSTOMER_IMPORT_HEADERS,
        rows: [],
      },
      {
        name: "字段说明",
        headers: ["字段", "说明"],
        rows: [
          { 字段: "客户编码", 说明: "系统自动生成，导入时无需填写。" },
          { 字段: "客户简称", 说明: "必填，用于列表和业务页面快速识别。" },
          { 字段: "客户全称", 说明: "必填，客户工商或合同正式名称。" },
          {
            字段: "状态",
            说明: "可选：ACTIVE/PAUSED/TERMINATED，或 正常/暂停/终止。",
          },
          {
            字段: "负责人邮箱",
            说明: "可填多个，用逗号、分号或顿号分隔；为空时默认当前导入人。",
          },
          {
            字段: "联系人姓名",
            说明: "可选，填写后会同步创建主联系人。",
          },
          {
            字段: "开票抬头",
            说明: "可选，填写后会同步创建默认开票资料。",
          },
        ],
      },
    ]);
  }

  async importCustomersWorkbook(user: AuthenticatedUser, rawBody: unknown) {
    const rows = (await this.excel.rowsFromBase64(rawBody))
      .map((row, index) => ({ rowNumber: index + 2, row }))
      .filter(({ row }) => !this.isEmptyImportRow(row));
    const results: Array<{ row: number; id?: string; error?: string }> = [];

    for (const { rowNumber, row } of rows) {
      try {
        const payload = await this.customerImportPayload(user, row);
        const created = await this.create(user, payload);
        results.push({ row: rowNumber, id: created.id });
      } catch (error) {
        results.push({
          row: rowNumber,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      total: rows.length,
      succeeded: results.filter((result) => result.id).length,
      failed: results.filter((result) => result.error).length,
      results,
    };
  }

  async ensureCustomerAccess(user: AuthenticatedUser, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        orgId: user.orgId,
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found.");
    }

    if (this.canReadAll(user)) {
      return customer;
    }

    const owner = await this.prisma.customerOwner.findUnique({
      where: {
        customerId_userId: {
          customerId,
          userId: user.id,
        },
      },
    });

    if (!owner) {
      throw new ForbiddenException("You can only access your own customers.");
    }

    return customer;
  }

  private canReadAll(user: AuthenticatedUser) {
    return user.permissions.includes(PERMISSION_CODES.CUSTOMER_READ_ALL);
  }

  private customerInclude() {
    return {
      contacts: true,
      billingProfiles: true,
      owners: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
    } satisfies Prisma.CustomerInclude;
  }

  private ownerIds(body: Payload, user: AuthenticatedUser) {
    const requested = Array.from(
      new Set(
        arrayField<unknown>(body, "ownerUserIds")
          .map((id) => (typeof id === "string" ? id.trim() : ""))
          .filter(Boolean),
      ),
    );
    return requested.length ? requested : [user.id];
  }

  private ensureOwnerAssignmentAllowed(
    user: AuthenticatedUser,
    ownerUserIds: string[],
  ) {
    if (this.canReadAll(user)) {
      return;
    }

    if (ownerUserIds.length !== 1 || ownerUserIds[0] !== user.id) {
      throw new ForbiddenException(
        "You can only assign yourself as owner when creating customers.",
      );
    }
  }

  private async ensureUsersInOrg(
    tx: Prisma.TransactionClient,
    orgId: string,
    userIds: string[],
  ) {
    if (!userIds.length) {
      throw new BadRequestException("ownerUserIds is required.");
    }

    const users = await tx.user.findMany({
      where: { orgId, id: { in: userIds }, isActive: true },
      select: { id: true },
    });
    if (users.length !== userIds.length) {
      throw new BadRequestException(
        "All ownerUserIds must be active users in this organization.",
      );
    }
  }

  private status(
    body: Payload,
    fallback: CustomerStatus = CustomerStatus.ACTIVE,
  ): CustomerStatus {
    const value = optionalString(body, "status");
    return value && value in CustomerStatus
      ? (value as CustomerStatus)
      : fallback;
  }

  private contactData(body: Payload) {
    return {
      name: stringField(body, "name"),
      title: optionalString(body, "title"),
      phone: optionalString(body, "phone"),
      email: optionalString(body, "email"),
      address: optionalString(body, "address"),
      isPrimary: booleanField(body, "isPrimary"),
    };
  }

  private billingProfileData(body: Payload) {
    return {
      title: stringField(body, "title"),
      taxNumber: optionalString(body, "taxNumber"),
      bankName: optionalString(body, "bankName"),
      bankAccount: optionalString(body, "bankAccount"),
      address: optionalString(body, "address"),
      phone: optionalString(body, "phone"),
      isDefault: booleanField(body, "isDefault"),
    };
  }

  private async customerImportPayload(
    user: AuthenticatedUser,
    row: Record<string, unknown>,
  ): Promise<Payload> {
    const ownerEmails = this.splitList(
      this.cell(row, ["负责人邮箱", "ownerEmails", "Owner Emails"]),
    );
    const ownerUserIds = ownerEmails.length
      ? await this.resolveOwnerUserIds(user, ownerEmails)
      : [];
    const contactName = this.cell(row, ["联系人姓名", "contactName"]);
    const billingTitle = this.cell(row, ["开票抬头", "billingTitle"]);

    return {
      name: this.cell(row, ["客户简称", "客户名称", "name", "Name"]),
      fullName: this.cell(row, [
        "客户全称",
        "客户名称",
        "fullName",
        "Full Name",
      ]),
      status: this.customerStatusFromCell(this.cell(row, ["状态", "status"])),
      industry: this.cell(row, ["行业", "industry"]),
      source: this.cell(row, ["来源", "source"]),
      notes: this.cell(row, ["备注", "notes"]),
      ownerUserIds,
      contacts: contactName
        ? [
            {
              name: contactName,
              title: this.cell(row, ["联系人职务", "contactTitle"]),
              phone: this.cell(row, ["联系人电话", "contactPhone"]),
              email: this.cell(row, ["联系人邮箱", "contactEmail"]),
              isPrimary: true,
            },
          ]
        : [],
      billingProfiles: billingTitle
        ? [
            {
              title: billingTitle,
              taxNumber: this.cell(row, ["税号", "taxNumber"]),
              bankName: this.cell(row, ["开户行", "bankName"]),
              bankAccount: this.cell(row, ["银行账号", "bankAccount"]),
              address: this.cell(row, ["开票地址", "billingAddress"]),
              phone: this.cell(row, ["开票电话", "billingPhone"]),
              isDefault: true,
            },
          ]
        : [],
    };
  }

  private async resolveOwnerUserIds(
    user: AuthenticatedUser,
    ownerEmails: string[],
  ) {
    const users = await this.prisma.user.findMany({
      where: {
        orgId: user.orgId,
        email: { in: ownerEmails.map((email) => email.toLowerCase()) },
        isActive: true,
      },
      select: { id: true, email: true },
    });
    const byEmail = new Map(
      users.map((owner) => [owner.email.toLowerCase(), owner.id]),
    );
    const missing = ownerEmails.filter(
      (email) => !byEmail.has(email.toLowerCase()),
    );
    if (missing.length) {
      throw new BadRequestException(
        `Owner email not found in organization: ${missing.join(", ")}`,
      );
    }
    return ownerEmails.map((email) => byEmail.get(email.toLowerCase())!);
  }

  private customerStatusFromCell(value?: string) {
    if (!value) {
      return undefined;
    }

    const normalized = value.trim().toUpperCase();
    const aliases: Record<string, CustomerStatus> = {
      ACTIVE: CustomerStatus.ACTIVE,
      NORMAL: CustomerStatus.ACTIVE,
      PAUSED: CustomerStatus.PAUSED,
      TERMINATED: CustomerStatus.TERMINATED,
      正常: CustomerStatus.ACTIVE,
      启用: CustomerStatus.ACTIVE,
      暂停: CustomerStatus.PAUSED,
      终止: CustomerStatus.TERMINATED,
      停用: CustomerStatus.TERMINATED,
    };

    return aliases[normalized] ?? CustomerStatus.ACTIVE;
  }

  private splitList(value?: string) {
    return Array.from(
      new Set(
        (value ?? "")
          .split(/[,;，；、]/)
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
  }

  private cell(row: Record<string, unknown>, aliases: string[]) {
    for (const alias of aliases) {
      const value = row[alias];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
      if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
      }
    }

    return undefined;
  }

  private isEmptyImportRow(row: Record<string, unknown>) {
    return Object.values(row).every((value) => {
      if (value === null || value === undefined) {
        return true;
      }
      return String(value).trim() === "";
    });
  }

  private async ensureCustomerUnique(
    tx: PrismaService | Prisma.TransactionClient,
    orgId: string,
    name: string,
    fullName: string,
    excludeId?: string,
  ) {
    const duplicate = await tx.customer.findFirst({
      where: {
        orgId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [
          { name: { equals: name, mode: "insensitive" } },
          { fullName: { equals: fullName, mode: "insensitive" } },
          { name: { equals: fullName, mode: "insensitive" } },
          { fullName: { equals: name, mode: "insensitive" } },
        ],
      },
      select: { code: true, name: true, fullName: true },
    });

    if (duplicate) {
      throw new ConflictException(
        `Customer already exists: ${duplicate.fullName ?? duplicate.name}.`,
      );
    }
  }

  private async lockCustomerRegistry(
    tx: Prisma.TransactionClient,
    orgId: string,
  ) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`customer-registry:${orgId}`}))`;
  }

  private async nextCustomerCode(tx: Prisma.TransactionClient, orgId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`customer-code:${orgId}:${customerCodePrefix}`}))`;
    const existing = await tx.customer.findMany({
      where: { orgId, code: { startsWith: customerCodePrefix } },
      select: { code: true },
    });
    const nextNumber =
      existing.reduce((max, item) => {
        const match = new RegExp(`^${customerCodePrefix}(\\d+)$`).exec(
          item.code,
        );
        return match?.[1] ? Math.max(max, Number(match[1])) : max;
      }, 0) + 1;

    return `${customerCodePrefix}${nextNumber.toString().padStart(3, "0")}`;
  }
}
