import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { PeriodClosingStatus, Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { decimalString } from "../utils/finance";

export function parsePeriodMonth(periodMonth: string): {
  startsOn: Date;
  endsOn: Date;
} {
  const match = /^(?<year>\d{4})-(?<month>0[1-9]|1[0-2])$/.exec(periodMonth);

  if (!match?.groups) {
    throw new BadRequestException("periodMonth must use YYYY-MM format.");
  }

  const year = Number(match.groups.year);
  const monthIndex = Number(match.groups.month) - 1;
  const startsOn = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  const endsOn = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));

  return { startsOn, endsOn };
}

export function previousPeriodMonth(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const previous = new Date(Date.UTC(year, month - 1, 1));
  return `${previous.getUTCFullYear()}-${String(
    previous.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
}

@Injectable()
export class PeriodLockService {
  constructor(private readonly prisma: PrismaService) {}

  async ensurePeriod(orgId: string, periodMonth: string) {
    const { startsOn, endsOn } = parsePeriodMonth(periodMonth);

    return this.prisma.billingPeriod.upsert({
      where: {
        orgId_periodMonth: {
          orgId,
          periodMonth,
        },
      },
      update: {},
      create: {
        orgId,
        periodMonth,
        startsOn,
        endsOn,
      },
    });
  }

  async ensureOpen(orgId: string, periodMonth: string): Promise<void> {
    const period = await this.ensurePeriod(orgId, periodMonth);

    if (period.status === "CLOSED") {
      throw new ConflictException(`Period ${periodMonth} is closed.`);
    }
  }

  async autoCloseIfReady(
    orgId: string,
    periodMonth: string,
    actorUserId?: string,
  ) {
    const { startsOn, endsOn } = parsePeriodMonth(periodMonth);

    return this.prisma.$transaction(async (tx) => {
      const currentPeriod = await tx.billingPeriod.findUnique({
        where: { orgId_periodMonth: { orgId, periodMonth } },
      });
      if (currentPeriod?.status === PeriodClosingStatus.CLOSED) {
        return { closed: false, reason: "already_closed" };
      }

      const [
        receivedBillCount,
        openBillCount,
        payableCount,
        openPayableCount,
        draftExtraChargeCount,
        pendingPaymentRequestCount,
      ] = await Promise.all([
        tx.bill.count({
          where: { orgId, periodMonth, status: "RECEIVED" },
        }),
        tx.bill.count({
          where: {
            orgId,
            periodMonth,
            status: { notIn: ["RECEIVED", "VOIDED", "CLOSED"] },
          },
        }),
        tx.payable.count({
          where: {
            orgId,
            periodMonth,
            status: { not: "VOIDED" },
          },
        }),
        tx.payable.count({
          where: {
            orgId,
            periodMonth,
            status: { notIn: ["PAID", "VOIDED"] },
          },
        }),
        tx.extraCharge.count({
          where: { orgId, periodMonth, status: "DRAFT" },
        }),
        tx.paymentRequest.count({
          where: {
            orgId,
            status: {
              in: ["DRAFT", "SUBMITTED", "APPROVED", "PARTIALLY_PAID"],
            },
            OR: [
              { periodMonth },
              { items: { some: { periodMonth } } },
              { items: { some: { payable: { periodMonth } } } },
            ],
          },
        }),
      ]);

      if (
        receivedBillCount === 0 ||
        openBillCount > 0 ||
        payableCount === 0 ||
        openPayableCount > 0 ||
        draftExtraChargeCount > 0 ||
        pendingPaymentRequestCount > 0
      ) {
        return {
          closed: false,
          reason: "period_not_ready",
          receivedBillCount,
          openBillCount,
          payableCount,
          openPayableCount,
          draftExtraChargeCount,
          pendingPaymentRequestCount,
        };
      }

      const snapshot = await this.periodSnapshot(tx, orgId, periodMonth);
      const reason = "应收已到账且关联应付已支付，系统自动关闭账期。";
      const period = await tx.billingPeriod.upsert({
        where: { orgId_periodMonth: { orgId, periodMonth } },
        update: {
          status: PeriodClosingStatus.CLOSED,
          closedAt: new Date(),
          reason,
        },
        create: {
          orgId,
          periodMonth,
          startsOn,
          endsOn,
          status: PeriodClosingStatus.CLOSED,
          closedAt: new Date(),
          reason,
        },
      });

      await tx.periodClosing.create({
        data: {
          orgId,
          periodMonth,
          status: PeriodClosingStatus.CLOSED,
          reason,
          snapshot: snapshot as Prisma.InputJsonValue,
          actorUserId,
        },
      });

      await tx.auditLog.create({
        data: {
          orgId,
          actorUserId,
          action: "period.auto_close",
          entityType: "billing_period",
          entityId: period.id,
          after: { periodMonth, snapshot },
        },
      });

      return { closed: true, period, snapshot };
    });
  }

  private async periodSnapshot(
    client: Prisma.TransactionClient,
    orgId: string,
    periodMonth: string,
  ) {
    const [billSum, costEntrySum, directPayableSum, receiptSum, payableOpen] =
      await Promise.all([
        client.bill.aggregate({
          where: { orgId, periodMonth, status: { not: "VOIDED" } },
          _sum: { totalAmount: true },
          _count: true,
        }),
        client.costEntry.aggregate({
          where: { orgId, periodMonth },
          _sum: { amount: true },
          _count: true,
        }),
        client.payable.aggregate({
          where: {
            orgId,
            periodMonth,
            costEntryId: null,
            status: { not: "VOIDED" },
          },
          _sum: { amount: true },
          _count: true,
        }),
        client.receiptAllocation.aggregate({
          where: {
            bill: { orgId, periodMonth },
            receipt: { status: { not: "REVERSED" } },
          },
          _sum: { amount: true },
          _count: true,
        }),
        client.payable.count({
          where: { orgId, periodMonth, status: { notIn: ["PAID", "VOIDED"] } },
        }),
      ]);
    const costAmount = new Prisma.Decimal(costEntrySum._sum.amount ?? 0).plus(
      directPayableSum._sum.amount ?? 0,
    );

    return {
      billCount: billSum._count,
      billAmount: decimalString(billSum._sum.totalAmount ?? 0),
      costCount: costEntrySum._count + directPayableSum._count,
      costAmount: decimalString(costAmount),
      receiptAllocationCount: receiptSum._count,
      receiptAmount: decimalString(receiptSum._sum.amount ?? 0),
      openPayableCount: payableOpen,
    };
  }
}
