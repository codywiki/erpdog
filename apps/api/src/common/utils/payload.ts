import { BadRequestException } from "@nestjs/common";

export type Payload = Record<string, unknown>;

export function bodyObject(value: unknown): Payload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("Request body must be an object.");
  }

  return value as Payload;
}

export function stringField(
  body: Payload,
  field: string,
  fallback?: string,
): string {
  const value = body[field];

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new BadRequestException(`${field} is required.`);
}

export function optionalString(
  body: Payload,
  field: string,
): string | undefined {
  const value = body[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function booleanField(body: Payload, field: string, fallback = false) {
  const value = body[field];
  return typeof value === "boolean" ? value : fallback;
}

export function intField(
  body: Payload,
  field: string,
  fallback: number,
): number {
  const value = body[field];

  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  return fallback;
}

export function dateField(body: Payload, field: string): Date {
  const value = stringField(body, field);
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} must be a valid date.`);
  }

  return date;
}

export function optionalDate(body: Payload, field: string): Date | undefined {
  const value = optionalString(body, field);

  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} must be a valid date.`);
  }

  return date;
}

export function arrayField<T = Payload>(body: Payload, field: string): T[] {
  const value = body[field];
  return Array.isArray(value) ? (value as T[]) : [];
}
