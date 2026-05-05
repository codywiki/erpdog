export const ROLE_CODES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  OWNER: "owner",
  FINANCE: "finance",
  BUSINESS_OWNER: "business_owner",
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

export const PERMISSION_CODES = {
  TENANT_MANAGE: "tenant.manage",
  USER_MANAGE: "user.manage",
  CUSTOMER_READ_ALL: "customer.read_all",
  CUSTOMER_READ_OWN: "customer.read_own",
  CUSTOMER_WRITE: "customer.write",
  CONTRACT_WRITE: "contract.write",
  BILL_MANAGE: "bill.manage",
  BILL_APPROVE: "bill.approve",
  RECEIVABLE_SETTLE: "receivable.settle",
  INVOICE_MANAGE: "invoice.manage",
  RECEIPT_MANAGE: "receipt.manage",
  COST_MANAGE: "cost.manage",
  PAYABLE_SETTLE: "payable.settle",
  PAYMENT_REQUEST_CREATE: "payment_request.create",
  PAYMENT_REQUEST_APPROVE: "payment_request.approve",
  PAYMENT_PAY: "payment.pay",
  PERIOD_CLOSE: "period.close",
  PERIOD_REOPEN: "period.reopen",
  REPORT_VIEW: "report.view",
  AUDIT_VIEW: "audit.view",
} as const;

export type PermissionCode =
  (typeof PERMISSION_CODES)[keyof typeof PERMISSION_CODES];

export const CUSTOMER_STATUSES = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  TERMINATED: "TERMINATED",
} as const;

export type CustomerStatus =
  (typeof CUSTOMER_STATUSES)[keyof typeof CUSTOMER_STATUSES];

export const CONTRACT_STATUSES = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  EXPIRED: "EXPIRED",
  TERMINATED: "TERMINATED",
} as const;

export type ContractStatus =
  (typeof CONTRACT_STATUSES)[keyof typeof CONTRACT_STATUSES];

export const TAXPAYER_TYPES = {
  SMALL_SCALE: "SMALL_SCALE",
  GENERAL: "GENERAL",
  OVERSEAS: "OVERSEAS",
} as const;

export type TaxpayerType = (typeof TAXPAYER_TYPES)[keyof typeof TAXPAYER_TYPES];

export const BILL_STATUSES = {
  DRAFT: "DRAFT",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  PENDING_SETTLEMENT: "PENDING_SETTLEMENT",
  INVOICED: "INVOICED",
  RECEIVED: "RECEIVED",
  INTERNAL_REVIEW: "INTERNAL_REVIEW",
  FINANCE_REVIEW: "FINANCE_REVIEW",
  CUSTOMER_PENDING: "CUSTOMER_PENDING",
  CUSTOMER_CONFIRMED: "CUSTOMER_CONFIRMED",
  CLOSED: "CLOSED",
  VOIDED: "VOIDED",
  ADJUSTED: "ADJUSTED",
} as const;

export type BillStatus = (typeof BILL_STATUSES)[keyof typeof BILL_STATUSES];

export const INVOICE_STATUSES = {
  DRAFT: "DRAFT",
  ISSUED: "ISSUED",
  VOIDED: "VOIDED",
} as const;

export type InvoiceStatus =
  (typeof INVOICE_STATUSES)[keyof typeof INVOICE_STATUSES];

export const RECEIPT_STATUSES = {
  REGISTERED: "REGISTERED",
  REVERSED: "REVERSED",
} as const;

export type ReceiptStatus =
  (typeof RECEIPT_STATUSES)[keyof typeof RECEIPT_STATUSES];

export const PAYABLE_STATUSES = {
  UNPAID: "UNPAID",
  CONFIRMED: "CONFIRMED",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  PAID: "PAID",
  VOIDED: "VOIDED",
} as const;

export type PayableStatus =
  (typeof PAYABLE_STATUSES)[keyof typeof PAYABLE_STATUSES];

export const PAYMENT_REQUEST_STATUSES = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  PAID: "PAID",
} as const;

export type PaymentRequestStatus =
  (typeof PAYMENT_REQUEST_STATUSES)[keyof typeof PAYMENT_REQUEST_STATUSES];

export const PERIOD_STATUSES = {
  OPEN: "OPEN",
  CLOSED: "CLOSED",
  REOPENED: "REOPENED",
} as const;

export type PeriodStatus =
  (typeof PERIOD_STATUSES)[keyof typeof PERIOD_STATUSES];

export type ApiSuccess<T> = {
  data: T;
  requestId?: string;
};

export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type AuthenticatedUser = {
  id: string;
  orgId: string;
  email: string;
  phone?: string | null;
  name: string;
  roles: RoleCode[];
  permissions: PermissionCode[];
};

export type LoginResponse = {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: string;
  user: AuthenticatedUser;
};
