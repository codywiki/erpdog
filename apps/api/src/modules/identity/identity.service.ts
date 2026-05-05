import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

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

const userInclude = {
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

const ownerManagedRoleCodes: Set<string> = new Set([
  ROLE_CODES.BUSINESS_OWNER,
  ROLE_CODES.FINANCE,
]);

const tenantAdminManagedRoleCodes: Set<string> = new Set([
  ROLE_CODES.OWNER,
  ROLE_CODES.BUSINESS_OWNER,
  ROLE_CODES.FINANCE,
]);

const tenantAdminGrantablePermissionCodes: Set<string> = new Set(
  Object.values(PERMISSION_CODES).filter(
    (code) => code !== PERMISSION_CODES.TENANT_MANAGE,
  ),
);

const ownerGrantablePermissionCodes: Set<string> = new Set([
  PERMISSION_CODES.CUSTOMER_READ_ALL,
  PERMISSION_CODES.CUSTOMER_READ_OWN,
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
  PERMISSION_CODES.REPORT_VIEW,
]);

type UserWithRoles = Prisma.UserGetPayload<{
  include: typeof userInclude;
}>;

@Injectable()
export class IdentityService {
  constructor(
    private readonly password: PasswordService,
    private readonly prisma: PrismaService,
  ) {}

  async listUsers(user: AuthenticatedUser, paginationQuery: PaginationQuery) {
    this.ensureIdentityManagementAccess(user);
    const pagination = parsePagination(paginationQuery);
    const where: Prisma.UserWhereInput = { orgId: user.orgId };
    if (this.canManageTenantDelegatedRolesOnly(user)) {
      where.OR = [
        { id: user.id },
        {
          userRoles: {
            every: {
              role: { code: { in: Array.from(tenantAdminManagedRoleCodes) } },
            },
          },
        },
      ];
    } else if (this.canManageOwnerDelegatedRolesOnly(user)) {
      where.OR = [
        { id: user.id },
        {
          userRoles: {
            every: {
              role: { code: { in: Array.from(ownerManagedRoleCodes) } },
            },
          },
        },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: this.userInclude(),
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

  async createUser(user: AuthenticatedUser, rawBody: unknown) {
    this.ensureIdentityManagementAccess(user);
    const body = bodyObject(rawBody);
    const account = this.userAccountFields(body);
    await this.ensureEmailAvailable(account.email);
    await this.ensurePhoneAvailable(account.phone);

    const roleCodes = this.roleCodes(body);
    this.ensureRoleManagementAccess(user, roleCodes);
    const password = stringField(body, "password");
    this.ensurePassword(password);
    const created = await this.prisma.$transaction(async (tx) => {
      const roles = await this.resolveRoles(tx, user.orgId, roleCodes);
      const nextUser = await tx.user.create({
        data: {
          orgId: user.orgId,
          email: account.email,
          phone: account.phone,
          name: stringField(body, "name"),
          passwordHash: await this.password.hash(password),
          isActive: booleanField(body, "isActive", true),
          userRoles: {
            create: roles.map((role) => ({ roleId: role.id })),
          },
        },
        include: this.userInclude(),
      });

      await tx.auditLog.create({
        data: {
          orgId: user.orgId,
          actorUserId: user.id,
          action: "user.create",
          entityType: "user",
          entityId: nextUser.id,
          after: {
            email: nextUser.email,
            phone: nextUser.phone,
            name: nextUser.name,
            roles: roleCodes,
          },
        },
      });

      return nextUser;
    });

    return this.presentUser(created);
  }

  async updateUser(user: AuthenticatedUser, id: string, rawBody: unknown) {
    this.ensureIdentityManagementAccess(user);
    const body = bodyObject(rawBody);
    const before = await this.prisma.user.findFirst({
      where: { id, orgId: user.orgId },
      include: this.userInclude(),
    });
    if (!before) {
      throw new NotFoundException("User not found.");
    }

    const account = this.userAccountFields(body, before);
    await this.ensureEmailAvailable(account.email, before.id);
    await this.ensurePhoneAvailable(account.phone, before.id);

    const hasRoleUpdate = Array.isArray(body.roleCodes);
    const isSelfUpdate = id === user.id;
    if (isSelfUpdate && hasRoleUpdate) {
      throw new ConflictException("You cannot change your own roles.");
    }

    const beforeRoleCodes = this.roleCodesForUser(before);
    if (!isSelfUpdate) {
      this.ensureRoleManagementAccess(user, beforeRoleCodes);
    }
    const roleCodes = hasRoleUpdate ? this.roleCodes(body) : beforeRoleCodes;
    if (hasRoleUpdate) {
      this.ensureRoleManagementAccess(user, roleCodes);
    }
    const nextIsActive = booleanField(body, "isActive", before.isActive);
    if (isSelfUpdate && !nextIsActive) {
      throw new ConflictException("You cannot deactivate your own account.");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const roles = hasRoleUpdate
        ? await this.resolveRoles(tx, user.orgId, roleCodes)
        : [];
      await tx.user.update({
        where: { id },
        data: {
          email: account.email,
          phone: account.phone,
          name: optionalString(body, "name") ?? before.name,
          passwordHash:
            optionalString(body, "password") !== undefined
              ? await this.hashCheckedPassword(body)
              : before.passwordHash,
          isActive: nextIsActive,
        },
      });

      if (hasRoleUpdate) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({
          data: roles.map((role) => ({ userId: id, roleId: role.id })),
        });
      }

      await tx.auditLog.create({
        data: {
          orgId: user.orgId,
          actorUserId: user.id,
          action: "user.update",
          entityType: "user",
          entityId: id,
          before: this.auditUser(before),
          after: {
            email: account.email,
            phone: account.phone,
            name: optionalString(body, "name") ?? before.name,
            isActive: nextIsActive,
            roles: roleCodes,
          },
        },
      });

      return tx.user.findUniqueOrThrow({
        where: { id },
        include: this.userInclude(),
      });
    });

    return this.presentUser(updated);
  }

  listRoles(user: AuthenticatedUser) {
    this.ensureIdentityManagementAccess(user);
    return this.prisma.role.findMany({
      where: {
        orgId: user.orgId,
        ...(this.canManageTenantDelegatedRolesOnly(user)
          ? { code: { in: Array.from(tenantAdminManagedRoleCodes) } }
          : {}),
        ...(this.canManageOwnerDelegatedRolesOnly(user)
          ? { code: { in: Array.from(ownerManagedRoleCodes) } }
          : {}),
      },
      include: {
        permissions: {
          include: { permission: true },
          orderBy: { permission: { code: "asc" } },
        },
      },
      orderBy: [{ isSystem: "desc" }, { code: "asc" }],
    });
  }

  async updateRolePermissions(
    user: AuthenticatedUser,
    roleId: string,
    rawBody: unknown,
  ) {
    this.ensureIdentityManagementAccess(user);
    const body = bodyObject(rawBody);
    const before = await this.prisma.role.findFirst({
      where: { id: roleId, orgId: user.orgId },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });
    if (!before) {
      throw new NotFoundException("Role not found.");
    }

    this.ensureRoleManagementAccess(user, [before.code]);
    const permissionCodes = this.permissionCodes(body);
    this.ensureGrantablePermissions(user, permissionCodes);

    const updated = await this.prisma.$transaction(async (tx) => {
      const permissions = await tx.permission.findMany({
        where: { code: { in: permissionCodes } },
      });
      if (permissions.length !== permissionCodes.length) {
        throw new BadRequestException("One or more permissions are invalid.");
      }

      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (permissions.length) {
        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId,
            permissionId: permission.id,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          orgId: user.orgId,
          actorUserId: user.id,
          action: "role.permissions_update",
          entityType: "role",
          entityId: roleId,
          before: {
            code: before.code,
            permissions: before.permissions.map((item) => item.permission.code),
          },
          after: {
            code: before.code,
            permissions: permissionCodes,
          },
        },
      });

      return tx.role.findUniqueOrThrow({
        where: { id: roleId },
        include: {
          permissions: {
            include: { permission: true },
            orderBy: { permission: { code: "asc" } },
          },
        },
      });
    });

    return updated;
  }

  async listAuditLogs(
    user: AuthenticatedUser,
    filters: {
      action?: string;
      entityType?: string;
      entityId?: string;
    } & PaginationQuery,
  ) {
    const where: Prisma.AuditLogWhereInput = {
      orgId: user.orgId,
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
    };
    const pagination = parsePagination(filters);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { id: true, email: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginated(items, total, pagination);
  }

  private roleCodes(body: Payload) {
    const roleCodes = Array.from(
      new Set(
        arrayField<unknown>(body, "roleCodes")
          .map((code) => (typeof code === "string" ? code.trim() : ""))
          .filter(Boolean),
      ),
    ).filter(Boolean);
    if (!roleCodes.length) {
      throw new BadRequestException("roleCodes is required.");
    }

    return roleCodes;
  }

  private permissionCodes(body: Payload) {
    return Array.from(
      new Set(
        arrayField<unknown>(body, "permissionCodes")
          .map((code) => (typeof code === "string" ? code.trim() : ""))
          .filter(Boolean),
      ),
    );
  }

  private ensureRoleManagementAccess(
    user: AuthenticatedUser,
    roleCodes: string[],
  ) {
    if (this.canManageAllRoles(user)) {
      return;
    }
    if (
      this.canManageTenantDelegatedRolesOnly(user) &&
      roleCodes.every((code) => tenantAdminManagedRoleCodes.has(code))
    ) {
      return;
    }
    if (
      this.canManageOwnerDelegatedRolesOnly(user) &&
      roleCodes.every((code) => ownerManagedRoleCodes.has(code))
    ) {
      return;
    }

    throw new ForbiddenException("You cannot manage this role.");
  }

  private ensureGrantablePermissions(
    user: AuthenticatedUser,
    permissionCodes: string[],
  ) {
    if (this.canManageAllRoles(user)) {
      return;
    }
    if (
      this.canManageTenantDelegatedRolesOnly(user) &&
      permissionCodes.every((code) =>
        tenantAdminGrantablePermissionCodes.has(code),
      )
    ) {
      return;
    }
    if (
      this.canManageOwnerDelegatedRolesOnly(user) &&
      permissionCodes.every((code) => ownerGrantablePermissionCodes.has(code))
    ) {
      return;
    }

    throw new ForbiddenException("You cannot grant one or more permissions.");
  }

  private ensureIdentityManagementAccess(user: AuthenticatedUser) {
    if (
      this.canManageAllRoles(user) ||
      this.canManageTenantDelegatedRolesOnly(user) ||
      this.canManageOwnerDelegatedRolesOnly(user)
    ) {
      return;
    }

    throw new ForbiddenException("You cannot manage tenant users.");
  }

  private canManageAllRoles(user: AuthenticatedUser) {
    return user.roles.includes(ROLE_CODES.SUPER_ADMIN);
  }

  private canManageTenantDelegatedRolesOnly(user: AuthenticatedUser) {
    return (
      user.roles.includes(ROLE_CODES.ADMIN) &&
      !user.roles.includes(ROLE_CODES.SUPER_ADMIN)
    );
  }

  private canManageOwnerDelegatedRolesOnly(user: AuthenticatedUser) {
    return (
      user.roles.includes(ROLE_CODES.OWNER) &&
      !user.roles.includes(ROLE_CODES.ADMIN) &&
      !user.roles.includes(ROLE_CODES.SUPER_ADMIN)
    );
  }

  private ensureEmail(email: string) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException("email must be valid.");
    }
  }

  private userAccountFields(body: Payload, before?: UserWithRoles) {
    const account = optionalString(body, "account")?.trim();
    if (account) {
      if (account.includes("@")) {
        const email = account.toLowerCase();
        this.ensureEmail(email);
        return { email, phone: null };
      }

      this.ensurePhone(account);
      return { email: this.generatedEmail(account), phone: account };
    }

    const explicitEmail = optionalString(body, "email")?.trim();
    const explicitPhone = optionalString(body, "phone")?.trim();
    const email =
      explicitEmail !== undefined
        ? explicitEmail.toLowerCase()
        : (before?.email ??
          (explicitPhone ? this.generatedEmail(explicitPhone) : ""));
    const phone =
      explicitPhone !== undefined
        ? explicitPhone || null
        : (before?.phone ?? null);

    if (!email) {
      throw new BadRequestException("account is required.");
    }
    this.ensureEmail(email);
    if (phone) {
      this.ensurePhone(phone);
    }

    return { email, phone };
  }

  private ensurePhone(phone: string) {
    if (!/^[0-9+\-\s]{6,30}$/.test(phone)) {
      throw new BadRequestException("phone must be valid.");
    }
  }

  private async ensureEmailAvailable(email: string, exceptUserId?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== exceptUserId) {
      throw new ConflictException("Email already exists.");
    }
  }

  private async ensurePhoneAvailable(
    phone: string | null,
    exceptUserId?: string,
  ) {
    if (!phone) {
      return;
    }
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing && existing.id !== exceptUserId) {
      throw new ConflictException("Phone already exists.");
    }
  }

  private generatedEmail(phone: string) {
    const normalized = phone.replace(/\D/g, "") || "account";
    return `user-${normalized}@phone.erpdog.local`;
  }

  private ensurePassword(password: string) {
    if (password.length < 10) {
      throw new BadRequestException("password must be at least 10 characters.");
    }
  }

  private async hashCheckedPassword(body: Payload) {
    const nextPassword = stringField(body, "password");
    this.ensurePassword(nextPassword);
    return this.password.hash(nextPassword);
  }

  private async resolveRoles(
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

  private roleCodesForUser(user: UserWithRoles) {
    return user.userRoles.map((userRole) => userRole.role.code);
  }

  private auditUser(user: UserWithRoles) {
    return {
      email: user.email,
      phone: user.phone,
      name: user.name,
      isActive: user.isActive,
      roles: this.roleCodesForUser(user),
    };
  }

  private presentUser(user: UserWithRoles) {
    return {
      id: user.id,
      orgId: user.orgId,
      email: user.email,
      phone: user.phone,
      name: user.name,
      isActive: user.isActive,
      feishuUserId: user.feishuUserId,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: user.userRoles.map((userRole) => ({
        id: userRole.role.id,
        code: userRole.role.code,
        name: userRole.role.name,
      })),
    };
  }

  private userInclude() {
    return userInclude;
  }
}
