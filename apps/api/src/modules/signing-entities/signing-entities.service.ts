import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, TaxpayerType } from "@prisma/client";

import type { AuthenticatedUser } from "@erpdog/contracts";

import { AuditService } from "../../common/audit/audit.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  paginated,
  parsePagination,
  type PaginationQuery,
} from "../../common/utils/pagination";
import {
  bodyObject,
  optionalString,
  stringField,
  type Payload,
} from "../../common/utils/payload";

type SigningEntityFilters = {
  q?: string;
} & PaginationQuery;

const signingEntityCodePrefix = "ZT";

@Injectable()
export class SigningEntitiesService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  async list(user: AuthenticatedUser, filters: SigningEntityFilters) {
    const where: Prisma.SigningEntityWhereInput = {
      orgId: user.orgId,
      ...(filters.q
        ? {
            OR: [
              { code: { contains: filters.q, mode: "insensitive" } },
              { shortName: { contains: filters.q, mode: "insensitive" } },
              { fullName: { contains: filters.q, mode: "insensitive" } },
              {
                legalRepresentative: {
                  contains: filters.q,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };
    const pagination = parsePagination(filters);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.signingEntity.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.signingEntity.count({ where }),
    ]);

    return paginated(items, total, pagination);
  }

  async get(user: AuthenticatedUser, id: string) {
    return this.ensureSigningEntity(user, id);
  }

  async create(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const shortName = stringField(body, "shortName");
    const fullName = stringField(body, "fullName");
    const legalRepresentative = stringField(body, "legalRepresentative");
    const taxpayerType = this.taxpayerType(body);

    const created = await this.prisma.$transaction(async (tx) => {
      await this.lockRegistry(tx, user.orgId);
      await this.ensureUnique(tx, user.orgId, shortName, fullName);
      const code = await this.nextCode(tx, user.orgId);
      const entity = await tx.signingEntity.create({
        data: {
          orgId: user.orgId,
          code,
          shortName,
          fullName,
          legalRepresentative,
          taxpayerType,
        },
      });

      await tx.auditLog.create({
        data: {
          orgId: user.orgId,
          actorUserId: user.id,
          action: "signing_entity.create",
          entityType: "signing_entity",
          entityId: entity.id,
          after: {
            id: entity.id,
            code: entity.code,
            shortName: entity.shortName,
            fullName: entity.fullName,
          },
        },
      });

      return entity;
    });

    return created;
  }

  async update(user: AuthenticatedUser, id: string, rawBody: unknown) {
    const before = await this.ensureSigningEntity(user, id);
    const body = bodyObject(rawBody);
    const shortName = optionalString(body, "shortName") ?? before.shortName;
    const fullName = optionalString(body, "fullName") ?? before.fullName;
    const legalRepresentative =
      optionalString(body, "legalRepresentative") ?? before.legalRepresentative;
    const taxpayerType = Object.prototype.hasOwnProperty.call(
      body,
      "taxpayerType",
    )
      ? this.taxpayerType(body)
      : before.taxpayerType;

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.lockRegistry(tx, user.orgId);
      await this.ensureUnique(tx, user.orgId, shortName, fullName, id);
      return tx.signingEntity.update({
        where: { id },
        data: {
          shortName,
          fullName,
          legalRepresentative,
          taxpayerType,
        },
      });
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "signing_entity.update",
      entityType: "signing_entity",
      entityId: id,
      before: {
        code: before.code,
        shortName: before.shortName,
        fullName: before.fullName,
        legalRepresentative: before.legalRepresentative,
        taxpayerType: before.taxpayerType,
      },
      after: {
        code: updated.code,
        shortName: updated.shortName,
        fullName: updated.fullName,
        legalRepresentative: updated.legalRepresentative,
        taxpayerType: updated.taxpayerType,
      },
    });

    return updated;
  }

  async remove(user: AuthenticatedUser, id: string) {
    const entity = await this.ensureSigningEntity(user, id);
    const contractCount = await this.prisma.contract.count({
      where: { orgId: user.orgId, signingEntityId: id },
    });
    if (contractCount > 0) {
      throw new ConflictException(
        "Signing entity is already used by contracts and cannot be deleted.",
      );
    }

    await this.prisma.signingEntity.delete({ where: { id } });
    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "signing_entity.delete",
      entityType: "signing_entity",
      entityId: id,
      before: {
        code: entity.code,
        shortName: entity.shortName,
        fullName: entity.fullName,
      },
    });

    return { id, deleted: true };
  }

  async ensureSigningEntity(user: AuthenticatedUser, id: string) {
    const entity = await this.prisma.signingEntity.findFirst({
      where: { id, orgId: user.orgId },
    });
    if (!entity) {
      throw new NotFoundException("Signing entity not found.");
    }

    return entity;
  }

  private taxpayerType(body: Payload) {
    const value = stringField(body, "taxpayerType");
    if (value in TaxpayerType) {
      return value as TaxpayerType;
    }

    const aliases: Record<string, TaxpayerType> = {
      小规模纳税人: TaxpayerType.SMALL_SCALE,
      一般纳税人: TaxpayerType.GENERAL,
      海外主体: TaxpayerType.OVERSEAS,
    };
    const aliased = aliases[value];
    if (aliased) {
      return aliased;
    }

    throw new BadRequestException(
      "taxpayerType must be SMALL_SCALE, GENERAL, or OVERSEAS.",
    );
  }

  private async ensureUnique(
    tx: Prisma.TransactionClient,
    orgId: string,
    shortName: string,
    fullName: string,
    excludeId?: string,
  ) {
    const duplicate = await tx.signingEntity.findFirst({
      where: {
        orgId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [{ shortName }, { fullName }],
      },
      select: { code: true, shortName: true, fullName: true },
    });

    if (duplicate) {
      throw new ConflictException(
        `Signing entity already exists: ${duplicate.fullName || duplicate.shortName}.`,
      );
    }
  }

  private async lockRegistry(tx: Prisma.TransactionClient, orgId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`signing-entity-registry:${orgId}`}))`;
  }

  private async nextCode(tx: Prisma.TransactionClient, orgId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`signing-entity-code:${orgId}:${signingEntityCodePrefix}`}))`;
    const existing = await tx.signingEntity.findMany({
      where: { orgId, code: { startsWith: signingEntityCodePrefix } },
      select: { code: true },
    });
    const nextNumber =
      existing.reduce((max, item) => {
        const match = new RegExp(`^${signingEntityCodePrefix}(\\d+)$`).exec(
          item.code,
        );
        return match?.[1] ? Math.max(max, Number(match[1])) : max;
      }, 0) + 1;

    return `${signingEntityCodePrefix}${nextNumber.toString().padStart(3, "0")}`;
  }
}
