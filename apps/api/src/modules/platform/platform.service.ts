import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ExtraChargeKind, Prisma } from "@prisma/client";

import {
  PERMISSION_CODES,
  ROLE_CODES,
  type AuthenticatedUser,
} from "@erpdog/contracts";

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
import { PasswordService } from "../auth/password.service";

const platformUserInclude = {
  org: {
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
      isPlatform: true,
    },
  },
  userRoles: {
    include: {
      role: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
    orderBy: {
      role: { code: "asc" },
    },
  },
} satisfies Prisma.UserInclude;

const tenantInclude = {
  users: {
    where: { isActive: true },
    include: platformUserInclude,
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  },
} satisfies Prisma.OrganizationInclude;

type PlatformUser = Prisma.UserGetPayload<{
  include: typeof platformUserInclude;
}>;

type TenantWithUsers = Prisma.OrganizationGetPayload<{
  include: typeof tenantInclude;
}>;

const tenantPermissionCodes = Object.values(PERMISSION_CODES).filter(
  (code) => code !== PERMISSION_CODES.TENANT_MANAGE,
);

const tenantRoleDefinitions = [
  {
    code: ROLE_CODES.ADMIN,
    name: "租户管理员",
    permissions: tenantPermissionCodes,
  },
  {
    code: ROLE_CODES.OWNER,
    name: "总负责人",
    permissions: [
      PERMISSION_CODES.CUSTOMER_READ_ALL,
      PERMISSION_CODES.CUSTOMER_WRITE,
      PERMISSION_CODES.CONTRACT_WRITE,
      PERMISSION_CODES.BILL_MANAGE,
      PERMISSION_CODES.BILL_APPROVE,
      PERMISSION_CODES.RECEIVABLE_SETTLE,
      PERMISSION_CODES.INVOICE_MANAGE,
      PERMISSION_CODES.RECEIPT_MANAGE,
      PERMISSION_CODES.COST_MANAGE,
      PERMISSION_CODES.PAYABLE_SETTLE,
      PERMISSION_CODES.PAYMENT_REQUEST_CREATE,
      PERMISSION_CODES.PAYMENT_REQUEST_APPROVE,
      PERMISSION_CODES.PAYMENT_PAY,
      PERMISSION_CODES.PERIOD_CLOSE,
      PERMISSION_CODES.PERIOD_REOPEN,
      PERMISSION_CODES.USER_MANAGE,
      PERMISSION_CODES.REPORT_VIEW,
      PERMISSION_CODES.AUDIT_VIEW,
    ],
  },
  {
    code: ROLE_CODES.FINANCE,
    name: "财务",
    permissions: [
      PERMISSION_CODES.CUSTOMER_READ_ALL,
      PERMISSION_CODES.BILL_MANAGE,
      PERMISSION_CODES.RECEIVABLE_SETTLE,
      PERMISSION_CODES.INVOICE_MANAGE,
      PERMISSION_CODES.RECEIPT_MANAGE,
      PERMISSION_CODES.COST_MANAGE,
      PERMISSION_CODES.PAYABLE_SETTLE,
      PERMISSION_CODES.PAYMENT_REQUEST_CREATE,
      PERMISSION_CODES.PAYMENT_PAY,
      PERMISSION_CODES.PERIOD_CLOSE,
      PERMISSION_CODES.REPORT_VIEW,
    ],
  },
  {
    code: ROLE_CODES.BUSINESS_OWNER,
    name: "业务负责人",
    permissions: [
      PERMISSION_CODES.CUSTOMER_READ_OWN,
      PERMISSION_CODES.CUSTOMER_WRITE,
      PERMISSION_CODES.CONTRACT_WRITE,
      PERMISSION_CODES.BILL_MANAGE,
      PERMISSION_CODES.COST_MANAGE,
      PERMISSION_CODES.PAYMENT_REQUEST_CREATE,
    ],
  },
];

const extraChargeCategories = [
  { code: "value-added", name: "增值服务", kind: ExtraChargeKind.VALUE_ADDED },
  {
    code: "advance-payment",
    name: "代垫费用",
    kind: ExtraChargeKind.ADVANCE_PAYMENT,
  },
];

const costCategories = [
  { code: "labor", name: "人工成本" },
  { code: "outsourcing", name: "外包服务" },
  { code: "advance-payment", name: "代垫支出" },
  { code: "software", name: "软件和工具" },
  { code: "other", name: "其他成本" },
];

@Injectable()
export class PlatformService {
  constructor(
    private readonly password: PasswordService,
    private readonly prisma: PrismaService,
  ) {}

  async listSuperAdmins(
    user: AuthenticatedUser,
    paginationQuery: PaginationQuery,
  ) {
    this.ensureSuperAdmin(user);
    const pagination = parsePagination(paginationQuery);
    const where: Prisma.UserWhereInput = {
      userRoles: {
        some: {
          role: { code: ROLE_CODES.SUPER_ADMIN },
        },
      },
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: platformUserInclude,
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginated(
      items.map((item) => this.presentUser(item)),
      total,
      pagination,
    );
  }

  async createSuperAdmin(user: AuthenticatedUser, rawBody: unknown) {
    this.ensureSuperAdmin(user);
    const body = bodyObject(rawBody);
    const name = stringField(body, "name");
    const phone = this.phoneField(body, "phone");
    const password = stringField(body, "password");
    this.ensurePasswordConfirmed(body, password);

    return this.prisma.$transaction(async (tx) => {
      await this.ensurePhoneAvailable(tx, phone);
      const platformOrg = await this.ensurePlatformOrg(tx);
      const role = await this.ensurePlatformRole(tx, platformOrg.id);
      const created = await tx.user.create({
        data: {
          orgId: platformOrg.id,
          email: this.generatedEmail(phone, "super"),
          phone,
          name,
          passwordHash: await this.password.hash(password),
          isActive: true,
          userRoles: {
            create: [{ roleId: role.id }],
          },
        },
        include: platformUserInclude,
      });
      await this.writePlatformAudit(
        tx,
        user,
        "super_admin.create",
        created.id,
        {
          name,
          phone,
        },
      );
      return this.presentUser(created);
    });
  }

  async updateSuperAdmin(
    user: AuthenticatedUser,
    id: string,
    rawBody: unknown,
  ) {
    this.ensureSuperAdmin(user);
    const body = bodyObject(rawBody);
    const before = await this.findSuperAdminOrThrow(id);
    const nextPhone = optionalString(body, "phone");
    if (nextPhone && nextPhone !== before.phone) {
      this.ensurePhone(nextPhone);
      await this.ensurePhoneAvailable(this.prisma, nextPhone, id);
    }
    const nextIsActive = booleanField(body, "isActive", before.isActive);
    if (id === user.id && !nextIsActive) {
      throw new ConflictException("You cannot deactivate your own account.");
    }
    const nextPassword = optionalString(body, "password");
    if (nextPassword) {
      this.ensurePasswordConfirmed(body, nextPassword);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextName = optionalString(body, "name") ?? before.name;
      const phone = nextPhone ?? before.phone;
      const result = await tx.user.update({
        where: { id },
        data: {
          name: nextName,
          phone,
          email:
            nextPhone && nextPhone !== before.phone
              ? this.generatedEmail(nextPhone, "super")
              : before.email,
          passwordHash: nextPassword
            ? await this.password.hash(nextPassword)
            : before.passwordHash,
          isActive: nextIsActive,
        },
        include: platformUserInclude,
      });
      await this.writePlatformAudit(tx, user, "super_admin.update", id, {
        name: nextName,
        phone,
        isActive: nextIsActive,
      });
      return result;
    });

    return this.presentUser(updated);
  }

  async deleteSuperAdmin(user: AuthenticatedUser, id: string) {
    this.ensureSuperAdmin(user);
    if (id === user.id) {
      throw new ConflictException("You cannot delete your own account.");
    }
    await this.findSuperAdminOrThrow(id);
    const activeCount = await this.prisma.user.count({
      where: {
        isActive: true,
        userRoles: {
          some: {
            role: { code: ROLE_CODES.SUPER_ADMIN },
          },
        },
      },
    });
    if (activeCount <= 1) {
      throw new ConflictException(
        "At least one active super admin is required.",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.delete({ where: { id } });
      await this.writePlatformAudit(tx, user, "super_admin.delete", id);
    });

    return { id, deleted: true };
  }

  async listTenants(user: AuthenticatedUser, paginationQuery: PaginationQuery) {
    this.ensureSuperAdmin(user);
    const pagination = parsePagination(paginationQuery);
    const where: Prisma.OrganizationWhereInput = {
      isPlatform: false,
      isActive: true,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({
        where,
        include: tenantInclude,
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.organization.count({ where }),
    ]);

    return paginated(
      items.map((item) => this.presentTenant(item)),
      total,
      pagination,
    );
  }

  async createTenant(user: AuthenticatedUser, rawBody: unknown) {
    this.ensureSuperAdmin(user);
    const body = bodyObject(rawBody);
    const name = stringField(body, "tenantName");
    const adminName = stringField(body, "adminName");
    const phone = this.phoneField(body, "phone");
    const password = stringField(body, "password");
    this.ensurePasswordConfirmed(body, password);

    const created = await this.prisma.$transaction(async (tx) => {
      await this.ensurePhoneAvailable(tx, phone);
      const tenant = await tx.organization.create({
        data: {
          code: await this.nextTenantCode(tx, name),
          name,
          isPlatform: false,
          isActive: true,
        },
      });
      await this.ensureTenantRoles(tx, tenant.id);
      await this.ensureTenantCatalogs(tx, tenant.id);
      const adminRole = await tx.role.findUniqueOrThrow({
        where: {
          orgId_code: {
            orgId: tenant.id,
            code: ROLE_CODES.ADMIN,
          },
        },
      });
      await tx.user.create({
        data: {
          orgId: tenant.id,
          email: this.generatedEmail(phone, "tenant"),
          phone,
          name: adminName,
          passwordHash: await this.password.hash(password),
          isActive: true,
          userRoles: {
            create: [{ roleId: adminRole.id }],
          },
        },
      });
      await this.writePlatformAudit(tx, user, "tenant.create", tenant.id, {
        name,
        adminName,
        phone,
      });
      return tx.organization.findUniqueOrThrow({
        where: { id: tenant.id },
        include: tenantInclude,
      });
    });

    return this.presentTenant(created);
  }

  async updateTenant(user: AuthenticatedUser, id: string, rawBody: unknown) {
    this.ensureSuperAdmin(user);
    const body = bodyObject(rawBody);
    const before = await this.prisma.organization.findFirst({
      where: { id, isPlatform: false, isActive: true },
    });
    if (!before) {
      throw new NotFoundException("Tenant not found.");
    }
    const name = optionalString(body, "tenantName") ?? before.name;
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.organization.update({
        where: { id },
        data: { name },
        include: tenantInclude,
      });
      await this.writePlatformAudit(tx, user, "tenant.update", id, { name });
      return result;
    });

    return this.presentTenant(updated);
  }

  async deleteTenant(user: AuthenticatedUser, id: string) {
    this.ensureSuperAdmin(user);
    const before = await this.prisma.organization.findFirst({
      where: { id, isPlatform: false, isActive: true },
    });
    if (!before) {
      throw new NotFoundException("Tenant not found.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id },
        data: { isActive: false },
      });
      await tx.user.updateMany({
        where: { orgId: id },
        data: { isActive: false },
      });
      await this.writePlatformAudit(tx, user, "tenant.delete", id, {
        name: before.name,
      });
    });

    return { id, deleted: true };
  }

  async updateTenantUser(
    user: AuthenticatedUser,
    tenantId: string,
    userId: string,
    rawBody: unknown,
  ) {
    this.ensureSuperAdmin(user);
    const body = bodyObject(rawBody);
    const before = await this.findTenantUserOrThrow(tenantId, userId);
    const nextPhone = optionalString(body, "phone");
    if (nextPhone && nextPhone !== before.phone) {
      this.ensurePhone(nextPhone);
      await this.ensurePhoneAvailable(this.prisma, nextPhone, userId);
    }
    const nextPassword = optionalString(body, "password");
    if (nextPassword) {
      this.ensurePasswordConfirmed(body, nextPassword);
    }
    const hasRoleUpdate = Array.isArray(body.roleCodes);
    const roleCodes = hasRoleUpdate
      ? this.roleCodes(body)
      : before.userRoles.map((item) => item.role.code);

    const updated = await this.prisma.$transaction(async (tx) => {
      const roles = hasRoleUpdate
        ? await this.resolveTenantRoles(tx, tenantId, roleCodes)
        : [];
      await tx.user.update({
        where: { id: userId },
        data: {
          name: optionalString(body, "name") ?? before.name,
          phone: nextPhone ?? before.phone,
          email:
            nextPhone && nextPhone !== before.phone
              ? this.generatedEmail(nextPhone, "user")
              : before.email,
          passwordHash: nextPassword
            ? await this.password.hash(nextPassword)
            : before.passwordHash,
          isActive: booleanField(body, "isActive", before.isActive),
        },
      });
      if (hasRoleUpdate) {
        await tx.userRole.deleteMany({ where: { userId } });
        await tx.userRole.createMany({
          data: roles.map((role) => ({ userId, roleId: role.id })),
        });
      }
      await this.writePlatformAudit(tx, user, "tenant_user.update", userId, {
        tenantId,
        roleCodes,
      });
      return tx.user.findUniqueOrThrow({
        where: { id: userId },
        include: platformUserInclude,
      });
    });

    return this.presentUser(updated);
  }

  async deleteTenantUser(
    user: AuthenticatedUser,
    tenantId: string,
    userId: string,
  ) {
    this.ensureSuperAdmin(user);
    await this.findTenantUserOrThrow(tenantId, userId);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { isActive: false },
      });
      await this.writePlatformAudit(tx, user, "tenant_user.delete", userId, {
        tenantId,
      });
    });

    return { id: userId, deleted: true };
  }

  private ensureSuperAdmin(user: AuthenticatedUser) {
    if (user.roles.includes(ROLE_CODES.SUPER_ADMIN)) {
      return;
    }

    throw new ForbiddenException("You cannot manage tenants.");
  }

  private async ensurePlatformOrg(tx: Prisma.TransactionClient) {
    return tx.organization.upsert({
      where: { code: "platform" },
      update: { isPlatform: true, isActive: true },
      create: {
        code: "platform",
        name: "平台管理",
        isPlatform: true,
        isActive: true,
      },
    });
  }

  private async ensurePlatformRole(
    tx: Prisma.TransactionClient,
    orgId: string,
  ) {
    await this.ensurePermissions(tx, [PERMISSION_CODES.TENANT_MANAGE]);
    const role = await tx.role.upsert({
      where: {
        orgId_code: {
          orgId,
          code: ROLE_CODES.SUPER_ADMIN,
        },
      },
      update: { name: "超级管理员", isSystem: true },
      create: {
        orgId,
        code: ROLE_CODES.SUPER_ADMIN,
        name: "超级管理员",
        isSystem: true,
      },
    });
    const permission = await tx.permission.findUniqueOrThrow({
      where: { code: PERMISSION_CODES.TENANT_MANAGE },
    });
    await tx.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
    return role;
  }

  private async ensureTenantRoles(tx: Prisma.TransactionClient, orgId: string) {
    await this.ensurePermissions(tx, tenantPermissionCodes);
    for (const definition of tenantRoleDefinitions) {
      const role = await tx.role.upsert({
        where: {
          orgId_code: {
            orgId,
            code: definition.code,
          },
        },
        update: { name: definition.name, isSystem: true },
        create: {
          orgId,
          code: definition.code,
          name: definition.name,
          isSystem: true,
        },
      });
      const permissions = await tx.permission.findMany({
        where: { code: { in: definition.permissions } },
      });
      await tx.rolePermission.deleteMany({
        where: {
          roleId: role.id,
          permissionId: {
            notIn: permissions.map((permission) => permission.id),
          },
        },
      });
      await tx.rolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId: role.id,
          permissionId: permission.id,
        })),
        skipDuplicates: true,
      });
    }
  }

  private async ensureTenantCatalogs(
    tx: Prisma.TransactionClient,
    orgId: string,
  ) {
    for (const category of extraChargeCategories) {
      await tx.extraChargeCategory.upsert({
        where: {
          orgId_code: {
            orgId,
            code: category.code,
          },
        },
        update: {
          name: category.name,
          kind: category.kind,
          isActive: true,
        },
        create: {
          orgId,
          code: category.code,
          name: category.name,
          kind: category.kind,
          isActive: true,
        },
      });
    }

    for (const category of costCategories) {
      await tx.costCategory.upsert({
        where: {
          orgId_code: {
            orgId,
            code: category.code,
          },
        },
        update: {
          name: category.name,
          isActive: true,
        },
        create: {
          orgId,
          code: category.code,
          name: category.name,
          isActive: true,
        },
      });
    }
  }

  private async ensurePermissions(
    tx: Prisma.TransactionClient,
    codes: string[],
  ) {
    for (const code of codes) {
      await tx.permission.upsert({
        where: { code },
        update: {},
        create: { code, name: code },
      });
    }
  }

  private async nextTenantCode(tx: Prisma.TransactionClient, name: string) {
    const base =
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 24) || "tenant";
    let code = base;
    let index = 1;
    while (await tx.organization.findUnique({ where: { code } })) {
      index += 1;
      code = `${base}-${index}`;
    }
    return code;
  }

  private roleCodes(body: Payload) {
    const roleCodes = Array.from(
      new Set(
        arrayField<unknown>(body, "roleCodes")
          .map((code) => (typeof code === "string" ? code.trim() : ""))
          .filter(Boolean),
      ),
    );
    if (!roleCodes.length) {
      throw new BadRequestException("roleCodes is required.");
    }
    return roleCodes;
  }

  private async resolveTenantRoles(
    tx: Prisma.TransactionClient,
    orgId: string,
    roleCodes: string[],
  ) {
    const roles = await tx.role.findMany({
      where: { orgId, code: { in: roleCodes } },
    });
    if (roles.length !== roleCodes.length) {
      throw new BadRequestException("One or more roles are invalid.");
    }
    return roles;
  }

  private async findSuperAdminOrThrow(id: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        userRoles: {
          some: {
            role: { code: ROLE_CODES.SUPER_ADMIN },
          },
        },
      },
      include: platformUserInclude,
    });
    if (!user) {
      throw new NotFoundException("Super admin not found.");
    }
    return user;
  }

  private async findTenantUserOrThrow(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        orgId: tenantId,
        org: { isPlatform: false, isActive: true },
      },
      include: platformUserInclude,
    });
    if (!user) {
      throw new NotFoundException("Tenant user not found.");
    }
    return user;
  }

  private async ensurePhoneAvailable(
    tx: Prisma.TransactionClient | PrismaService,
    phone: string,
    exceptUserId?: string,
  ) {
    const existing = await tx.user.findUnique({ where: { phone } });
    if (existing && existing.id !== exceptUserId) {
      throw new ConflictException("Phone already exists.");
    }
  }

  private phoneField(body: Payload, field: string) {
    const phone = stringField(body, field);
    this.ensurePhone(phone);
    return phone;
  }

  private ensurePhone(phone: string) {
    if (!/^[0-9+\-\s]{6,30}$/.test(phone)) {
      throw new BadRequestException("phone must be valid.");
    }
  }

  private ensurePasswordConfirmed(body: Payload, password: string) {
    if (password.length < 10) {
      throw new BadRequestException("password must be at least 10 characters.");
    }
    const confirmPassword = stringField(body, "confirmPassword");
    if (confirmPassword !== password) {
      throw new BadRequestException("confirmPassword must match password.");
    }
  }

  private generatedEmail(phone: string, prefix: string) {
    const normalized = phone.replace(/\D/g, "") || "account";
    return `${prefix}-${normalized}@phone.erpdog.local`;
  }

  private async writePlatformAudit(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    action: string,
    entityId: string,
    after?: unknown,
  ) {
    await tx.auditLog.create({
      data: {
        orgId: user.orgId,
        actorUserId: user.id,
        action,
        entityType: "platform",
        entityId,
        after: after as Prisma.InputJsonValue,
      },
    });
  }

  private presentTenant(tenant: TenantWithUsers) {
    return {
      id: tenant.id,
      code: tenant.code,
      name: tenant.name,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
      users: tenant.users.map((item) => this.presentUser(item)),
    };
  }

  private presentUser(user: PlatformUser) {
    return {
      id: user.id,
      orgId: user.orgId,
      org: user.org,
      email: user.email,
      phone: user.phone,
      name: user.name,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: user.userRoles.map((userRole) => ({
        id: userRole.role.id,
        code: userRole.role.code,
        name: userRole.role.name,
      })),
    };
  }
}
