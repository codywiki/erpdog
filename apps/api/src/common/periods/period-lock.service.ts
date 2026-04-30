import { ConflictException, Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

export function parsePeriodMonth(periodMonth: string): {
  startsOn: Date;
  endsOn: Date;
} {
  const match = /^(?<year>\d{4})-(?<month>0[1-9]|1[0-2])$/.exec(periodMonth);

  if (!match?.groups) {
    throw new ConflictException("periodMonth must use YYYY-MM format.");
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
    previous.getUTCMonth() + 1
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
          periodMonth
        }
      },
      update: {},
      create: {
        orgId,
        periodMonth,
        startsOn,
        endsOn
      }
    });
  }

  async ensureOpen(orgId: string, periodMonth: string): Promise<void> {
    const period = await this.ensurePeriod(orgId, periodMonth);

    if (period.status === "CLOSED") {
      throw new ConflictException(`Period ${periodMonth} is closed.`);
    }
  }
}
