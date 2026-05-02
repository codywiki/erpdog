import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

type AuditInput = {
  orgId: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  reason?: string;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        orgId: input.orgId,
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        before: input.before ?? Prisma.JsonNull,
        after: input.after ?? Prisma.JsonNull,
        reason: input.reason,
      },
    });
  }
}
