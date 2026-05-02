import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export function decimal(value: unknown, fieldName = "amount"): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) {
    return value;
  }

  if (typeof value === "number" || typeof value === "string") {
    try {
      return new Prisma.Decimal(value);
    } catch {
      throw new BadRequestException(`${fieldName} must be a valid decimal.`);
    }
  }

  throw new BadRequestException(`${fieldName} is required.`);
}

export function money(value: unknown, fieldName = "amount"): Prisma.Decimal {
  const parsed = decimal(value, fieldName);

  if (!parsed.isFinite()) {
    throw new BadRequestException(`${fieldName} must be finite.`);
  }

  if (parsed.decimalPlaces() > 2) {
    throw new BadRequestException(`${fieldName} must have at most 2 decimals.`);
  }

  return parsed.toDecimalPlaces(2);
}

export function positiveMoney(
  value: unknown,
  fieldName = "amount",
): Prisma.Decimal {
  const parsed = money(value, fieldName);

  if (!parsed.greaterThan(0)) {
    throw new BadRequestException(`${fieldName} must be greater than 0.`);
  }

  return parsed;
}

export function nonNegativeMoney(
  value: unknown,
  fieldName = "amount",
): Prisma.Decimal {
  const parsed = money(value, fieldName);

  if (parsed.lessThan(0)) {
    throw new BadRequestException(
      `${fieldName} must be greater than or equal to 0.`,
    );
  }

  return parsed;
}

export function assertMoneyEquals(
  actual: Prisma.Decimal,
  expected: Prisma.Decimal,
  message: string,
) {
  if (!actual.equals(expected)) {
    throw new BadRequestException(message);
  }
}

export function optionalDecimal(
  value: unknown,
  fallback: Prisma.Decimal,
): Prisma.Decimal {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return decimal(value);
}

export function optionalMoney(
  value: unknown,
  fallback: Prisma.Decimal,
): Prisma.Decimal {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return money(value);
}

export function decimalString(value: unknown): string {
  if (value === null || value === undefined) {
    return "0.00";
  }

  return new Prisma.Decimal(value as Prisma.Decimal.Value).toFixed(2);
}

export function sum(values: Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce(
    (total, value) => total.plus(value),
    new Prisma.Decimal(0),
  );
}

export function lineTotal(amount: Prisma.Decimal, quantity: Prisma.Decimal) {
  return amount.mul(quantity).toDecimalPlaces(2);
}
