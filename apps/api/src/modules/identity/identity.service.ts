import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { AuthenticatedUser } from "@erpdog/contracts";

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
    const pagination = parsePagination(paginationQuery);
    const where: Prisma.UserWhereInput = { orgId: user.orgId };
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
    const body = bodyObject(rawBody);
    const email = stringField(body, "email").toLowerCase();
    this.ensureEmail(email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException("Email already exists.");
    }

    const roleCodes = this.roleCodes(body);
    const password = stringField(body, "password");
    this.ensurePassword(password);
    const created = await this.prisma.$transaction(async (tx) => {
      const roles = await this.resolveRoles(tx, user.orgId, roleCodes);
      const nextUser = await tx.user.create({
        data: {
          orgId: user.orgId,
          email,
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
    const body = bodyObject(rawBody);
    const before = await this.prisma.user.findFirst({
      where: { id, orgId: user.orgId },
      include: this.userInclude(),
    });
    if (!before) {
      throw new NotFoundException("User not found.");
    }

    const nextEmail = optionalString(body, "email")?.toLowerCase();
    if (nextEmail && nextEmail !== before.email) {
      this.ensureEmail(nextEmail);
      const existing = await this.prisma.user.findUnique({
        where: { email: nextEmail },
      });
      if (existing) {
        throw new ConflictException("Email already exists.");
      }
    }

    const hasRoleUpdate = Array.isArray(body.roleCodes);
    if (id === user.id && hasRoleUpdate) {
      throw new ConflictException("You cannot change your own roles.");
    }

    const roleCodes = hasRoleUpdate ? this.roleCodes(body) : [];
    const nextIsActive = booleanField(body, "isActive", before.isActive);
    if (id === user.id && !nextIsActive) {
      throw new ConflictException("You cannot deactivate your own account.");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const roles = hasRoleUpdate
        ? await this.resolveRoles(tx, user.orgId, roleCodes)
        : [];
      await tx.user.update({
        where: { id },
        data: {
          email: nextEmail ?? before.email,
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
            email: nextEmail ?? before.email,
            name: optionalString(body, "name") ?? before.name,
            isActive: nextIsActive,
            roles: hasRoleUpdate ? roleCodes : this.roleCodesForUser(before),
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
    return this.prisma.role.findMany({
      where: { orgId: user.orgId },
      include: {
        permissions: {
          include: { permission: true },
          orderBy: { permission: { code: "asc" } },
        },
      },
      orderBy: [{ isSystem: "desc" }, { code: "asc" }],
    });
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

  private ensureEmail(email: string) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException("email must be valid.");
    }
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
