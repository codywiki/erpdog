import { BadRequestException } from "@nestjs/common";

export type PaginationQuery = {
  page?: string;
  pageSize?: string;
};

export type Pagination = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export function parsePagination(query: PaginationQuery = {}): Pagination {
  const page = parsePositiveInteger(query.page, "page", DEFAULT_PAGE);
  const requestedPageSize = parsePositiveInteger(
    query.pageSize,
    "pageSize",
    DEFAULT_PAGE_SIZE,
  );
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function paginated<T>(
  items: T[],
  total: number,
  pagination: Pagination,
): PaginatedResult<T> {
  return {
    items,
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages: Math.ceil(total / pagination.pageSize),
  };
}

function parsePositiveInteger(
  value: string | undefined,
  field: string,
  fallback: number,
) {
  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException(`${field} must be a positive integer.`);
  }

  return parsed;
}
