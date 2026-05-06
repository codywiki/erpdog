"use client";

import { FormEvent, useEffect, useState } from "react";

type ApiUser = {
  id: string;
  orgId: string;
  email: string;
  phone?: string | null;
  name: string;
  roles?: string[];
  permissions: string[];
};

type ActionSummary = {
  created?: number;
  skipped?: number;
  failed?: number;
  totalContracts?: number;
  results?: Array<{ billId?: string; skipped?: boolean; error?: string }>;
};

type Customer = {
  id: string;
  code: string;
  name: string;
  fullName?: string | null;
  status: string;
};

type ContractAttachment = {
  id: string;
  fileName: string;
  contentType?: string | null;
  sizeBytes?: string | null;
  url?: string | null;
  createdAt?: string;
};

type Attachment = ContractAttachment & {
  ownerType?: string | null;
  ownerId?: string | null;
};

type AttachmentPreview = {
  attachment: Attachment;
  url: string;
  downloadUrl: string;
};

type ContractTierRule = {
  description?: string;
  threshold?: string;
  serviceFeeRate?: string;
};

type Contract = {
  id: string;
  customerId?: string;
  signingEntityId?: string | null;
  code: string;
  name: string;
  customerContactText?: string;
  status: string;
  startDate: string;
  endDate?: string | null;
  baseFee?: string | null;
  incentiveUnitPrice?: string | null;
  serviceFeeRate?: string | null;
  tierMode?: string | null;
  tierRules?: ContractTierRule[] | null;
  attachments?: ContractAttachment[];
  chargeItems?: Array<{ amount: string; name: string }>;
  customer?: Customer;
  signingEntity?: SigningEntity | null;
};

type TaxpayerType = "SMALL_SCALE" | "GENERAL" | "OVERSEAS";

type SigningEntity = {
  id: string;
  orgId?: string;
  code: string;
  shortName: string;
  fullName: string;
  legalRepresentative: string;
  taxpayerType: TaxpayerType;
  createdAt?: string;
  updatedAt?: string;
};

type Bill = {
  id: string;
  billNo: string;
  projectName?: string | null;
  periodMonth: string;
  status: string;
  totalAmount: string;
  subtotal?: string;
  uninvoicedAmount?: string;
  unreceivedAmount?: string;
  invoiceAmount?: string;
  receiptAmount?: string;
  approvedAt?: string | null;
  evidenceAttachmentIds?: string[];
  invoiceAttachmentIds?: string[];
  receiptAttachmentIds?: string[];
  customer?: Customer;
  signingEntity?: SigningEntity | null;
  signingEntityId?: string | null;
  contract?: Pick<
    Contract,
    "id" | "code" | "name" | "signingEntity" | "signingEntityId"
  >;
  items?: Array<{
    id?: string;
    name: string;
    description?: string | null;
    amount: string;
    quantity: string;
    lineTotal: string;
  }>;
  confirmations?: Array<{
    id: string;
    confirmedAt: string;
    confirmedByName: string;
    evidenceAttachmentId?: string | null;
  }>;
  settlements?: BillSettlement[];
};

type BillSettlement = {
  id: string;
  title?: string | null;
  sortOrder: number;
  items: BillSettlementItem[];
};

type BillSettlementItem = {
  id: string;
  customerContactName: string;
  projectName: string;
  periodMonth: string;
  cooperationModes: string[];
  otherModeNote?: string | null;
  cooperationFee: string;
  serviceFee: string;
  totalFee: string;
};

type Invoice = {
  id: string;
  invoiceNo: string;
  status: string;
  amount: string;
  issueDate: string;
};

type Receipt = {
  id: string;
  receiptNo?: string | null;
  amount: string;
  receivedAt: string;
};

type CostEntry = {
  id: string;
  amount: string;
  periodMonth?: string | null;
  description?: string | null;
  customer?: Customer | null;
};

type Payable = {
  id: string;
  paymentRecipientId?: string | null;
  vendorName: string;
  receiptPlatform?: PaymentRecipientPlatform;
  receiptAccountName?: string;
  receiptAccountNo?: string;
  receiptBankBranch?: string | null;
  amount: string;
  paidAmount?: string;
  periodMonth?: string | null;
  status: string;
  customer?: Customer | null;
  bill?: Pick<Bill, "id" | "billNo" | "periodMonth" | "status"> | null;
  paymentRecipient?: PaymentRecipient | null;
  paymentAllocations?: Array<{
    id?: string;
    amount?: string;
    payment?: {
      id: string;
      attachmentId?: string | null;
      paidAt?: string;
      status?: string;
    } | null;
  }>;
};

type PaymentRecipientPlatform =
  | "PRIVATE_BANK"
  | "CORPORATE_BANK"
  | "WECHAT"
  | "ALIPAY";

type PaymentRecipient = {
  id: string;
  name: string;
  platform: PaymentRecipientPlatform;
  accountName: string;
  accountNo: string;
  attachmentCount?: number;
  bankBranch?: string | null;
  isActive?: boolean;
};

type PaymentRequest = {
  id: string;
  requestNo: string;
  status: string;
  supplierName: string;
  requestedAmount: string;
};

type Payment = {
  id: string;
  paymentNo: string;
  amount: string;
  paidAt: string;
  payeeName: string;
};

type Role = {
  id: string;
  code: string;
  name: string;
  permissions?: Array<{ permission: { code: string; name: string } }>;
};

type ConsoleUser = {
  id: string;
  orgId?: string;
  org?: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
    isPlatform: boolean;
  };
  email: string;
  phone?: string | null;
  name: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  roles: Role[];
};

type Tenant = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  users: ConsoleUser[];
};

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  reason?: string | null;
  createdAt: string;
  actor?: {
    name: string;
    email: string;
  } | null;
};

type ProfitRow = {
  customerName: string;
  incomeAmount: string;
  costAmount: string;
  profitAmount: string;
  grossMargin: string | null;
};

type ConsoleData = {
  customers: Customer[];
  signingEntities: SigningEntity[];
  contracts: Contract[];
  bills: Bill[];
  invoices: Invoice[];
  receipts: Receipt[];
  costEntries: CostEntry[];
  payables: Payable[];
  paymentRecipients: PaymentRecipient[];
  paymentRequests: PaymentRequest[];
  payments: Payment[];
  users: ConsoleUser[];
  superAdmins: ConsoleUser[];
  tenants: Tenant[];
  roles: Role[];
  auditLogs: AuditLog[];
  profits: ProfitRow[];
};

type PaginatedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const authExpiredMessage = "登录已过期，请重新登录。";
const loginRequiredMessage = "请先登录正式系统。";
const authSessionCookieName = "erpdog_auth_session";
const authSessionMaxAgeSeconds = 30 * 24 * 60 * 60;
const loginCredentialStorageKey = "erpdog_login_credentials";

type AuthSession = {
  accessToken: string;
  user: ApiUser;
};

type LoginCredentials = {
  email: string;
  password: string;
};

const permissionLabels: Record<string, string> = {
  "tenant.manage": "租户管理",
  "user.manage": "用户管理",
  "customer.read_all": "查看全部客户",
  "customer.read_own": "查看负责客户",
  "customer.write": "客户维护",
  "contract.write": "合同维护",
  "bill.manage": "账单管理",
  "bill.approve": "应收审批",
  "receivable.settle": "应收结算",
  "invoice.manage": "发票管理",
  "receipt.manage": "收款管理",
  "cost.manage": "成本应付",
  "payable.settle": "应付付款",
  "payment_request.create": "发起付款申请",
  "payment_request.approve": "审批付款申请",
  "payment.pay": "登记付款",
  "report.view": "查看报表",
  "audit.view": "查看审计",
};

const permissionOptions = Object.entries(permissionLabels).map(
  ([code, label]) => ({ code, label }),
);

const usageLabels: Record<string, string> = {
  contracts: "合同",
  bills: "账单",
  extraCharges: "额外费用",
  costEntries: "成本",
  payables: "应付",
  paymentRequests: "付款申请",
};

const configuredApiBase = process.env.NEXT_PUBLIC_API_URL?.trim();
const apiBase = configuredApiBase
  ? configuredApiBase.replace(/\/$/, "")
  : "/api/v1";

function nextSequentialCode(
  items: Array<{ code: string }>,
  prefix: string,
  width = 3,
) {
  const nextNumber =
    items.reduce((max, item) => {
      const match = new RegExp(`^${prefix}(\\d+)$`).exec(item.code);
      return match?.[1] ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;

  return `${prefix}${nextNumber.toString().padStart(width, "0")}`;
}

function nextCustomerCode(customers: Customer[]) {
  return nextSequentialCode(customers, "KH");
}

function nextSigningEntityCode(signingEntities: SigningEntity[]) {
  return nextSequentialCode(signingEntities, "ZT");
}

function contractYearPrefix(startDate: string) {
  const year = Number(startDate.slice(0, 4));
  const fallbackYear = new Date().getFullYear();
  return `HT${(Number.isFinite(year) ? year : fallbackYear).toString().slice(-2)}`;
}

function nextContractCode(contracts: Contract[], startDate: string) {
  return nextSequentialCode(contracts, contractYearPrefix(startDate));
}

function isApiUser(value: unknown): value is ApiUser {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ApiUser>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.orgId === "string" &&
    typeof candidate.email === "string" &&
    (candidate.phone === undefined ||
      candidate.phone === null ||
      typeof candidate.phone === "string") &&
    typeof candidate.name === "string" &&
    (candidate.roles === undefined ||
      (Array.isArray(candidate.roles) &&
        candidate.roles.every((role) => typeof role === "string"))) &&
    Array.isArray(candidate.permissions) &&
    candidate.permissions.every((permission) => typeof permission === "string")
  );
}

function readAuthSessionCookie(): AuthSession | null {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${authSessionCookieName}=`;
  const raw = document.cookie
    .split("; ")
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<AuthSession>;
    if (typeof parsed.accessToken === "string" && isApiUser(parsed.user)) {
      return { accessToken: parsed.accessToken, user: parsed.user };
    }
  } catch {
    return null;
  }

  return null;
}

function writeAuthSessionCookie(session: AuthSession) {
  if (typeof document === "undefined") {
    return;
  }

  const value = encodeURIComponent(JSON.stringify(session));
  document.cookie = `${authSessionCookieName}=${value}; Max-Age=${authSessionMaxAgeSeconds}; Path=/; SameSite=Lax`;
}

function clearAuthSessionCookie() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${authSessionCookieName}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function isLoginCredentials(value: unknown): value is LoginCredentials {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<LoginCredentials>;
  return (
    typeof candidate.email === "string" &&
    typeof candidate.password === "string"
  );
}

function readLoginCredentials(): LoginCredentials | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(loginCredentialStorageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    return isLoginCredentials(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLoginCredentials(credentials: LoginCredentials) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      loginCredentialStorageKey,
      JSON.stringify(credentials),
    );
  } catch {
    // 浏览器禁用本地存储时不影响正常登录。
  }
}

function translateErrorMessage(message: string) {
  if (/Missing bearer token|Invalid or expired bearer token/i.test(message)) {
    return authExpiredMessage;
  }
  if (/You do not have permission/i.test(message)) {
    return "当前账号没有权限执行此操作。";
  }
  if (/You cannot manage tenant users/i.test(message)) {
    return "当前账号不能管理租户用户。";
  }
  if (/You cannot manage tenants/i.test(message)) {
    return "当前账号不能管理租户和超级管理员。";
  }
  if (/You cannot manage this role/i.test(message)) {
    return "当前账号不能管理该角色。";
  }
  if (/You cannot grant one or more permissions/i.test(message)) {
    return "当前账号不能分配其中一个或多个权限。";
  }
  if (
    /Only tenant owners can receive user management permission/i.test(message)
  ) {
    return "只有租户管理员和总负责人角色可以拥有用户管理权限。";
  }
  if (/Invalid email or password/i.test(message)) {
    return "账号或密码不正确。";
  }
  if (/Too many failed login attempts/i.test(message)) {
    return "登录失败次数过多，请稍后再试。";
  }
  if (/Email already exists/i.test(message)) {
    return "该邮箱已存在，请换一个。";
  }
  if (/account is required/i.test(message)) {
    return "登录账号不能为空。";
  }
  if (/email must be valid/i.test(message)) {
    return "邮箱格式不正确。";
  }
  if (/Customer already exists/i.test(message)) {
    return "该客户已存在，不能重复新建。";
  }
  if (/Signing entity already exists/i.test(message)) {
    return "该签约主体已存在，不能重复新建。";
  }
  if (/Signing entity not found|signingEntityId is required/i.test(message)) {
    return "请选择有效签约主体。";
  }
  if (/Signing entity is already used/i.test(message)) {
    return "该签约主体已被合同使用，不能删除。";
  }
  const customerUsage =
    /Customer is already used by business records: ([^.]+)/i.exec(message);
  if (customerUsage?.[1]) {
    return `该客户有关联数据：${translateUsageSummary(customerUsage[1])}。请先清理关联数据后再删除。`;
  }
  const contractUsage =
    /Contract is already used by business records: ([^.]+)/i.exec(message);
  if (contractUsage?.[1]) {
    return `该合同有关联数据：${translateUsageSummary(contractUsage[1])}。请先清理关联数据后再删除。`;
  }
  if (/Contract attachment is required/i.test(message)) {
    return "新建合同必须上传合同附件。";
  }
  if (/customerContactText is required/i.test(message)) {
    return "客户对接人不能为空。";
  }
  if (/Payment recipient not found/i.test(message)) {
    return "请选择有效收款人。";
  }
  if (/Payable must be invoiced or confirmed/i.test(message)) {
    return "应付账单必须先变更为已开票/确认，才能标记已支付。";
  }
  if (/Payable confirmation attachments are required/i.test(message)) {
    return "修改为已开票/确认必须上传文件或截图。";
  }
  if (/Only unpaid payables can be confirmed/i.test(message)) {
    return "只有待支付状态可以修改为已开票/确认。";
  }
  if (/Payment attachment is required for payable payment/i.test(message)) {
    return "修改为已支付必须上传银行打款回单或付款截图。";
  }
  if (/Payment attachment must belong to this payment flow/i.test(message)) {
    return "付款附件必须属于当前应付或付款申请。";
  }
  if (/Phone already exists/i.test(message)) {
    return "该手机号已存在，请换一个。";
  }
  if (/confirmPassword must match password/i.test(message)) {
    return "两次密码输入不一致。";
  }
  if (/phone must be valid/i.test(message)) {
    return "手机号格式不正确。";
  }
  if (/Unique constraint failed|already exists/i.test(message)) {
    return "编码、邮箱或手机号已存在，请换一个。";
  }
  if (/customerId is required/i.test(message)) {
    return "请先选择客户。";
  }
  if (/roleCodes is required|One or more roles are invalid/i.test(message)) {
    return "请选择有效角色。";
  }
  if (/Evidence attachments are required before approval/i.test(message)) {
    return "审批前必须上传结算单、邮件确认截图或微信确认截图。";
  }
  if (/must be uploaded to this bill/i.test(message)) {
    return "附件必须先上传并归属到当前账单。";
  }
  if (
    /Evidence attachments can only be changed while pending approval/i.test(
      message,
    )
  ) {
    return "确认附件只能在账单待审批时修改。";
  }
  if (/You cannot change your own roles/i.test(message)) {
    return "不能修改自己的角色。";
  }
  if (/You cannot deactivate your own account/i.test(message)) {
    return "不能停用自己的账号。";
  }
  if (/You cannot delete your own account/i.test(message)) {
    return "不能删除自己的账号。";
  }
  if (/At least one active super admin is required/i.test(message)) {
    return "至少需要保留一个启用状态的超级管理员。";
  }
  if (/password must be at least/i.test(message)) {
    return "初始密码至少需要 10 位。";
  }
  if (/must be a valid decimal|must be finite/i.test(message)) {
    return "金额格式不正确。";
  }
  if (/must be a valid date/i.test(message)) {
    return "日期格式不正确。";
  }

  return message;
}

function translateUsageSummary(summary: string) {
  return summary
    .split(",")
    .map((item) => {
      const [key, value] = item.split("=").map((part) => part.trim());
      if (!key || !value) {
        return "";
      }
      return `${usageLabels[key] ?? key} ${value}`;
    })
    .filter(Boolean)
    .join("、");
}

const modules = [
  { id: "dashboard", label: "经营总览", title: "经营驾驶舱" },
  { id: "customers", label: "客户", title: "客户管理" },
  { id: "contracts", label: "合同", title: "合同管理" },
  { id: "signingEntities", label: "签约主体", title: "签约主体管理" },
  { id: "receivableBilling", label: "账单应收", title: "账单应收" },
  { id: "costPayable", label: "成本应付", title: "成本应付" },
  { id: "closing", label: "结账报表", title: "结账与报表" },
  { id: "identity", label: "用户权限", title: "用户、角色与审计" },
  { id: "superAdmins", label: "超级管理员", title: "超级管理员" },
  { id: "tenants", label: "租户列表", title: "租户列表" },
  { id: "activation", label: "正式启用", title: "正式启用路径" },
] as const;

type ModuleId = (typeof modules)[number]["id"];

const navItems: Array<
  | { kind: "module"; id: ModuleId }
  | { kind: "group"; label: string; children: [ModuleId, ...ModuleId[]] }
> = [
  { kind: "module", id: "dashboard" },
  { kind: "module", id: "customers" },
  { kind: "module", id: "contracts" },
  { kind: "module", id: "signingEntities" },
  { kind: "module", id: "receivableBilling" },
  { kind: "module", id: "costPayable" },
  { kind: "module", id: "closing" },
  {
    kind: "group",
    label: "租户设置",
    children: ["identity", "superAdmins", "tenants", "activation"],
  },
];

function getModuleMeta(id: ModuleId) {
  const module = modules.find((item) => item.id === id);
  if (!module) {
    throw new Error(`Unknown module: ${id}`);
  }
  return module;
}

const billStatusText: Record<string, string> = {
  DRAFT: "草稿",
  PENDING_APPROVAL: "待审批",
  PENDING_SETTLEMENT: "待结算",
  INVOICED: "已开票",
  RECEIVED: "已到账",
  INTERNAL_REVIEW: "内部审核",
  FINANCE_REVIEW: "财务审核",
  CUSTOMER_PENDING: "待客户确认",
  CUSTOMER_CONFIRMED: "客户已确认",
  ADJUSTED: "已调整",
  CLOSED: "已关闭",
  VOIDED: "已作废",
};

const payableStatusText: Record<string, string> = {
  UNPAID: "待支付",
  CONFIRMED: "已开票/确认",
  PARTIALLY_PAID: "待支付",
  PAID: "已支付",
  VOIDED: "已作废",
};

const paymentRecipientPlatformText: Record<PaymentRecipientPlatform, string> = {
  PRIVATE_BANK: "对私银行",
  CORPORATE_BANK: "对公银行",
  WECHAT: "微信",
  ALIPAY: "支付宝",
};

const ownerDelegatedRoleCodes = ["business_owner", "finance"];
const tenantAdminDelegatedRoleCodes = ["owner", "business_owner", "finance"];
const platformModuleIds: ModuleId[] = ["superAdmins", "tenants"];
const roleCodeText: Record<string, string> = {
  super_admin: "超级管理员",
  admin: "租户管理员",
  owner: "总负责人",
  business_owner: "业务负责人",
  finance: "财务",
};
const tenantManagementRoleOptions = [
  { code: "admin", name: "租户管理员" },
  { code: "owner", name: "总负责人" },
  { code: "business_owner", name: "业务负责人" },
  { code: "finance", name: "财务" },
];

const taxpayerTypeText: Record<TaxpayerType, string> = {
  SMALL_SCALE: "小规模纳税人",
  GENERAL: "一般纳税人",
  OVERSEAS: "海外主体",
};

function money(value: string | number | undefined) {
  return `¥${Number(value ?? 0).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function listItems<T>(value: T[] | PaginatedResponse<T>) {
  return Array.isArray(value) ? value : value.items;
}

function emptyPage<T>(): PaginatedResponse<T> {
  return { items: [], page: 1, pageSize: 50, total: 0, totalPages: 0 };
}

function emptyConsoleData(): ConsoleData {
  return {
    customers: [],
    signingEntities: [],
    contracts: [],
    bills: [],
    invoices: [],
    receipts: [],
    costEntries: [],
    payables: [],
    paymentRecipients: [],
    paymentRequests: [],
    payments: [],
    users: [],
    superAdmins: [],
    tenants: [],
    roles: [],
    auditLogs: [],
    profits: [],
  };
}

function userDisplayName(user: ApiUser | null) {
  return user?.name?.trim() || userAccountLabel(user) || "未登录";
}

function userAccountLabel(user: ApiUser | null) {
  return user?.phone?.trim() || user?.email?.trim() || "";
}

function userRoleLabel(user: ApiUser | null) {
  const roles = user?.roles ?? [];
  return (
    roles
      .map((role) => roleCodeText[role] ?? role)
      .filter(Boolean)
      .join("、") || "未配置角色"
  );
}

function currentUserChipLabel(user: ApiUser | null) {
  const name = userDisplayName(user);
  const account = userAccountLabel(user);
  return account && account !== name ? `${name} · ${account}` : name;
}

function dateText(value: string | undefined | null) {
  if (!value) {
    return "-";
  }

  return value.slice(0, 10);
}

function billStatus(value: string) {
  return billStatusText[value] ?? value;
}

function statusClassName(value: string | boolean | undefined | null) {
  const status =
    typeof value === "boolean" ? (value ? "ACTIVE" : "INACTIVE") : value;
  const toneByStatus: Record<string, string> = {
    ACTIVE: "status--success",
    RECEIVED: "status--success",
    PAID: "status--success",
    CUSTOMER_CONFIRMED: "status--success",
    合作中: "status--success",
    启用: "status--success",

    PENDING_APPROVAL: "status--danger",
    UNPAID: "status--danger",

    PENDING_SETTLEMENT: "status--warning",
    PARTIALLY_PAID: "status--warning",
    ADJUSTED: "status--warning",

    INVOICED: "status--info",
    CONFIRMED: "status--info",
    INTERNAL_REVIEW: "status--info",
    FINANCE_REVIEW: "status--info",
    CUSTOMER_PENDING: "status--info",

    DRAFT: "status--draft",
    CLOSED: "status--closed",
    INACTIVE: "status--closed",
    已结束: "status--closed",
    停用: "status--closed",

    VOIDED: "status--void",
  };

  return `status ${toneByStatus[status ?? ""] ?? "status--neutral"}`;
}

function nextReceivableStatus(status: string) {
  if (status === "PENDING_APPROVAL") {
    return "PENDING_SETTLEMENT";
  }
  if (status === "PENDING_SETTLEMENT") {
    return "INVOICED";
  }
  if (status === "INVOICED") {
    return "RECEIVED";
  }
  return "";
}

function billSigningEntityName(bill: Bill) {
  return (
    bill.signingEntity?.shortName ??
    bill.signingEntity?.fullName ??
    bill.contract?.signingEntity?.shortName ??
    bill.contract?.signingEntity?.fullName ??
    "-"
  );
}

function billProjectName(bill: Bill) {
  return (
    bill.projectName?.trim() ||
    bill.items?.map((item) => item.name.trim()).find(Boolean) ||
    bill.settlements
      ?.flatMap((settlement) => settlement.items)
      .map((item) => item.projectName.trim())
      .find(Boolean) ||
    "-"
  );
}

function billOptionLabel(bill: Bill) {
  return `${bill.billNo} · ${bill.customer?.name ?? "-"} · ${billProjectName(
    bill,
  )}`;
}

function billAttachmentIds(bill: Bill) {
  return Array.from(
    new Set([
      ...(bill.evidenceAttachmentIds ?? []),
      ...(bill.invoiceAttachmentIds ?? []),
      ...(bill.receiptAttachmentIds ?? []),
    ]),
  );
}

function nextPayableStatus(status: string) {
  if (status === "UNPAID") {
    return "CONFIRMED";
  }
  if (status === "CONFIRMED" || status === "PARTIALLY_PAID") {
    return "PAID";
  }
  return "";
}

function paymentRecipientAccountText(recipient?: PaymentRecipient | null) {
  if (!recipient) {
    return "-";
  }

  return [
    paymentRecipientPlatformText[recipient.platform],
    recipient.accountName,
    recipient.accountNo,
    recipient.bankBranch,
  ]
    .filter(Boolean)
    .join(" / ");
}

function paymentRecipientOptionText(recipient: PaymentRecipient) {
  return `${recipient.name} · ${paymentRecipientAccountText(recipient)}`;
}

function payableAccountText(payable: Payable) {
  return [
    payable.receiptPlatform
      ? paymentRecipientPlatformText[payable.receiptPlatform]
      : undefined,
    payable.receiptAccountName,
    payable.receiptAccountNo,
    payable.receiptBankBranch,
  ]
    .filter(Boolean)
    .join(" / ");
}

function payableAttachmentStatusLabel(
  attachment: Attachment,
  payable?: Payable,
) {
  if (
    payable?.status === "PAID" ||
    payable?.paymentAllocations?.some(
      (allocation) => allocation.payment?.attachmentId === attachment.id,
    )
  ) {
    return "已支付";
  }
  if (payable?.status === "CONFIRMED") {
    return "已开票/确认";
  }
  return "未标记";
}

function attachmentStatusLabel(attachment: Attachment, bill?: Bill) {
  if (bill?.receiptAttachmentIds?.includes(attachment.id)) {
    return "已到账";
  }
  if (bill?.invoiceAttachmentIds?.includes(attachment.id)) {
    return "已开票";
  }
  if (bill?.evidenceAttachmentIds?.includes(attachment.id)) {
    return "待结算";
  }
  return "未标记";
}

function dateTimeText(value: string | undefined | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
  });
}

function isPreviewableAttachment(attachment: Attachment) {
  const contentType = attachment.contentType ?? "";
  const fileName = attachment.fileName.toLowerCase();
  return (
    contentType.includes("pdf") ||
    contentType.startsWith("image/") ||
    contentType.startsWith("text/") ||
    /\.(pdf|png|jpe?g|webp|txt|csv)$/i.test(fileName)
  );
}

const contractAttachmentMaxBytes = 20 * 1024 * 1024;

function contractPeriod(contract: Contract) {
  const start = dateText(contract.startDate);
  const end = dateText(contract.endDate);
  return `${start} 至 ${end === "-" ? "长期" : end}`;
}

function contractStatus(contract: Contract) {
  const endDate = dateText(contract.endDate);
  if (endDate === "-") {
    return "合作中";
  }

  const end = new Date(`${endDate}T23:59:59`);
  return end < new Date() ? "已结束" : "合作中";
}

function tierModeText(mode?: string | null) {
  if (mode === "ACCUMULATE") {
    return "增量累加";
  }
  if (mode === "FULL_COVERAGE") {
    return "全量覆盖";
  }
  return "无";
}

function moneyText(value?: string | null) {
  return value && value !== "null" ? value : "-";
}

function rateText(value?: string | null) {
  return value && value !== "null" ? `${value}%` : "-";
}

function contractBaseFee(contract: Contract) {
  return (
    contract.baseFee ??
    contract.chargeItems?.find((item) => item.name.includes("基础"))?.amount ??
    contract.chargeItems?.[0]?.amount ??
    "0.00"
  );
}

function contractTierSummary(contract: Contract) {
  if (!contract.tierMode || contract.tierMode === "NONE") {
    return "无";
  }

  const rules = contract.tierRules ?? [];
  if (rules.length === 0) {
    return tierModeText(contract.tierMode);
  }

  const firstRule = rules[0];
  if (!firstRule) {
    return tierModeText(contract.tierMode);
  }
  if (firstRule.description) {
    return `${tierModeText(contract.tierMode)}：${firstRule.description}`;
  }

  const suffix = rules.length > 1 ? ` 等 ${rules.length} 条` : "";
  return `${tierModeText(contract.tierMode)}：达 ${firstRule.threshold} 调整为 ${firstRule.serviceFeeRate}%${suffix}`;
}

function isContractFileValid(file: File) {
  return (
    file.size > 0 &&
    file.size <= contractAttachmentMaxBytes &&
    file.name.toLowerCase().endsWith(".pdf") &&
    (!file.type || file.type === "application/pdf")
  );
}

function isBusinessAttachmentValid(file: File) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    file.size > 0 &&
    file.size <= contractAttachmentMaxBytes &&
    (type === "application/pdf" ||
      type === "image/png" ||
      type === "image/jpeg" ||
      name.endsWith(".pdf") ||
      name.endsWith(".png") ||
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg"))
  );
}

function isGeneralAttachmentValid(file: File) {
  return file.size > 0 && file.size <= contractAttachmentMaxBytes;
}

function amountInput(value: number) {
  return Math.max(0, value).toFixed(2);
}

function messageTone(message: string) {
  return /失败|错误|不能|缺少|请先|已过期|不一致|不正确|无效|不能为空|格式不正确|不存在|重复|不符合要求|failed|error|forbidden|unauthorized|required|invalid|not found|conflict|expired/i.test(
    message,
  )
    ? "danger"
    : "info";
}

function creatableRoleCodesFor(userRoles: string[]) {
  if (userRoles.includes("admin")) {
    return tenantAdminDelegatedRoleCodes;
  }
  if (userRoles.includes("owner")) {
    return ownerDelegatedRoleCodes;
  }
  return [];
}

async function responseMessage(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await response.json()) as {
      message?: string | string[];
      error?: string;
    };
    if (Array.isArray(body.message)) {
      return body.message.join("；");
    }
    return body.message ?? body.error ?? response.statusText;
  }

  const text = await response.text();
  return text || response.statusText;
}

export default function Home() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<ApiUser | null>(null);
  const [message, setMessage] = useState(loginRequiredMessage);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [active, setActive] = useState<ModuleId>("dashboard");
  const [expandedNavGroups, setExpandedNavGroups] = useState<
    Record<string, boolean>
  >({ 租户设置: true });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [signingEntities, setSigningEntities] = useState<SigningEntity[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [costEntries, setCostEntries] = useState<CostEntry[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [paymentRecipients, setPaymentRecipients] = useState<
    PaymentRecipient[]
  >([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [users, setUsers] = useState<ConsoleUser[]>([]);
  const [superAdmins, setSuperAdmins] = useState<ConsoleUser[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [profits, setProfits] = useState<ProfitRow[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [periodMonth, setPeriodMonth] = useState("2026-04");
  const [customerCode, setCustomerCode] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerFullName, setCustomerFullName] = useState("");
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(
    null,
  );
  const [signingEntityCode, setSigningEntityCode] = useState("");
  const [signingEntityShortName, setSigningEntityShortName] = useState("");
  const [signingEntityFullName, setSigningEntityFullName] = useState("");
  const [
    signingEntityLegalRepresentative,
    setSigningEntityLegalRepresentative,
  ] = useState("");
  const [signingEntityTaxpayerType, setSigningEntityTaxpayerType] =
    useState<TaxpayerType>("SMALL_SCALE");
  const [signingEntityDialogOpen, setSigningEntityDialogOpen] = useState(false);
  const [editingSigningEntityId, setEditingSigningEntityId] = useState<
    string | null
  >(null);
  const [contractCode, setContractCode] = useState("");
  const [contractFee, setContractFee] = useState("10000.00");
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [editingContractId, setEditingContractId] = useState<string | null>(
    null,
  );
  const [contractStartDate, setContractStartDate] = useState(
    `${periodMonth}-01`,
  );
  const [contractEndDate, setContractEndDate] = useState("");
  const [contractCustomerContact, setContractCustomerContact] = useState("");
  const [contractIncentiveUnitPrice, setContractIncentiveUnitPrice] =
    useState("0.00");
  const [contractServiceFeeRate, setContractServiceFeeRate] = useState("0");
  const [contractTierMode, setContractTierMode] = useState("NONE");
  const [contractTierDescription, setContractTierDescription] = useState("");
  const [contractFiles, setContractFiles] = useState<File[]>([]);
  const [contractDetailOpen, setContractDetailOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedSigningEntityId, setSelectedSigningEntityId] = useState("");
  const [selectedContractId, setSelectedContractId] = useState("");
  const [selectedBillId, setSelectedBillId] = useState("");
  const [billDialogOpen, setBillDialogOpen] = useState(false);
  const [receivableTab, setReceivableTab] = useState<"open" | "received">(
    "open",
  );
  const [payableTab, setPayableTab] = useState<"bills" | "paid" | "recipients">(
    "bills",
  );
  const [receivableProjectName, setReceivableProjectName] = useState("");
  const [receivableSigningEntityId, setReceivableSigningEntityId] =
    useState("");
  const [receivableAmount, setReceivableAmount] = useState("0.00");
  const [billStatusDialogOpen, setBillStatusDialogOpen] = useState(false);
  const [billStatusTarget, setBillStatusTarget] = useState("");
  const [billStatusFiles, setBillStatusFiles] = useState<File[]>([]);
  const [billAttachmentsDialogOpen, setBillAttachmentsDialogOpen] =
    useState(false);
  const [billAttachments, setBillAttachments] = useState<Attachment[]>([]);
  const [attachmentPreview, setAttachmentPreview] =
    useState<AttachmentPreview | null>(null);
  const [payableDialogOpen, setPayableDialogOpen] = useState(false);
  const [selectedPayableId, setSelectedPayableId] = useState("");
  const [selectedPaymentRecipientId, setSelectedPaymentRecipientId] =
    useState("");
  const [payableRecipientSearch, setPayableRecipientSearch] = useState("");
  const [payableAmount, setPayableAmount] = useState("0.00");
  const [payableRemarks, setPayableRemarks] = useState("");
  const [payableStatusDialogOpen, setPayableStatusDialogOpen] = useState(false);
  const [payableStatusTarget, setPayableStatusTarget] = useState("");
  const [payableStatusFiles, setPayableStatusFiles] = useState<File[]>([]);
  const [payableAttachmentsDialogOpen, setPayableAttachmentsDialogOpen] =
    useState(false);
  const [payableAttachments, setPayableAttachments] = useState<Attachment[]>(
    [],
  );
  const [recipientAttachmentsDialogOpen, setRecipientAttachmentsDialogOpen] =
    useState(false);
  const [recipientAttachments, setRecipientAttachments] = useState<
    Attachment[]
  >([]);
  const [payablePaymentAccount, setPayablePaymentAccount] =
    useState("默认付款账户");
  const [receiptAccount, setReceiptAccount] = useState("默认收款账户");
  const [recipientDialogOpen, setRecipientDialogOpen] = useState(false);
  const [editingRecipientId, setEditingRecipientId] = useState<string | null>(
    null,
  );
  const [recipientName, setRecipientName] = useState("");
  const [recipientPlatform, setRecipientPlatform] =
    useState<PaymentRecipientPlatform>("PRIVATE_BANK");
  const [recipientAccountName, setRecipientAccountName] = useState("");
  const [recipientAccountNo, setRecipientAccountNo] = useState("");
  const [recipientBankBranch, setRecipientBankBranch] = useState("");
  const [recipientFiles, setRecipientFiles] = useState<File[]>([]);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRoleCode, setNewUserRoleCode] = useState("");
  const [newUserIsActive, setNewUserIsActive] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [superAdminDialogOpen, setSuperAdminDialogOpen] = useState(false);
  const [editingSuperAdminId, setEditingSuperAdminId] = useState<string | null>(
    null,
  );
  const [superAdminName, setSuperAdminName] = useState("");
  const [superAdminPhone, setSuperAdminPhone] = useState("");
  const [superAdminPassword, setSuperAdminPassword] = useState("");
  const [superAdminConfirmPassword, setSuperAdminConfirmPassword] =
    useState("");
  const [superAdminIsActive, setSuperAdminIsActive] = useState(true);
  const [tenantDialogOpen, setTenantDialogOpen] = useState(false);
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState("");
  const [tenantAdminName, setTenantAdminName] = useState("");
  const [tenantAdminPhone, setTenantAdminPhone] = useState("");
  const [tenantAdminPassword, setTenantAdminPassword] = useState("");
  const [tenantAdminConfirmPassword, setTenantAdminConfirmPassword] =
    useState("");
  const [tenantUserDialogOpen, setTenantUserDialogOpen] = useState(false);
  const [editingTenantUser, setEditingTenantUser] = useState<{
    tenantId: string;
    user: ConsoleUser;
  } | null>(null);
  const [tenantUserName, setTenantUserName] = useState("");
  const [tenantUserPhone, setTenantUserPhone] = useState("");
  const [tenantUserPassword, setTenantUserPassword] = useState("");
  const [tenantUserConfirmPassword, setTenantUserConfirmPassword] =
    useState("");
  const [tenantUserRoleCode, setTenantUserRoleCode] = useState("owner");
  const [tenantUserIsActive, setTenantUserIsActive] = useState(true);

  const selectedBill = bills.find((bill) => bill.id === selectedBillId);
  const selectedPayable = payables.find(
    (payable) => payable.id === selectedPayableId,
  );
  const selectedPaymentRecipient = paymentRecipients.find(
    (recipient) => recipient.id === selectedPaymentRecipientId,
  );
  const selectedContract = contracts.find(
    (contract) => contract.id === selectedContractId,
  );
  const editingCustomer = customers.find(
    (customer) => customer.id === editingCustomerId,
  );
  const editingSigningEntity = signingEntities.find(
    (entity) => entity.id === editingSigningEntityId,
  );
  const editingContract = contracts.find(
    (contract) => contract.id === editingContractId,
  );
  const editingRecipient = paymentRecipients.find(
    (recipient) => recipient.id === editingRecipientId,
  );
  const editingConsoleUser = users.find((item) => item.id === editingUserId);
  const editingSuperAdmin = superAdmins.find(
    (item) => item.id === editingSuperAdminId,
  );
  const editingTenant = tenants.find((item) => item.id === editingTenantId);
  const activeModule = getModuleMeta(active);
  const isLoggedIn = Boolean(token && user);
  const userRoleCodes = user?.roles ?? [];
  const isSuperAdmin = userRoleCodes.includes("super_admin");
  const hasTenantIdentityAccess =
    userRoleCodes.includes("admin") || userRoleCodes.includes("owner");
  const isPlatformModule = platformModuleIds.includes(active);
  const hasPermission = (...permissions: string[]) => {
    if (permissions.length === 0) {
      return true;
    }
    if (permissions.includes("tenant.manage")) {
      return isSuperAdmin;
    }
    if (permissions.includes("user.manage")) {
      return hasTenantIdentityAccess;
    }
    return (
      user?.permissions.some((permission) =>
        permissions.includes(permission),
      ) ?? false
    );
  };
  const tenantRoleOptions = roles.filter((role) =>
    tenantAdminDelegatedRoleCodes.includes(role.code),
  );
  const creatableRoleCodes = creatableRoleCodesFor(userRoleCodes);
  const creatableRoles = roles.filter((role) =>
    creatableRoleCodes.includes(role.code),
  );
  const currentMessageTone = messageTone(message);
  const visibleNavItems = navItems
    .map((item) => {
      if (item.kind === "module") {
        if (isSuperAdmin) {
          return platformModuleIds.includes(item.id) ? item : null;
        }
        return platformModuleIds.includes(item.id) ? null : item;
      }
      const children = item.children.filter((childId) =>
        isSuperAdmin
          ? platformModuleIds.includes(childId)
          : !platformModuleIds.includes(childId),
      ) as [ModuleId, ...ModuleId[]];
      return children.length > 0 ? { ...item, children } : null;
    })
    .filter((item): item is (typeof navItems)[number] => Boolean(item));
  const actionBlockReason = (...permissions: string[]) => {
    if (!isLoggedIn) {
      return loginRequiredMessage;
    }
    if (!hasPermission(...permissions)) {
      return `当前账号缺少${permissions
        .map((permission) => permissionLabels[permission] ?? permission)
        .join("、")}权限。`;
    }

    return "";
  };
  function updatePeriodMonth(value: string) {
    if (!value) {
      return;
    }
    setPeriodMonth(value);
  }

  function applyRememberedLoginCredentials() {
    const rememberedCredentials = readLoginCredentials();
    setEmail(rememberedCredentials?.email ?? "");
    setPassword(rememberedCredentials?.password ?? "");
  }

  function applyConsoleData(data: ConsoleData) {
    setCustomers(data.customers);
    setSigningEntities(data.signingEntities);
    setContracts(data.contracts);
    setBills(data.bills);
    setInvoices(data.invoices);
    setReceipts(data.receipts);
    setCostEntries(data.costEntries);
    setPayables(data.payables);
    setPaymentRecipients(data.paymentRecipients);
    setPaymentRequests(data.paymentRequests);
    setPayments(data.payments);
    setUsers(data.users);
    setSuperAdmins(data.superAdmins);
    setTenants(data.tenants);
    setRoles(data.roles);
    setAuditLogs(data.auditLogs);
    setProfits(data.profits);
    setSelectedCustomerId((current) =>
      data.customers.some((customer) => customer.id === current)
        ? current
        : (data.customers[0]?.id ?? ""),
    );
    setSelectedSigningEntityId((current) =>
      data.signingEntities.some((entity) => entity.id === current)
        ? current
        : (data.signingEntities[0]?.id ?? ""),
    );
    setSelectedContractId((current) =>
      data.contracts.some((contract) => contract.id === current)
        ? current
        : (data.contracts[0]?.id ?? ""),
    );
    setSelectedBillId((current) =>
      data.bills.some((bill) => bill.id === current)
        ? current
        : (data.bills[0]?.id ?? ""),
    );
    setSelectedPayableId((current) =>
      data.payables.some((payable) => payable.id === current)
        ? current
        : (data.payables[0]?.id ?? ""),
    );
    setSelectedPaymentRecipientId((current) =>
      data.paymentRecipients.some((recipient) => recipient.id === current)
        ? current
        : (data.paymentRecipients[0]?.id ?? ""),
    );
    setNewUserRoleCode((current) =>
      data.roles.some(
        (role) =>
          role.code === current && creatableRoleCodes.includes(role.code),
      )
        ? current
        : (data.roles.find((role) => creatableRoleCodes.includes(role.code))
            ?.code ?? "business_owner"),
    );
  }

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = window.setTimeout(() => {
      setMessage((current) => (current === message ? "" : current));
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    applyRememberedLoginCredentials();
  }, []);

  useEffect(() => {
    const cachedSession = readAuthSessionCookie();
    if (!cachedSession) {
      return;
    }

    setToken(cachedSession.accessToken);
    setUser(cachedSession.user);
    setMessage(`正在恢复登录态：${cachedSession.user.name}`);
    void refresh(cachedSession.accessToken).catch((error: unknown) =>
      setMessage(
        error instanceof Error
          ? translateErrorMessage(error.message)
          : authExpiredMessage,
      ),
    );
  }, []);

  useEffect(() => {
    const roleCodes = user?.roles ?? [];
    if (
      roleCodes.includes("super_admin") &&
      !platformModuleIds.includes(active)
    ) {
      setActive("superAdmins");
    }
    if (
      !roleCodes.includes("super_admin") &&
      platformModuleIds.includes(active)
    ) {
      setActive("dashboard");
    }
  }, [active, user]);

  function resetSession(message = authExpiredMessage) {
    setToken("");
    setUser(null);
    clearAuthSessionCookie();
    applyConsoleData(emptyConsoleData());
    setMessage(message);
  }

  function logout() {
    resetSession(loginRequiredMessage);
    applyRememberedLoginCredentials();
    setLoginDialogOpen(false);
  }

  async function request<T>(
    path: string,
    init?: RequestInit,
    options: { auth?: boolean } = {},
  ): Promise<T> {
    const useAuth = options.auth ?? true;
    const response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(useAuth && token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const message = await responseMessage(response);
      if (useAuth && response.status === 401) {
        resetSession();
        throw new Error(authExpiredMessage);
      }

      throw new Error(translateErrorMessage(message));
    }

    return (await response.json()) as T;
  }

  async function refresh(nextToken = token) {
    if (!nextToken) {
      setMessage(loginRequiredMessage);
      return;
    }

    const authHeader = { Authorization: `Bearer ${nextToken}` };
    const fetchJson = async <TValue,>(path: string): Promise<TValue> => {
      const response = await fetch(`${apiBase}${path}`, {
        headers: authHeader,
      });
      if (!response.ok) {
        const message = await responseMessage(response);
        if (response.status === 401) {
          resetSession();
          throw new Error(authExpiredMessage);
        }

        throw new Error(translateErrorMessage(message));
      }

      return (await response.json()) as TValue;
    };
    const currentUser = await fetchJson<ApiUser>("/auth/me");
    setUser(currentUser);
    writeAuthSessionCookie({ accessToken: nextToken, user: currentUser });

    const nextUserRoleCodes = currentUser.roles ?? [];
    const nextIsSuperAdmin = nextUserRoleCodes.includes("super_admin");
    const nextHasTenantIdentityAccess =
      nextUserRoleCodes.includes("admin") ||
      nextUserRoleCodes.includes("owner");
    const can = (...permissions: string[]) => {
      if (permissions.includes("tenant.manage")) {
        return nextIsSuperAdmin;
      }
      if (permissions.includes("user.manage")) {
        return nextHasTenantIdentityAccess;
      }
      return currentUser.permissions.some((permission) =>
        permissions.includes(permission),
      );
    };
    const fetchIf = async <TValue,>(
      allowed: boolean,
      path: string,
      fallback: TValue,
    ) => (allowed ? fetchJson<TValue>(path) : fallback);

    const [
      nextCustomers,
      nextSigningEntities,
      nextContracts,
      nextBills,
      nextInvoices,
      nextReceipts,
      nextCostEntries,
      nextPayables,
      nextPaymentRecipients,
      nextRequests,
      nextPayments,
      nextUsers,
      nextRoles,
      nextSuperAdmins,
      nextTenants,
      nextAuditLogs,
      nextProfits,
    ] = await Promise.all([
      fetchIf<Customer[] | PaginatedResponse<Customer>>(
        can("customer.read_all", "customer.read_own"),
        "/customers?pageSize=50",
        emptyPage<Customer>(),
      ),
      fetchIf<SigningEntity[] | PaginatedResponse<SigningEntity>>(
        can("customer.read_all", "customer.read_own"),
        "/signing-entities?pageSize=50",
        emptyPage<SigningEntity>(),
      ),
      fetchIf<Contract[] | PaginatedResponse<Contract>>(
        can("customer.read_all", "customer.read_own"),
        "/contracts?pageSize=50",
        emptyPage<Contract>(),
      ),
      fetchIf<Bill[] | PaginatedResponse<Bill>>(
        can(
          "customer.read_all",
          "customer.read_own",
          "bill.manage",
          "bill.approve",
          "receivable.settle",
        ),
        `/bills?periodMonth=${periodMonth}&pageSize=50`,
        emptyPage<Bill>(),
      ),
      fetchIf<Invoice[] | PaginatedResponse<Invoice>>(
        can("invoice.manage"),
        "/invoices?pageSize=50",
        emptyPage<Invoice>(),
      ),
      fetchIf<Receipt[] | PaginatedResponse<Receipt>>(
        can("receipt.manage"),
        "/receipts?pageSize=50",
        emptyPage<Receipt>(),
      ),
      fetchIf<CostEntry[] | PaginatedResponse<CostEntry>>(
        can("cost.manage"),
        `/cost-entries?periodMonth=${periodMonth}&pageSize=50`,
        emptyPage<CostEntry>(),
      ),
      fetchIf<Payable[] | PaginatedResponse<Payable>>(
        can("cost.manage", "payable.settle", "payment.pay"),
        "/payables?pageSize=50",
        emptyPage<Payable>(),
      ),
      fetchIf<PaymentRecipient[] | PaginatedResponse<PaymentRecipient>>(
        can("cost.manage"),
        "/payment-recipients?pageSize=100",
        emptyPage<PaymentRecipient>(),
      ),
      fetchIf<PaymentRequest[] | PaginatedResponse<PaymentRequest>>(
        can("payment_request.create", "payment_request.approve", "payment.pay"),
        "/payment-requests?pageSize=50",
        emptyPage<PaymentRequest>(),
      ),
      fetchIf<Payment[] | PaginatedResponse<Payment>>(
        can("payment.pay", "payable.settle"),
        "/payments?pageSize=50",
        emptyPage<Payment>(),
      ),
      fetchIf<ConsoleUser[] | PaginatedResponse<ConsoleUser>>(
        can("user.manage"),
        "/identity/users?pageSize=50",
        emptyPage<ConsoleUser>(),
      ),
      fetchIf<Role[]>(can("user.manage"), "/identity/roles", []),
      fetchIf<ConsoleUser[] | PaginatedResponse<ConsoleUser>>(
        nextIsSuperAdmin,
        "/super-admins?pageSize=100",
        emptyPage<ConsoleUser>(),
      ),
      fetchIf<Tenant[] | PaginatedResponse<Tenant>>(
        nextIsSuperAdmin,
        "/tenants?pageSize=100",
        emptyPage<Tenant>(),
      ),
      fetchIf<AuditLog[] | PaginatedResponse<AuditLog>>(
        can("audit.view"),
        "/audit-logs?pageSize=30",
        emptyPage<AuditLog>(),
      ),
      fetchIf<ProfitRow[]>(
        can("report.view"),
        `/reports/customer-profit?periodMonth=${periodMonth}`,
        [],
      ),
    ]);

    applyConsoleData({
      customers: listItems(nextCustomers),
      signingEntities: listItems(nextSigningEntities),
      contracts: listItems(nextContracts),
      bills: listItems(nextBills),
      invoices: listItems(nextInvoices),
      receipts: listItems(nextReceipts),
      costEntries: listItems(nextCostEntries),
      payables: listItems(nextPayables),
      paymentRecipients: listItems(nextPaymentRecipients),
      paymentRequests: listItems(nextRequests),
      payments: listItems(nextPayments),
      users: listItems(nextUsers),
      roles: nextRoles,
      superAdmins: listItems(nextSuperAdmins),
      tenants: listItems(nextTenants),
      auditLogs: listItems(nextAuditLogs),
      profits: nextProfits,
    });
    setMessage("正式数据已刷新");
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const loginAccount = email.trim();
    if (!loginAccount || !password) {
      setMessage("登录失败：账号和密码不能为空。");
      setLoginDialogOpen(true);
      return;
    }

    try {
      const result = await request<{
        accessToken: string;
        user: ApiUser;
      }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email: loginAccount, password }),
        },
        { auth: false },
      );
      writeLoginCredentials({ email: loginAccount, password });
      writeAuthSessionCookie({
        accessToken: result.accessToken,
        user: result.user,
      });
      setToken(result.accessToken);
      setUser(result.user);
      setEmail(loginAccount);
      setLoginDialogOpen(false);
      setMessage(`已登录：${result.user.name}`);
      try {
        await refresh(result.accessToken);
      } catch (refreshError) {
        setMessage(
          refreshError instanceof Error
            ? `已登录，但刷新数据失败：${translateErrorMessage(refreshError.message)}`
            : `已登录：${result.user.name}`,
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `登录失败：${translateErrorMessage(error.message)}`
          : "登录失败，请检查后端服务",
      );
      setLoginDialogOpen(true);
    }
  }

  function summarizeAction(label: string, result: unknown) {
    const summary = result as ActionSummary | undefined;
    if (label === "生成月度账单" && summary && typeof summary === "object") {
      if (summary.failed) {
        const firstError = summary.results?.find((item) => item.error)?.error;
        return `${label}失败：${translateErrorMessage(firstError ?? "存在失败合同")}`;
      }
      if (!summary.created && !summary.skipped) {
        return "生成月度账单未产生账单：当前账期没有可计费的 ACTIVE 合同。";
      }
      if (!summary.created && summary.skipped) {
        return "生成月度账单未产生新账单：当前账期账单已存在。";
      }

      return `${label}完成：新增 ${summary.created ?? 0} 张账单`;
    }

    return `${label}完成`;
  }

  async function submitAction(
    label: string,
    permissions: string[],
    action: () => Promise<unknown>,
  ) {
    try {
      const blockedReason = actionBlockReason(...permissions);
      if (blockedReason) {
        setMessage(`${label}失败：${blockedReason}`);
        return;
      }

      setMessage(`${label}处理中`);
      const result = await action();
      await refresh();
      setMessage(summarizeAction(label, result));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `${label}失败：${translateErrorMessage(error.message)}`
          : `${label}失败`,
      );
    }
  }

  function resetCustomerForm() {
    setCustomerCode(nextCustomerCode(customers));
    setCustomerName("");
    setCustomerFullName("");
    setEditingCustomerId(null);
  }

  function openCreateCustomerDialog() {
    const blockedReason = actionBlockReason("customer.write");
    if (blockedReason) {
      setMessage(`新增客户失败：${blockedReason}`);
      return;
    }

    resetCustomerForm();
    setCustomerDialogOpen(true);
  }

  function openEditCustomerDialog(customer: Customer) {
    const blockedReason = actionBlockReason("customer.write");
    if (blockedReason) {
      setMessage(`编辑客户失败：${blockedReason}`);
      return;
    }

    setSelectedCustomerId(customer.id);
    setEditingCustomerId(customer.id);
    setCustomerCode(customer.code);
    setCustomerName(customer.name);
    setCustomerFullName(customer.fullName ?? customer.name);
    setCustomerDialogOpen(true);
  }

  function closeCustomerDialog() {
    setCustomerDialogOpen(false);
    setEditingCustomerId(null);
  }

  function resetUserForm() {
    setNewUserEmail("");
    setNewUserName("");
    setNewUserPassword("");
    setNewUserRoleCode(creatableRoles[0]?.code ?? "");
    setNewUserIsActive(true);
    setEditingUserId(null);
  }

  function openCreateUserDialog() {
    const blockedReason = actionBlockReason("user.manage");
    if (blockedReason) {
      setMessage(`新建内部用户失败：${blockedReason}`);
      return;
    }
    if (creatableRoles.length === 0) {
      setMessage("新建内部用户失败：请先确认系统角色已初始化。");
      return;
    }

    resetUserForm();
    setUserDialogOpen(true);
  }

  function closeUserDialog() {
    setUserDialogOpen(false);
    setEditingUserId(null);
  }

  function openEditUserDialog(item: ConsoleUser) {
    const blockedReason = actionBlockReason("user.manage");
    if (blockedReason) {
      setMessage(`编辑内部用户失败：${blockedReason}`);
      return;
    }
    const isSelfEdit = item.id === user?.id;
    const roleCodes = item.roles.map((role) => role.code);
    const canManageUserRoles =
      isSelfEdit ||
      (userRoleCodes.includes("admin") &&
        roleCodes.every((roleCode) =>
          tenantAdminDelegatedRoleCodes.includes(roleCode),
        )) ||
      (userRoleCodes.includes("owner") &&
        roleCodes.every((roleCode) =>
          ownerDelegatedRoleCodes.includes(roleCode),
        ));
    if (!canManageUserRoles) {
      setMessage(
        userRoleCodes.includes("admin")
          ? "编辑内部用户失败：租户管理员只能管理总负责人、业务负责人和财务角色。"
          : "编辑内部用户失败：总负责人只能管理业务负责人和财务角色。",
      );
      return;
    }

    setEditingUserId(item.id);
    setNewUserEmail(item.phone ?? item.email);
    setNewUserName(item.name);
    setNewUserPassword("");
    setNewUserRoleCode(
      roleCodes.find((roleCode) =>
        creatableRoles.some((role) => role.code === roleCode),
      ) ??
        creatableRoles[0]?.code ??
        "",
    );
    setNewUserIsActive(item.isActive);
    setUserDialogOpen(true);
  }

  function deleteConsoleUser(item: ConsoleUser) {
    const blockedReason = actionBlockReason("user.manage");
    if (blockedReason) {
      setMessage(`删除内部用户失败：${blockedReason}`);
      return;
    }
    if (item.id === user?.id) {
      setMessage("删除内部用户失败：不能删除当前登录账号。");
      return;
    }
    const roleCodes = item.roles.map((role) => role.code);
    const canManageUserRoles =
      (userRoleCodes.includes("admin") &&
        roleCodes.every((roleCode) =>
          tenantAdminDelegatedRoleCodes.includes(roleCode),
        )) ||
      (userRoleCodes.includes("owner") &&
        roleCodes.every((roleCode) =>
          ownerDelegatedRoleCodes.includes(roleCode),
        ));
    if (!canManageUserRoles) {
      setMessage(
        userRoleCodes.includes("admin")
          ? "删除内部用户失败：租户管理员只能删除总负责人、业务负责人和财务角色。"
          : "删除内部用户失败：总负责人只能删除业务负责人和财务角色。",
      );
      return;
    }

    const confirmed =
      typeof window === "undefined" ||
      window.confirm(`确认删除内部用户 ${item.name}？`);
    if (!confirmed) {
      return;
    }

    void submitAction("删除内部用户", ["user.manage"], () =>
      request(`/identity/users/${item.id}`, { method: "DELETE" }),
    );
  }

  function resetSigningEntityForm() {
    setSigningEntityCode(nextSigningEntityCode(signingEntities));
    setSigningEntityShortName("");
    setSigningEntityFullName("");
    setSigningEntityLegalRepresentative("");
    setSigningEntityTaxpayerType("SMALL_SCALE");
    setEditingSigningEntityId(null);
  }

  function openCreateSigningEntityDialog() {
    const blockedReason = actionBlockReason("contract.write");
    if (blockedReason) {
      setMessage(`新增主体失败：${blockedReason}`);
      return;
    }

    resetSigningEntityForm();
    setSigningEntityDialogOpen(true);
  }

  function openEditSigningEntityDialog(entity: SigningEntity) {
    const blockedReason = actionBlockReason("contract.write");
    if (blockedReason) {
      setMessage(`编辑主体失败：${blockedReason}`);
      return;
    }

    setSelectedSigningEntityId(entity.id);
    setEditingSigningEntityId(entity.id);
    setSigningEntityCode(entity.code);
    setSigningEntityShortName(entity.shortName);
    setSigningEntityFullName(entity.fullName);
    setSigningEntityLegalRepresentative(entity.legalRepresentative);
    setSigningEntityTaxpayerType(entity.taxpayerType);
    setSigningEntityDialogOpen(true);
  }

  function closeSigningEntityDialog() {
    setSigningEntityDialogOpen(false);
    setEditingSigningEntityId(null);
  }

  function resetContractForm(nextCustomerId = selectedCustomerId) {
    const nextStartDate = `${periodMonth}-01`;
    setContractCode(nextContractCode(contracts, nextStartDate));
    setContractFee("10000.00");
    setContractStartDate(nextStartDate);
    setContractEndDate("");
    setContractCustomerContact("");
    setContractIncentiveUnitPrice("0.00");
    setContractServiceFeeRate("0");
    setContractTierMode("NONE");
    setContractTierDescription("");
    setContractFiles([]);
    setEditingContractId(null);
    setSelectedCustomerId(nextCustomerId || customers[0]?.id || "");
    setSelectedSigningEntityId(signingEntities[0]?.id || "");
  }

  function openCreateContractDialog() {
    const blockedReason = actionBlockReason("contract.write");
    if (blockedReason) {
      setMessage(`新增合同失败：${blockedReason}`);
      return;
    }
    if (customers.length === 0) {
      setMessage("新增合同失败：请先创建客户。");
      return;
    }
    if (signingEntities.length === 0) {
      setMessage("新增合同失败：请先创建签约主体。");
      return;
    }

    resetContractForm(selectedCustomerId || customers[0]?.id || "");
    setContractDialogOpen(true);
  }

  function openEditContractDialog(contract: Contract) {
    const blockedReason = actionBlockReason("contract.write");
    if (blockedReason) {
      setMessage(`编辑合同失败：${blockedReason}`);
      return;
    }

    const firstRule = contract.tierRules?.[0];
    setSelectedContractId(contract.id);
    setSelectedCustomerId(contract.customerId ?? contract.customer?.id ?? "");
    setSelectedSigningEntityId(
      contract.signingEntityId ?? contract.signingEntity?.id ?? "",
    );
    setEditingContractId(contract.id);
    setContractCode(contract.code);
    setContractFee(contractBaseFee(contract));
    setContractStartDate(dateText(contract.startDate));
    setContractEndDate(
      dateText(contract.endDate) === "-" ? "" : dateText(contract.endDate),
    );
    setContractCustomerContact(contract.customerContactText ?? "");
    setContractIncentiveUnitPrice(contract.incentiveUnitPrice ?? "0.00");
    setContractServiceFeeRate(contract.serviceFeeRate ?? "0");
    setContractTierMode(contract.tierMode ?? "NONE");
    setContractTierDescription(firstRule?.description ?? "");
    setContractFiles([]);
    setContractDialogOpen(true);
  }

  function updateContractStartDate(value: string) {
    setContractStartDate(value);
    if (!editingContractId) {
      setContractCode(nextContractCode(contracts, value));
    }
  }

  function closeContractDialog() {
    setContractDialogOpen(false);
    setEditingContractId(null);
    setContractFiles([]);
  }

  function openContractDetail(contract: Contract) {
    setSelectedContractId(contract.id);
    setAttachmentPreview(null);
    setContractDetailOpen(true);
  }

  function closeContractDetail() {
    setContractDetailOpen(false);
    setAttachmentPreview(null);
  }

  function updateContractFiles(fileList: FileList | null) {
    const nextFiles = Array.from(fileList ?? []);
    const invalid = nextFiles.find((file) => !isContractFileValid(file));
    if (invalid) {
      setContractFiles([]);
      setMessage(
        `合同附件 ${invalid.name} 不符合要求：必须是 PDF，且小于 20MB。`,
      );
      return;
    }

    setContractFiles(nextFiles);
  }

  async function uploadAttachment(
    ownerType: string | undefined,
    ownerId: string | undefined,
    file: File,
  ) {
    const presigned = await request<{
      attachment: { id: string };
      upload: {
        url: string;
        method: "PUT";
        headers: Record<string, string>;
      };
    }>("/attachments/presign-upload", {
      method: "POST",
      body: JSON.stringify({
        ...(ownerType && ownerId ? { ownerType, ownerId } : {}),
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      }),
    });

    const uploadResponse = await fetch(presigned.upload.url, {
      method: presigned.upload.method,
      headers: presigned.upload.headers,
      body: file,
    });
    if (!uploadResponse.ok) {
      throw new Error(`${file.name} 上传失败。`);
    }

    return presigned.attachment.id;
  }

  async function uploadContractFiles(files: File[]) {
    const attachmentIds: string[] = [];
    for (const file of files) {
      attachmentIds.push(await uploadAttachment(undefined, undefined, file));
    }
    return attachmentIds;
  }

  async function uploadAttachments(
    ownerType: string,
    ownerId: string,
    files: File[],
  ) {
    const attachmentIds: string[] = [];
    for (const file of files) {
      attachmentIds.push(await uploadAttachment(ownerType, ownerId, file));
    }
    return attachmentIds;
  }

  function updateBusinessFiles(
    fileList: FileList | null,
    setter: (files: File[]) => void,
    label: string,
  ) {
    const nextFiles = Array.from(fileList ?? []);
    const invalid = nextFiles.find((file) => !isBusinessAttachmentValid(file));
    if (invalid) {
      setter([]);
      setMessage(
        `${label} ${invalid.name} 不符合要求：仅支持 PDF、PNG、JPG，且小于 20MB。`,
      );
      return;
    }

    setter(nextFiles);
  }

  function updateGeneralFiles(
    fileList: FileList | null,
    setter: (files: File[]) => void,
    label: string,
  ) {
    const nextFiles = Array.from(fileList ?? []);
    const invalid = nextFiles.find((file) => !isGeneralAttachmentValid(file));
    if (invalid) {
      setter([]);
      setMessage(`${label} ${invalid.name} 不符合要求：单个文件需小于 20MB。`);
      return;
    }

    setter(nextFiles);
  }

  function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customerName.trim() || !customerFullName.trim()) {
      setMessage("保存客户失败：客户简称和客户全称不能为空。");
      return;
    }

    const isEditing = Boolean(editingCustomerId);
    void submitAction(
      isEditing ? "修改客户" : "创建客户",
      ["customer.write"],
      async () => {
        const payload = {
          name: customerName,
          fullName: customerFullName,
          status: editingCustomer?.status ?? "ACTIVE",
        };
        const result = await request(
          isEditing ? `/customers/${editingCustomerId}` : "/customers",
          {
            method: isEditing ? "PATCH" : "POST",
            body: JSON.stringify(payload),
          },
        );
        setCustomerDialogOpen(false);
        resetCustomerForm();
        return result;
      },
    );
  }

  function deleteCustomer(customer: Customer) {
    const confirmed =
      typeof window === "undefined" ||
      window.confirm(`确认删除客户 ${customer.name}？`);
    if (!confirmed) {
      return;
    }

    void submitAction("删除客户", ["customer.write"], () =>
      request(`/customers/${customer.id}`, { method: "DELETE" }),
    );
  }

  function saveSigningEntity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !signingEntityShortName.trim() ||
      !signingEntityFullName.trim() ||
      !signingEntityLegalRepresentative.trim()
    ) {
      setMessage("保存签约主体失败：简称、全称和法人姓名不能为空。");
      return;
    }

    const isEditing = Boolean(editingSigningEntityId);
    void submitAction(
      isEditing ? "修改签约主体" : "创建签约主体",
      ["contract.write"],
      async () => {
        const result = await request(
          isEditing
            ? `/signing-entities/${editingSigningEntityId}`
            : "/signing-entities",
          {
            method: isEditing ? "PATCH" : "POST",
            body: JSON.stringify({
              shortName: signingEntityShortName,
              fullName: signingEntityFullName,
              legalRepresentative: signingEntityLegalRepresentative,
              taxpayerType: signingEntityTaxpayerType,
            }),
          },
        );
        setSigningEntityDialogOpen(false);
        resetSigningEntityForm();
        return result;
      },
    );
  }

  function deleteSigningEntity(entity: SigningEntity) {
    const confirmed =
      typeof window === "undefined" ||
      window.confirm(`确认删除签约主体 ${entity.shortName}？`);
    if (!confirmed) {
      return;
    }

    void submitAction("删除签约主体", ["contract.write"], () =>
      request(`/signing-entities/${entity.id}`, { method: "DELETE" }),
    );
  }

  function createConsoleUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const isEditing = Boolean(editingUserId);
    const isEditingSelf = Boolean(editingUserId && editingUserId === user?.id);
    if (!newUserEmail.trim() || !newUserName.trim()) {
      setMessage("保存用户失败：登录账号和姓名不能为空。");
      return;
    }
    if (!isEditing && !newUserPassword.trim()) {
      setMessage("创建用户失败：初始密码不能为空。");
      return;
    }
    if (!newUserRoleCode) {
      setMessage("保存用户失败：请选择有效角色。");
      return;
    }

    void submitAction(
      isEditing ? "修改用户" : "创建用户",
      ["user.manage"],
      async () => {
        const payload = {
          account: newUserEmail,
          name: newUserName,
          ...(isEditingSelf
            ? {}
            : { roleCodes: [newUserRoleCode], isActive: newUserIsActive }),
          ...(newUserPassword.trim() ? { password: newUserPassword } : {}),
        };
        const result = await request(
          isEditing ? `/identity/users/${editingUserId}` : "/identity/users",
          {
            method: isEditing ? "PATCH" : "POST",
            body: JSON.stringify(payload),
          },
        );
        setUserDialogOpen(false);
        resetUserForm();
        return result;
      },
    );
  }

  function updateRolePermission(
    role: Role,
    permissionCode: string,
    enabled: boolean,
  ) {
    const currentCodes =
      role.permissions?.map((item) => item.permission.code) ?? [];
    const nextCodes = enabled
      ? Array.from(new Set([...currentCodes, permissionCode]))
      : currentCodes.filter((code) => code !== permissionCode);

    void submitAction("更新角色权限", ["user.manage"], () =>
      request(`/identity/roles/${role.id}/permissions`, {
        method: "PATCH",
        body: JSON.stringify({ permissionCodes: nextCodes }),
      }),
    );
  }

  function resetSuperAdminForm() {
    setEditingSuperAdminId(null);
    setSuperAdminName("");
    setSuperAdminPhone("");
    setSuperAdminPassword("");
    setSuperAdminConfirmPassword("");
    setSuperAdminIsActive(true);
  }

  function openCreateSuperAdminDialog() {
    const blockedReason = actionBlockReason("tenant.manage");
    if (blockedReason) {
      setMessage(`新增超级管理员失败：${blockedReason}`);
      return;
    }
    resetSuperAdminForm();
    setSuperAdminDialogOpen(true);
  }

  function openEditSuperAdminDialog(item: ConsoleUser) {
    const blockedReason = actionBlockReason("tenant.manage");
    if (blockedReason) {
      setMessage(`编辑超级管理员失败：${blockedReason}`);
      return;
    }
    setEditingSuperAdminId(item.id);
    setSuperAdminName(item.name);
    setSuperAdminPhone(item.phone ?? "");
    setSuperAdminPassword("");
    setSuperAdminConfirmPassword("");
    setSuperAdminIsActive(item.isActive);
    setSuperAdminDialogOpen(true);
  }

  function closeSuperAdminDialog() {
    setSuperAdminDialogOpen(false);
    resetSuperAdminForm();
  }

  function saveSuperAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const isEditing = Boolean(editingSuperAdminId);
    if (!superAdminName.trim() || !superAdminPhone.trim()) {
      setMessage("保存超级管理员失败：昵称和手机号不能为空。");
      return;
    }
    if (!isEditing && !superAdminPassword.trim()) {
      setMessage("新增超级管理员失败：密码不能为空。");
      return;
    }
    if (superAdminPassword || superAdminConfirmPassword) {
      if (superAdminPassword !== superAdminConfirmPassword) {
        setMessage("保存超级管理员失败：两次密码输入不一致。");
        return;
      }
    }

    void submitAction(
      isEditing ? "编辑超级管理员" : "新增超级管理员",
      ["tenant.manage"],
      async () => {
        const payload = {
          name: superAdminName,
          phone: superAdminPhone,
          isActive: superAdminIsActive,
          ...(superAdminPassword
            ? {
                password: superAdminPassword,
                confirmPassword: superAdminConfirmPassword,
              }
            : {}),
        };
        const result = await request(
          isEditing ? `/super-admins/${editingSuperAdminId}` : "/super-admins",
          {
            method: isEditing ? "PATCH" : "POST",
            body: JSON.stringify(payload),
          },
        );
        closeSuperAdminDialog();
        return result;
      },
    );
  }

  function deleteSuperAdmin(item: ConsoleUser) {
    const confirmed =
      typeof window === "undefined" ||
      window.confirm(`确认删除超级管理员 ${item.name}？`);
    if (!confirmed) {
      return;
    }

    void submitAction("删除超级管理员", ["tenant.manage"], () =>
      request(`/super-admins/${item.id}`, { method: "DELETE" }),
    );
  }

  function resetTenantForm() {
    setEditingTenantId(null);
    setTenantName("");
    setTenantAdminName("");
    setTenantAdminPhone("");
    setTenantAdminPassword("");
    setTenantAdminConfirmPassword("");
  }

  function openCreateTenantDialog() {
    const blockedReason = actionBlockReason("tenant.manage");
    if (blockedReason) {
      setMessage(`新建租户失败：${blockedReason}`);
      return;
    }
    resetTenantForm();
    setTenantDialogOpen(true);
  }

  function openEditTenantDialog(item: Tenant) {
    const blockedReason = actionBlockReason("tenant.manage");
    if (blockedReason) {
      setMessage(`编辑租户失败：${blockedReason}`);
      return;
    }
    setEditingTenantId(item.id);
    setTenantName(item.name);
    setTenantAdminName("");
    setTenantAdminPhone("");
    setTenantAdminPassword("");
    setTenantAdminConfirmPassword("");
    setTenantDialogOpen(true);
  }

  function closeTenantDialog() {
    setTenantDialogOpen(false);
    resetTenantForm();
  }

  function saveTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const isEditing = Boolean(editingTenantId);
    if (!tenantName.trim()) {
      setMessage("保存租户失败：租户名称不能为空。");
      return;
    }
    if (!isEditing) {
      if (
        !tenantAdminName.trim() ||
        !tenantAdminPhone.trim() ||
        !tenantAdminPassword.trim() ||
        !tenantAdminConfirmPassword.trim()
      ) {
        setMessage("新建租户失败：管理员昵称、手机号、密码均为必填。");
        return;
      }
      if (tenantAdminPassword !== tenantAdminConfirmPassword) {
        setMessage("新建租户失败：两次密码输入不一致。");
        return;
      }
    }

    void submitAction(
      isEditing ? "编辑租户" : "新建租户",
      ["tenant.manage"],
      async () => {
        const payload = isEditing
          ? { tenantName }
          : {
              tenantName,
              adminName: tenantAdminName,
              phone: tenantAdminPhone,
              password: tenantAdminPassword,
              confirmPassword: tenantAdminConfirmPassword,
            };
        const result = await request(
          isEditing ? `/tenants/${editingTenantId}` : "/tenants",
          {
            method: isEditing ? "PATCH" : "POST",
            body: JSON.stringify(payload),
          },
        );
        closeTenantDialog();
        return result;
      },
    );
  }

  function deleteTenant(item: Tenant) {
    const confirmed =
      typeof window === "undefined" ||
      window.confirm(`确认删除租户 ${item.name}？该租户账号将被停用。`);
    if (!confirmed) {
      return;
    }

    void submitAction("删除租户", ["tenant.manage"], () =>
      request(`/tenants/${item.id}`, { method: "DELETE" }),
    );
  }

  function openEditTenantUserDialog(tenantId: string, item: ConsoleUser) {
    const blockedReason = actionBlockReason("tenant.manage");
    if (blockedReason) {
      setMessage(`编辑租户用户失败：${blockedReason}`);
      return;
    }
    setEditingTenantUser({ tenantId, user: item });
    setTenantUserName(item.name);
    setTenantUserPhone(item.phone ?? "");
    setTenantUserPassword("");
    setTenantUserConfirmPassword("");
    setTenantUserRoleCode(item.roles[0]?.code ?? "owner");
    setTenantUserIsActive(item.isActive);
    setTenantUserDialogOpen(true);
  }

  function closeTenantUserDialog() {
    setTenantUserDialogOpen(false);
    setEditingTenantUser(null);
    setTenantUserName("");
    setTenantUserPhone("");
    setTenantUserPassword("");
    setTenantUserConfirmPassword("");
    setTenantUserRoleCode("owner");
    setTenantUserIsActive(true);
  }

  function saveTenantUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTenantUser) {
      setMessage("编辑租户用户失败：请先选择用户。");
      return;
    }
    if (!tenantUserName.trim() || !tenantUserPhone.trim()) {
      setMessage("编辑租户用户失败：昵称和手机号不能为空。");
      return;
    }
    if (tenantUserPassword || tenantUserConfirmPassword) {
      if (tenantUserPassword !== tenantUserConfirmPassword) {
        setMessage("编辑租户用户失败：两次密码输入不一致。");
        return;
      }
    }

    void submitAction("编辑租户用户", ["tenant.manage"], async () => {
      const payload = {
        name: tenantUserName,
        phone: tenantUserPhone,
        roleCodes: [tenantUserRoleCode],
        isActive: tenantUserIsActive,
        ...(tenantUserPassword
          ? {
              password: tenantUserPassword,
              confirmPassword: tenantUserConfirmPassword,
            }
          : {}),
      };
      const result = await request(
        `/tenants/${editingTenantUser.tenantId}/users/${editingTenantUser.user.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      );
      closeTenantUserDialog();
      return result;
    });
  }

  function deleteTenantUser(tenantId: string, item: ConsoleUser) {
    const confirmed =
      typeof window === "undefined" ||
      window.confirm(`确认删除租户用户 ${item.name}？`);
    if (!confirmed) {
      return;
    }

    void submitAction("删除租户用户", ["tenant.manage"], () =>
      request(`/tenants/${tenantId}/users/${item.id}`, { method: "DELETE" }),
    );
  }

  function createContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCustomerId) {
      setMessage("保存合同失败：请先选择客户。");
      return;
    }
    if (!selectedSigningEntityId) {
      setMessage("保存合同失败：请先选择我方签约主体。");
      return;
    }
    if (!contractStartDate) {
      setMessage("保存合同失败：合同周期开始日期不能为空。");
      return;
    }
    if (!contractCustomerContact.trim()) {
      setMessage("保存合同失败：客户对接人不能为空。");
      return;
    }
    if (
      contractEndDate &&
      new Date(contractEndDate).getTime() <
        new Date(contractStartDate).getTime()
    ) {
      setMessage("保存合同失败：合同结束日期不能早于开始日期。");
      return;
    }

    const moneyFields: Array<[string, string]> = [
      ["基础费用", contractFee],
      ["激励单价", contractIncentiveUnitPrice],
      ["服务费比例", contractServiceFeeRate],
    ];
    const invalidField = moneyFields.find(
      ([, value]) =>
        !value.trim() || !Number.isFinite(Number(value)) || Number(value) < 0,
    );
    if (invalidField) {
      setMessage(`保存合同失败：${invalidField[0]}必须是非负数字。`);
      return;
    }

    const hasTierRule = contractTierMode !== "NONE";
    if (hasTierRule && !contractTierDescription.trim()) {
      setMessage("保存合同失败：选择阶梯规则后必须填写规则描述。");
      return;
    }

    const isEditing = Boolean(editingContractId);
    if (!isEditing && contractFiles.length === 0) {
      setMessage("创建合同失败：必须上传合同附件。");
      return;
    }

    void submitAction(
      isEditing ? "修改合同" : "创建合同",
      ["contract.write"],
      async () => {
        const attachmentIds =
          contractFiles.length > 0
            ? await uploadContractFiles(contractFiles)
            : [];
        const result = await request<Contract>(
          isEditing ? `/contracts/${editingContractId}` : "/contracts",
          {
            method: isEditing ? "PATCH" : "POST",
            body: JSON.stringify({
              customerId: selectedCustomerId,
              signingEntityId: selectedSigningEntityId,
              customerContactText: contractCustomerContact,
              startDate: contractStartDate,
              endDate: contractEndDate || null,
              baseFee: contractFee,
              incentiveUnitPrice: contractIncentiveUnitPrice,
              serviceFeeRate: contractServiceFeeRate,
              tierMode: hasTierRule ? contractTierMode : "NONE",
              tierRules: hasTierRule
                ? [
                    {
                      description: contractTierDescription,
                    },
                  ]
                : [],
              ...(attachmentIds.length > 0 ? { attachmentIds } : {}),
            }),
          },
        );
        setContractDialogOpen(false);
        resetContractForm(selectedCustomerId);
        return result;
      },
    );
  }

  function deleteContract(contract: Contract) {
    const confirmed =
      typeof window === "undefined" ||
      window.confirm(`确认删除合同 ${contract.code}？`);
    if (!confirmed) {
      return;
    }

    void submitAction("删除合同", ["contract.write"], () =>
      request(`/contracts/${contract.id}`, { method: "DELETE" }),
    );
  }

  function closeBillDialog() {
    setBillDialogOpen(false);
  }

  function resetReceivableForm() {
    const preferredCustomerId = selectedCustomerId || customers[0]?.id || "";
    const matchingContract = contracts.find(
      (contract) =>
        contract.customerId === preferredCustomerId ||
        contract.customer?.id === preferredCustomerId,
    );
    const nextContract =
      matchingContract ??
      contracts.find(
        (contract) =>
          contract.customerId === customers[0]?.id ||
          contract.customer?.id === customers[0]?.id,
      ) ??
      contracts[0];
    const nextCustomerId =
      nextContract?.customerId ??
      nextContract?.customer?.id ??
      preferredCustomerId;
    setSelectedCustomerId(nextCustomerId);
    setSelectedContractId(nextContract?.id ?? "");
    setReceivableProjectName(nextContract?.name ?? "");
    setReceivableSigningEntityId(
      nextContract?.signingEntityId ??
        nextContract?.signingEntity?.id ??
        signingEntities[0]?.id ??
        "",
    );
    setReceivableAmount("0.00");
    setBillStatusFiles([]);
  }

  function openCreateReceivableDialog() {
    const blockedReason = actionBlockReason("bill.manage");
    if (blockedReason) {
      setMessage(`新增账单应收失败：${blockedReason}`);
      return;
    }
    if (customers.length === 0) {
      setMessage("新增账单应收失败：请先创建客户。");
      return;
    }
    if (contracts.length === 0) {
      setMessage("新增账单应收失败：请先创建合同。");
      return;
    }
    if (signingEntities.length === 0) {
      setMessage("新增账单应收失败：请先创建签约主体。");
      return;
    }

    resetReceivableForm();
    setBillDialogOpen(true);
  }

  function createReceivableBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const contract = selectedContract;
    if (!selectedCustomerId) {
      setMessage("新增账单应收失败：请选择客户。");
      return;
    }
    if (!contract) {
      setMessage("新增账单应收失败：请选择合同。");
      return;
    }
    if (!receivableProjectName.trim()) {
      setMessage("新增账单应收失败：请填写项目名称。");
      return;
    }
    if (!receivableSigningEntityId) {
      setMessage("新增账单应收失败：请选择我方主体。");
      return;
    }
    if (
      !Number.isFinite(Number(receivableAmount)) ||
      Number(receivableAmount) <= 0
    ) {
      setMessage("新增账单应收失败：金额必须大于 0。");
      return;
    }
    void submitAction("新增账单应收", ["bill.manage"], async () => {
      const result = await request<Bill>("/bills", {
        method: "POST",
        body: JSON.stringify({
          customerId: selectedCustomerId,
          contractId: contract.id,
          signingEntityId: receivableSigningEntityId,
          periodMonth,
          projectName: receivableProjectName.trim(),
          billKind: "RECEIVABLE",
          totalAmount: receivableAmount,
        }),
      });
      setSelectedBillId(result.id);
      setBillDialogOpen(false);
      setReceivableProjectName("");
      setReceivableAmount("0.00");
      return result;
    });
  }

  function openBillStatusDialog(bill: Bill) {
    const nextStatus = nextReceivableStatus(bill.status);
    if (!nextStatus) {
      setMessage("修改账单状态失败：当前状态没有可继续流转的下一步。");
      return;
    }
    setSelectedBillId(bill.id);
    setBillStatusTarget(nextStatus);
    setBillStatusFiles([]);
    setReceiptAccount("默认收款账户");
    setBillStatusDialogOpen(true);
  }

  function closeBillStatusDialog() {
    setBillStatusDialogOpen(false);
    setBillStatusTarget("");
    setBillStatusFiles([]);
  }

  function saveBillStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBill) {
      setMessage("修改账单状态失败：请先选择一张应收账单。");
      return;
    }
    const expectedStatus = nextReceivableStatus(selectedBill.status);
    if (!expectedStatus || billStatusTarget !== expectedStatus) {
      setMessage("修改账单状态失败：状态必须按顺序逐级修改。");
      return;
    }
    const statusAttachmentRequired = billStatusTarget !== "PENDING_SETTLEMENT";
    if (statusAttachmentRequired && billStatusFiles.length === 0) {
      setMessage("修改账单状态失败：请上传本次状态变更对应的附件。");
      return;
    }

    const label = `修改为${billStatus(billStatusTarget)}`;
    const permissions =
      billStatusTarget === "PENDING_SETTLEMENT"
        ? ["bill.approve"]
        : ["receivable.settle"];
    void submitAction(label, permissions, async () => {
      const attachmentIds =
        billStatusFiles.length > 0
          ? await uploadAttachments("bill", selectedBill.id, billStatusFiles)
          : [];
      let result: unknown;
      if (billStatusTarget === "PENDING_SETTLEMENT") {
        result = await request(`/bills/${selectedBill.id}/approve`, {
          method: "POST",
          body: JSON.stringify(
            attachmentIds.length > 0 ? { attachmentIds } : {},
          ),
        });
      } else if (billStatusTarget === "INVOICED") {
        result = await request(`/bills/${selectedBill.id}/mark-invoiced`, {
          method: "POST",
          body: JSON.stringify({ invoiceAttachmentIds: attachmentIds }),
        });
      } else {
        result = await request(`/bills/${selectedBill.id}/mark-received`, {
          method: "POST",
          body: JSON.stringify({
            receiptAttachmentIds: attachmentIds,
            account: receiptAccount,
            payer:
              selectedBill.customer?.fullName ?? selectedBill.customer?.name,
          }),
        });
      }
      closeBillStatusDialog();
      return result;
    });
  }

  async function loadBillAttachments(bill: Bill) {
    try {
      const page = await request<PaginatedResponse<Attachment>>(
        `/attachments?ownerType=bill&ownerId=${encodeURIComponent(bill.id)}&pageSize=100`,
      );
      setBillAttachments(listItems(page));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `加载附件失败：${translateErrorMessage(error.message)}`
          : "加载附件失败",
      );
    }
  }

  function openBillAttachmentsDialog(bill: Bill) {
    setSelectedBillId(bill.id);
    setAttachmentPreview(null);
    setBillAttachments([]);
    setBillAttachmentsDialogOpen(true);
    void loadBillAttachments(bill);
  }

  function closeBillAttachmentsDialog() {
    setBillAttachmentsDialogOpen(false);
    setBillAttachments([]);
    setAttachmentPreview(null);
  }

  async function openAttachmentPreview(attachment: Attachment) {
    try {
      const [previewResult, downloadResult] = await Promise.all([
        request<{
          attachment: Attachment;
          download: { url: string };
        }>(`/attachments/${attachment.id}/download-url?disposition=inline`),
        request<{
          attachment: Attachment;
          download: { url: string };
        }>(`/attachments/${attachment.id}/download-url`),
      ]);
      setAttachmentPreview({
        attachment: previewResult.attachment,
        downloadUrl: downloadResult.download.url,
        url: previewResult.download.url,
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `打开附件失败：${translateErrorMessage(error.message)}`
          : "打开附件失败",
      );
    }
  }

  function openCreatePayableDialog() {
    const blockedReason = actionBlockReason("cost.manage");
    if (blockedReason) {
      setMessage(`新增成本应付失败：${blockedReason}`);
      return;
    }
    if (bills.length === 0) {
      setMessage("新增成本应付失败：请先创建应收账单。");
      return;
    }
    if (paymentRecipients.length === 0) {
      setMessage("新增成本应付失败：请先在收款人页面新增收款人。");
      return;
    }
    const nextBillId = selectedBillId || bills[0]?.id || "";
    setSelectedBillId(nextBillId);
    const nextRecipientId =
      selectedPaymentRecipientId || paymentRecipients[0]?.id || "";
    const nextRecipient = paymentRecipients.find(
      (recipient) => recipient.id === nextRecipientId,
    );
    setSelectedPaymentRecipientId(nextRecipientId);
    setPayableRecipientSearch(
      nextRecipient ? paymentRecipientOptionText(nextRecipient) : "",
    );
    setPayableAmount("0.00");
    setPayableRemarks("");
    setPayableDialogOpen(true);
  }

  function closePayableDialog() {
    setPayableDialogOpen(false);
  }

  function resetRecipientForm() {
    setEditingRecipientId(null);
    setRecipientName("");
    setRecipientPlatform("PRIVATE_BANK");
    setRecipientAccountName("");
    setRecipientAccountNo("");
    setRecipientBankBranch("");
    setRecipientFiles([]);
  }

  function openCreateRecipientDialog() {
    const blockedReason = actionBlockReason("cost.manage");
    if (blockedReason) {
      setMessage(`新增收款人失败：${blockedReason}`);
      return;
    }

    resetRecipientForm();
    setRecipientDialogOpen(true);
  }

  function openEditRecipientDialog(recipient: PaymentRecipient) {
    const blockedReason = actionBlockReason("cost.manage");
    if (blockedReason) {
      setMessage(`编辑收款人失败：${blockedReason}`);
      return;
    }

    setEditingRecipientId(recipient.id);
    setRecipientName(recipient.name);
    setRecipientPlatform(recipient.platform);
    setRecipientAccountName(recipient.accountName);
    setRecipientAccountNo(recipient.accountNo);
    setRecipientBankBranch(recipient.bankBranch ?? "");
    setRecipientFiles([]);
    setRecipientDialogOpen(true);
  }

  function closeRecipientDialog() {
    setRecipientDialogOpen(false);
    resetRecipientForm();
  }

  function savePaymentRecipient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !recipientName.trim() ||
      !recipientAccountName.trim() ||
      !recipientAccountNo.trim()
    ) {
      setMessage("保存收款人失败：资源名称、账户名和账号不能为空。");
      return;
    }

    const isEditing = Boolean(editingRecipientId);
    void submitAction(
      isEditing ? "修改收款人" : "新增收款人",
      ["cost.manage"],
      async () => {
        const result = await request<PaymentRecipient>(
          isEditing
            ? `/payment-recipients/${editingRecipientId}`
            : "/payment-recipients",
          {
            method: isEditing ? "PATCH" : "POST",
            body: JSON.stringify({
              name: recipientName,
              platform: recipientPlatform,
              accountName: recipientAccountName,
              accountNo: recipientAccountNo,
              bankBranch: recipientBankBranch || null,
            }),
          },
        );
        if (recipientFiles.length > 0) {
          await uploadAttachments(
            "payment_recipient",
            result.id,
            recipientFiles,
          );
        }
        setSelectedPaymentRecipientId(result.id);
        setRecipientDialogOpen(false);
        resetRecipientForm();
        return result;
      },
    );
  }

  function deletePaymentRecipient(recipient: PaymentRecipient) {
    const confirmed =
      typeof window === "undefined" ||
      window.confirm(`确认删除收款人 ${recipient.name}？`);
    if (!confirmed) {
      return;
    }

    void submitAction("删除收款人", ["cost.manage"], () =>
      request(`/payment-recipients/${recipient.id}`, { method: "DELETE" }),
    );
  }

  function createCostPayable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBillId) {
      setMessage("新增成本应付失败：请选择关联账单。");
      return;
    }
    if (!selectedPaymentRecipient) {
      setMessage("新增成本应付失败：请选择已有收款人。");
      return;
    }
    if (!Number.isFinite(Number(payableAmount)) || Number(payableAmount) <= 0) {
      setMessage("新增成本应付失败：应付金额必须大于 0。");
      return;
    }

    void submitAction("新增成本应付", ["cost.manage"], async () => {
      const result = await request<Payable>("/payables", {
        method: "POST",
        body: JSON.stringify({
          billId: selectedBillId,
          paymentRecipientId: selectedPaymentRecipient.id,
          amount: payableAmount,
          remarks: payableRemarks,
        }),
      });
      setSelectedPayableId(result.id);
      setPayableDialogOpen(false);
      return result;
    });
  }

  function openPayableStatusDialog(payable: Payable) {
    const nextStatus = nextPayableStatus(payable.status);
    if (!nextStatus) {
      setMessage("修改应付状态失败：当前状态没有可继续流转的下一步。");
      return;
    }
    setSelectedPayableId(payable.id);
    setPayableStatusTarget(nextStatus);
    setPayableStatusFiles([]);
    setPayablePaymentAccount("默认付款账户");
    setPayableStatusDialogOpen(true);
  }

  function closePayableStatusDialog() {
    setPayableStatusDialogOpen(false);
    setPayableStatusTarget("");
    setPayableStatusFiles([]);
  }

  function savePayableStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPayable) {
      setMessage("修改应付状态失败：请先选择一条成本应付。");
      return;
    }
    const expectedStatus = nextPayableStatus(selectedPayable.status);
    if (!expectedStatus || payableStatusTarget !== expectedStatus) {
      setMessage("修改应付状态失败：状态必须按顺序逐级修改。");
      return;
    }
    if (payableStatusFiles.length === 0) {
      setMessage("修改应付状态失败：请上传本次状态变更对应的附件。");
      return;
    }
    void submitAction(
      payableStatusTarget === "CONFIRMED"
        ? "修改为已开票/确认"
        : "修改为已支付",
      ["payable.settle"],
      async () => {
        const attachmentIds = await uploadAttachments(
          "payable",
          selectedPayable.id,
          payableStatusFiles,
        );
        const primaryAttachmentId = attachmentIds[0];
        if (!primaryAttachmentId) {
          throw new Error("请上传本次状态变更对应的附件。");
        }
        if (payableStatusTarget === "CONFIRMED") {
          const result = await request(
            `/payables/${selectedPayable.id}/confirm`,
            {
              method: "POST",
              body: JSON.stringify({ attachmentIds }),
            },
          );
          closePayableStatusDialog();
          return result;
        }

        const unpaidAmount =
          Number(selectedPayable.amount ?? 0) -
          Number(selectedPayable.paidAmount ?? 0);
        if (unpaidAmount <= 0) {
          throw new Error("该应付已支付。");
        }
        const result = await request("/payments", {
          method: "POST",
          body: JSON.stringify({
            paidAt: new Date().toISOString(),
            amount: amountInput(unpaidAmount),
            account: payablePaymentAccount,
            payeeName: selectedPayable.vendorName,
            attachmentId: primaryAttachmentId,
            allocations: [
              {
                payableId: selectedPayable.id,
                amount: amountInput(unpaidAmount),
              },
            ],
          }),
        });
        closePayableStatusDialog();
        return result;
      },
    );
  }

  async function loadPayableAttachments(payable: Payable) {
    try {
      const page = await request<PaginatedResponse<Attachment>>(
        `/attachments?ownerType=payable&ownerId=${encodeURIComponent(payable.id)}&pageSize=100`,
      );
      setPayableAttachments(listItems(page));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `加载附件失败：${translateErrorMessage(error.message)}`
          : "加载附件失败",
      );
    }
  }

  function openPayableAttachmentsDialog(payable: Payable) {
    setSelectedPayableId(payable.id);
    setAttachmentPreview(null);
    setPayableAttachments([]);
    setPayableAttachmentsDialogOpen(true);
    void loadPayableAttachments(payable);
  }

  function closePayableAttachmentsDialog() {
    setPayableAttachmentsDialogOpen(false);
    setPayableAttachments([]);
    setAttachmentPreview(null);
  }

  async function loadRecipientAttachments(recipient: PaymentRecipient) {
    try {
      const page = await request<PaginatedResponse<Attachment>>(
        `/attachments?ownerType=payment_recipient&ownerId=${encodeURIComponent(recipient.id)}&pageSize=100`,
      );
      setRecipientAttachments(listItems(page));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `加载资源附件失败：${translateErrorMessage(error.message)}`
          : "加载资源附件失败",
      );
    }
  }

  function openRecipientAttachmentsDialog(recipient: PaymentRecipient) {
    setSelectedPaymentRecipientId(recipient.id);
    setAttachmentPreview(null);
    setRecipientAttachments([]);
    setRecipientAttachmentsDialogOpen(true);
    void loadRecipientAttachments(recipient);
  }

  function closeRecipientAttachmentsDialog() {
    setRecipientAttachmentsDialogOpen(false);
    setRecipientAttachments([]);
    setAttachmentPreview(null);
  }

  function toggleNavGroup(label: string) {
    setExpandedNavGroups((current) => ({
      ...current,
      [label]: !current[label],
    }));
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>erpdog</strong>
          <span>服务型业务 ERP</span>
        </div>
        <nav className="nav" aria-label="主导航">
          {visibleNavItems.map((item) => {
            if (item.kind === "group") {
              const isGroupActive = item.children.includes(active);
              const isGroupExpanded = expandedNavGroups[item.label] ?? false;

              return (
                <div
                  className="nav-group"
                  data-active={isGroupActive}
                  key={item.label}
                >
                  <button
                    aria-expanded={isGroupExpanded}
                    className="nav-group-button"
                    data-active={isGroupActive}
                    onClick={() => toggleNavGroup(item.label)}
                    type="button"
                  >
                    <span>{item.label}</span>
                    <span aria-hidden="true" className="nav-caret">
                      {isGroupExpanded ? "-" : "+"}
                    </span>
                  </button>
                  {isGroupExpanded ? (
                    <div className="sub-nav" aria-label={item.label}>
                      {item.children.map((childId) => {
                        const child = getModuleMeta(childId);

                        return (
                          <button
                            data-active={active === child.id}
                            key={child.id}
                            onClick={() => setActive(child.id)}
                            type="button"
                          >
                            {child.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            }

            const module = getModuleMeta(item.id);

            return (
              <button
                data-active={active === module.id}
                key={module.id}
                onClick={() => setActive(module.id)}
                type="button"
              >
                {module.label}
              </button>
            );
          })}
        </nav>
        <div className="session">
          <span>{userDisplayName(user)}</span>
          <small>
            {isLoggedIn
              ? `${userRoleLabel(user)} · ${userAccountLabel(user)}`
              : "请先登录正式系统"}
          </small>
        </div>
      </aside>

      <main className="main">
        {message ? (
          <div
            className="global-toast"
            data-tone={currentMessageTone}
            role={currentMessageTone === "danger" ? "alert" : "status"}
          >
            {message}
          </div>
        ) : null}
        <header className="topbar">
          <div>
            <h1>{activeModule.title}</h1>
            <p>
              {isPlatformModule
                ? "平台多租户管理"
                : `${periodMonth} · 正式 API 模式`}
            </p>
          </div>
          <div className="topbar-actions">
            <div className="toolbar">
              <input
                aria-label="账期"
                className="month-picker"
                onChange={(event) => updatePeriodMonth(event.target.value)}
                type="month"
                value={periodMonth}
              />
              <button
                onClick={() =>
                  void refresh().catch((error: unknown) =>
                    setMessage(
                      error instanceof Error
                        ? `刷新失败：${translateErrorMessage(error.message)}`
                        : "刷新失败",
                    ),
                  )
                }
                type="button"
              >
                刷新
              </button>
            </div>
            <div className="auth-actions">
              {isLoggedIn ? (
                <>
                  <span
                    className="auth-chip"
                    title={currentUserChipLabel(user)}
                  >
                    {currentUserChipLabel(user)}
                  </span>
                  <button onClick={logout} type="button">
                    退出
                  </button>
                </>
              ) : (
                <button
                  className="primary"
                  onClick={() => setLoginDialogOpen(true)}
                  type="button"
                >
                  登录正式系统
                </button>
              )}
            </div>
          </div>
        </header>

        {loginDialogOpen ? (
          <div
            aria-modal="true"
            className="modal-backdrop"
            onMouseDown={() => setLoginDialogOpen(false)}
            role="dialog"
          >
            <div
              className="modal-panel"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="panel-header">
                <h2>登录正式系统</h2>
                <button
                  aria-label="关闭"
                  className="icon-button"
                  onClick={() => setLoginDialogOpen(false)}
                  type="button"
                >
                  ×
                </button>
              </div>
              <form
                className="module-form"
                onSubmit={(event) => void login(event)}
              >
                <label>
                  账号
                  <input
                    autoComplete="username"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="邮箱或手机号"
                    value={email}
                  />
                </label>
                <label>
                  密码
                  <input
                    autoComplete="current-password"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="输入管理员或内部用户密码"
                    type="password"
                    value={password}
                  />
                </label>
                <small className="form-note">
                  登录成功后将在当前浏览器保持 30 天登录态。
                </small>
                <div className="modal-actions">
                  <button
                    onClick={() => setLoginDialogOpen(false)}
                    type="button"
                  >
                    取消
                  </button>
                  <button className="primary" type="submit">
                    登录
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {active === "dashboard" ? (
          <DashboardModule
            bills={bills}
            contracts={contracts}
            costEntries={costEntries}
            customers={customers}
            payables={payables}
            paymentRequests={paymentRequests}
            periodMonth={periodMonth}
            profits={profits}
            setActive={setActive}
          />
        ) : null}

        {active === "activation" ? (
          <ActivationModule apiBase={apiBase} />
        ) : null}

        {active === "identity" ? (
          <IdentityModule
            auditLogs={auditLogs}
            closeUserDialog={closeUserDialog}
            createConsoleUser={createConsoleUser}
            creatableRoles={creatableRoles}
            currentUserId={user?.id ?? ""}
            deleteConsoleUser={deleteConsoleUser}
            disabledReason={actionBlockReason("user.manage")}
            editingUser={editingConsoleUser}
            newUserEmail={newUserEmail}
            newUserIsActive={newUserIsActive}
            newUserName={newUserName}
            newUserPassword={newUserPassword}
            newUserRoleCode={newUserRoleCode}
            openCreateUserDialog={openCreateUserDialog}
            openEditUserDialog={openEditUserDialog}
            roles={roles}
            setNewUserEmail={setNewUserEmail}
            setNewUserIsActive={setNewUserIsActive}
            setNewUserName={setNewUserName}
            setNewUserPassword={setNewUserPassword}
            setNewUserRoleCode={setNewUserRoleCode}
            updateRolePermission={updateRolePermission}
            userRoles={user?.roles ?? []}
            userDialogOpen={userDialogOpen}
            users={users}
          />
        ) : null}

        {active === "superAdmins" ? (
          <SuperAdminsModule
            closeSuperAdminDialog={closeSuperAdminDialog}
            disabledReason={actionBlockReason("tenant.manage")}
            editingSuperAdmin={editingSuperAdmin}
            deleteSuperAdmin={deleteSuperAdmin}
            openCreateSuperAdminDialog={openCreateSuperAdminDialog}
            openEditSuperAdminDialog={openEditSuperAdminDialog}
            saveSuperAdmin={saveSuperAdmin}
            setSuperAdminConfirmPassword={setSuperAdminConfirmPassword}
            setSuperAdminIsActive={setSuperAdminIsActive}
            setSuperAdminName={setSuperAdminName}
            setSuperAdminPassword={setSuperAdminPassword}
            setSuperAdminPhone={setSuperAdminPhone}
            superAdminConfirmPassword={superAdminConfirmPassword}
            superAdminDialogOpen={superAdminDialogOpen}
            superAdminIsActive={superAdminIsActive}
            superAdminName={superAdminName}
            superAdminPassword={superAdminPassword}
            superAdminPhone={superAdminPhone}
            superAdmins={superAdmins}
          />
        ) : null}

        {active === "tenants" ? (
          <TenantsModule
            closeTenantDialog={closeTenantDialog}
            closeTenantUserDialog={closeTenantUserDialog}
            deleteTenant={deleteTenant}
            deleteTenantUser={deleteTenantUser}
            disabledReason={actionBlockReason("tenant.manage")}
            editingTenant={editingTenant}
            editingTenantUser={editingTenantUser}
            openCreateTenantDialog={openCreateTenantDialog}
            openEditTenantDialog={openEditTenantDialog}
            openEditTenantUserDialog={openEditTenantUserDialog}
            roleOptions={tenantManagementRoleOptions}
            saveTenant={saveTenant}
            saveTenantUser={saveTenantUser}
            setTenantAdminConfirmPassword={setTenantAdminConfirmPassword}
            setTenantAdminName={setTenantAdminName}
            setTenantAdminPassword={setTenantAdminPassword}
            setTenantAdminPhone={setTenantAdminPhone}
            setTenantName={setTenantName}
            setTenantUserConfirmPassword={setTenantUserConfirmPassword}
            setTenantUserIsActive={setTenantUserIsActive}
            setTenantUserName={setTenantUserName}
            setTenantUserPassword={setTenantUserPassword}
            setTenantUserPhone={setTenantUserPhone}
            setTenantUserRoleCode={setTenantUserRoleCode}
            tenantAdminConfirmPassword={tenantAdminConfirmPassword}
            tenantAdminName={tenantAdminName}
            tenantAdminPassword={tenantAdminPassword}
            tenantAdminPhone={tenantAdminPhone}
            tenantDialogOpen={tenantDialogOpen}
            tenantName={tenantName}
            tenants={tenants}
            tenantUserConfirmPassword={tenantUserConfirmPassword}
            tenantUserDialogOpen={tenantUserDialogOpen}
            tenantUserIsActive={tenantUserIsActive}
            tenantUserName={tenantUserName}
            tenantUserPassword={tenantUserPassword}
            tenantUserPhone={tenantUserPhone}
            tenantUserRoleCode={tenantUserRoleCode}
          />
        ) : null}

        {active === "customers" ? (
          <CustomersModule
            closeCustomerDialog={closeCustomerDialog}
            createCustomer={createCustomer}
            customerCode={customerCode}
            customerDialogOpen={customerDialogOpen}
            customerFullName={customerFullName}
            customerName={customerName}
            customers={customers}
            deleteCustomer={deleteCustomer}
            disabledReason={actionBlockReason("customer.write")}
            editingCustomer={editingCustomer}
            openCreateCustomerDialog={openCreateCustomerDialog}
            openEditCustomerDialog={openEditCustomerDialog}
            selectedCustomerId={selectedCustomerId}
            setCustomerFullName={setCustomerFullName}
            setCustomerName={setCustomerName}
            setSelectedCustomerId={setSelectedCustomerId}
          />
        ) : null}

        {active === "signingEntities" ? (
          <SigningEntitiesModule
            closeSigningEntityDialog={closeSigningEntityDialog}
            deleteSigningEntity={deleteSigningEntity}
            disabledReason={actionBlockReason("contract.write")}
            editingSigningEntity={editingSigningEntity}
            openCreateSigningEntityDialog={openCreateSigningEntityDialog}
            openEditSigningEntityDialog={openEditSigningEntityDialog}
            saveSigningEntity={saveSigningEntity}
            selectedSigningEntityId={selectedSigningEntityId}
            setSelectedSigningEntityId={setSelectedSigningEntityId}
            setSigningEntityFullName={setSigningEntityFullName}
            setSigningEntityLegalRepresentative={
              setSigningEntityLegalRepresentative
            }
            setSigningEntityShortName={setSigningEntityShortName}
            setSigningEntityTaxpayerType={setSigningEntityTaxpayerType}
            signingEntities={signingEntities}
            signingEntityCode={signingEntityCode}
            signingEntityDialogOpen={signingEntityDialogOpen}
            signingEntityFullName={signingEntityFullName}
            signingEntityLegalRepresentative={signingEntityLegalRepresentative}
            signingEntityShortName={signingEntityShortName}
            signingEntityTaxpayerType={signingEntityTaxpayerType}
          />
        ) : null}

        {active === "contracts" ? (
          <ContractsModule
            attachmentPreview={attachmentPreview}
            closeContractDialog={closeContractDialog}
            closeContractDetail={closeContractDetail}
            contractCode={contractCode}
            contractDetailOpen={contractDetailOpen}
            contractDialogOpen={contractDialogOpen}
            contractEndDate={contractEndDate}
            contractCustomerContact={contractCustomerContact}
            contractFee={contractFee}
            contractFiles={contractFiles}
            contractIncentiveUnitPrice={contractIncentiveUnitPrice}
            contractServiceFeeRate={contractServiceFeeRate}
            contractStartDate={contractStartDate}
            contractTierDescription={contractTierDescription}
            contractTierMode={contractTierMode}
            contracts={contracts}
            createContract={createContract}
            customers={customers}
            deleteContract={deleteContract}
            disabledReason={actionBlockReason("contract.write")}
            editingContract={editingContract}
            openAttachmentPreview={(attachment) =>
              void openAttachmentPreview(attachment)
            }
            openCreateContractDialog={openCreateContractDialog}
            openContractDetail={openContractDetail}
            openEditContractDialog={openEditContractDialog}
            selectedCustomerId={selectedCustomerId}
            selectedContract={selectedContract}
            selectedContractId={selectedContractId}
            setContractEndDate={setContractEndDate}
            setContractCustomerContact={setContractCustomerContact}
            setContractFee={setContractFee}
            setContractIncentiveUnitPrice={setContractIncentiveUnitPrice}
            setContractServiceFeeRate={setContractServiceFeeRate}
            setContractStartDate={updateContractStartDate}
            setContractTierDescription={setContractTierDescription}
            setContractTierMode={setContractTierMode}
            setSelectedCustomerId={setSelectedCustomerId}
            setSelectedContractId={setSelectedContractId}
            selectedSigningEntityId={selectedSigningEntityId}
            setSelectedSigningEntityId={setSelectedSigningEntityId}
            signingEntities={signingEntities}
            updateContractFiles={updateContractFiles}
          />
        ) : null}

        {active === "receivableBilling" ? (
          <ReceivableBillingModule
            attachmentPreview={attachmentPreview}
            billDialogOpen={billDialogOpen}
            billAttachments={billAttachments}
            billAttachmentsDialogOpen={billAttachmentsDialogOpen}
            billStatusDialogOpen={billStatusDialogOpen}
            billStatusFiles={billStatusFiles}
            billStatusTarget={billStatusTarget}
            bills={bills}
            closeBillAttachmentsDialog={closeBillAttachmentsDialog}
            closeBillDialog={closeBillDialog}
            closeBillStatusDialog={closeBillStatusDialog}
            contracts={contracts}
            createReceivableBill={createReceivableBill}
            customers={customers}
            disabledReason={actionBlockReason("bill.manage")}
            openAttachmentPreview={(attachment) =>
              void openAttachmentPreview(attachment)
            }
            openBillAttachmentsDialog={openBillAttachmentsDialog}
            openBillStatusDialog={openBillStatusDialog}
            openCreateReceivableDialog={openCreateReceivableDialog}
            periodMonth={periodMonth}
            receivableAmount={receivableAmount}
            receivableProjectName={receivableProjectName}
            receivableSigningEntityId={receivableSigningEntityId}
            receivableTab={receivableTab}
            receiptAccount={receiptAccount}
            saveBillStatus={saveBillStatus}
            selectedBill={selectedBill}
            selectedBillId={selectedBillId}
            selectedContractId={selectedContractId}
            selectedCustomerId={selectedCustomerId}
            setBillStatusFiles={(fileList) =>
              updateBusinessFiles(fileList, setBillStatusFiles, "状态附件")
            }
            setBillStatusTarget={setBillStatusTarget}
            setReceiptAccount={setReceiptAccount}
            setPeriodMonth={updatePeriodMonth}
            setReceivableAmount={setReceivableAmount}
            setReceivableProjectName={setReceivableProjectName}
            setReceivableSigningEntityId={setReceivableSigningEntityId}
            setReceivableTab={setReceivableTab}
            setSelectedBillId={setSelectedBillId}
            setSelectedContractId={setSelectedContractId}
            setSelectedCustomerId={setSelectedCustomerId}
            signingEntities={signingEntities}
            statusDisabledReason={
              billStatusTarget === "PENDING_SETTLEMENT"
                ? actionBlockReason("bill.approve")
                : actionBlockReason("receivable.settle")
            }
          />
        ) : null}

        {active === "costPayable" ? (
          <CostPayableModule
            attachmentPreview={attachmentPreview}
            bills={bills}
            closePayableAttachmentsDialog={closePayableAttachmentsDialog}
            closePayableDialog={closePayableDialog}
            closePayableStatusDialog={closePayableStatusDialog}
            closeRecipientAttachmentsDialog={closeRecipientAttachmentsDialog}
            closeRecipientDialog={closeRecipientDialog}
            createCostPayable={createCostPayable}
            deletePaymentRecipient={deletePaymentRecipient}
            disabledReason={actionBlockReason("cost.manage")}
            editingRecipient={editingRecipient}
            openAttachmentPreview={(attachment) =>
              void openAttachmentPreview(attachment)
            }
            openCreatePayableDialog={openCreatePayableDialog}
            openCreateRecipientDialog={openCreateRecipientDialog}
            openEditRecipientDialog={openEditRecipientDialog}
            openPayableAttachmentsDialog={openPayableAttachmentsDialog}
            openPayableStatusDialog={openPayableStatusDialog}
            openRecipientAttachmentsDialog={openRecipientAttachmentsDialog}
            payableAmount={payableAmount}
            payableAttachments={payableAttachments}
            payableAttachmentsDialogOpen={payableAttachmentsDialogOpen}
            payableDialogOpen={payableDialogOpen}
            payablePaymentAccount={payablePaymentAccount}
            payableRemarks={payableRemarks}
            payableStatusDialogOpen={payableStatusDialogOpen}
            payableStatusFiles={payableStatusFiles}
            payableStatusTarget={payableStatusTarget}
            payableTab={payableTab}
            payableRecipientSearch={payableRecipientSearch}
            payables={payables}
            paymentRecipients={paymentRecipients}
            recipientAccountName={recipientAccountName}
            recipientAccountNo={recipientAccountNo}
            recipientAttachments={recipientAttachments}
            recipientAttachmentsDialogOpen={recipientAttachmentsDialogOpen}
            recipientBankBranch={recipientBankBranch}
            recipientDialogOpen={recipientDialogOpen}
            recipientFiles={recipientFiles}
            recipientName={recipientName}
            recipientPlatform={recipientPlatform}
            savePayableStatus={savePayableStatus}
            savePaymentRecipient={savePaymentRecipient}
            selectedBillId={selectedBillId}
            selectedPayable={selectedPayable}
            selectedPayableId={selectedPayableId}
            selectedPaymentRecipient={selectedPaymentRecipient}
            selectedPaymentRecipientId={selectedPaymentRecipientId}
            setPayableAmount={setPayableAmount}
            setPayablePaymentAccount={setPayablePaymentAccount}
            setPayableRecipientSearch={setPayableRecipientSearch}
            setPayableStatusFiles={(fileList) =>
              updateBusinessFiles(fileList, setPayableStatusFiles, "状态附件")
            }
            setPayableStatusTarget={setPayableStatusTarget}
            setPayableRemarks={setPayableRemarks}
            setPayableTab={setPayableTab}
            setRecipientAccountName={setRecipientAccountName}
            setRecipientAccountNo={setRecipientAccountNo}
            setRecipientBankBranch={setRecipientBankBranch}
            setRecipientFiles={(fileList) =>
              updateGeneralFiles(fileList, setRecipientFiles, "资源附件")
            }
            setRecipientName={setRecipientName}
            setRecipientPlatform={setRecipientPlatform}
            setSelectedBillId={setSelectedBillId}
            setSelectedPayableId={setSelectedPayableId}
            setSelectedPaymentRecipientId={setSelectedPaymentRecipientId}
            statusDisabledReason={actionBlockReason("payable.settle")}
          />
        ) : null}

        {active === "closing" ? (
          <ClosingModule periodMonth={periodMonth} profits={profits} />
        ) : null}
      </main>
    </div>
  );
}

function DashboardModule({
  bills,
  contracts,
  costEntries,
  customers,
  payables,
  paymentRequests,
  periodMonth,
  profits,
  setActive,
}: {
  bills: Bill[];
  contracts: Contract[];
  costEntries: CostEntry[];
  customers: Customer[];
  payables: Payable[];
  paymentRequests: PaymentRequest[];
  periodMonth: string;
  profits: ProfitRow[];
  setActive: (module: ModuleId) => void;
}) {
  const receivableTotal = sumAmount(bills, (bill) => bill.totalAmount);
  const receivedAmount = sumAmount(bills, (bill) => bill.receiptAmount);
  const invoicedAmount = sumAmount(bills, (bill) => bill.invoiceAmount);
  const unreceivedAmount = Math.max(0, receivableTotal - receivedAmount);
  const uninvoicedAmount = Math.max(0, receivableTotal - invoicedAmount);
  const periodPayables = payables.filter(
    (payable) =>
      (payable.periodMonth ?? payable.bill?.periodMonth ?? periodMonth) ===
      periodMonth,
  );
  const payableTotal = sumAmount(periodPayables, (payable) => payable.amount);
  const paidPayableAmount = sumAmount(periodPayables, (payable) =>
    payable.status === "PAID" ? payable.amount : payable.paidAmount,
  );
  const payableOutstanding = Math.max(0, payableTotal - paidPayableAmount);
  const costTotal = Math.max(
    payableTotal,
    sumAmount(costEntries, (row) => row.amount),
  );
  const profitAmount =
    profits.length > 0
      ? sumAmount(profits, (row) => row.profitAmount)
      : receivableTotal - costTotal;
  const grossMargin = receivableTotal > 0 ? profitAmount / receivableTotal : 0;
  const activeContracts = contracts.filter(
    (contract) => contractStatus(contract) === "合作中",
  ).length;

  const pendingApprovalReceivable = dashboardStatusRow(
    "待审批",
    bills,
    "PENDING_APPROVAL",
    "danger",
  );
  const pendingSettlementReceivable = dashboardStatusRow(
    "待结算",
    bills,
    "PENDING_SETTLEMENT",
    "danger",
  );
  const invoicedReceivable = dashboardStatusRow(
    "已开票",
    bills,
    "INVOICED",
    "danger",
  );
  const receivableRows = [
    pendingApprovalReceivable,
    pendingSettlementReceivable,
    invoicedReceivable,
    dashboardStatusRow("已到账", bills, "RECEIVED", "ok"),
  ];
  const payableRows = [
    dashboardPayableRow(
      "待支付",
      periodPayables,
      ["UNPAID", "PARTIALLY_PAID"],
      "danger",
    ),
    dashboardPayableRow("已开票/确认", periodPayables, "CONFIRMED", "danger"),
    dashboardPayableRow("已支付", periodPayables, "PAID", "ok"),
  ];
  const taskItems = [
    {
      amount: pendingApprovalReceivable.amount,
      label: "应收待审批",
      module: "receivableBilling" as ModuleId,
      value: pendingApprovalReceivable.count,
    },
    {
      amount: pendingSettlementReceivable.amount,
      label: "应收待结算",
      module: "receivableBilling" as ModuleId,
      value: pendingSettlementReceivable.count,
    },
    {
      amount: invoicedReceivable.amount,
      label: "应收待到账",
      module: "receivableBilling" as ModuleId,
      value: invoicedReceivable.count,
    },
    {
      amount: payableOutstanding,
      label: "应付待处理",
      module: "costPayable" as ModuleId,
      value: periodPayables.filter((payable) =>
        ["UNPAID", "CONFIRMED", "PARTIALLY_PAID"].includes(payable.status),
      ).length,
    },
    {
      amount: sumAmount(paymentRequests, (request) => request.requestedAmount),
      label: "付款申请待审批",
      module: "costPayable" as ModuleId,
      value: paymentRequests.filter((request) => request.status === "SUBMITTED")
        .length,
    },
  ];
  const redTaskCount = taskItems.reduce(
    (total, task) => total + (task.value > 0 ? 1 : 0),
    0,
  );
  const negativeProfits = profits.filter(
    (row) => amountNumber(row.profitAmount) < 0,
  );
  const riskAlerts = [
    ...taskItems
      .filter((task) => task.value > 0)
      .map((task) => ({
        label: `${task.label} ${task.value} 项，金额 ${money(task.amount)}`,
        module: task.module,
      })),
    ...(uninvoicedAmount > 0
      ? [
          {
            label: `未开票金额 ${money(uninvoicedAmount)}，会影响后续到账。`,
            module: "receivableBilling" as ModuleId,
          },
        ]
      : []),
    ...(unreceivedAmount > 0
      ? [
          {
            label: `未到账金额 ${money(unreceivedAmount)}，需要跟进回款。`,
            module: "receivableBilling" as ModuleId,
          },
        ]
      : []),
    ...(negativeProfits.length > 0
      ? [
          {
            label: `${negativeProfits.length} 个客户毛利为负，需要复盘成本或报价。`,
            module: "closing" as ModuleId,
          },
        ]
      : []),
    ...(customers.length === 0
      ? [
          {
            label: "还没有客户，正式业务尚未建档。",
            module: "customers" as ModuleId,
          },
        ]
      : []),
    ...(contracts.length === 0 && customers.length > 0
      ? [
          {
            label: "已有客户但没有合同，账单无法形成稳定规则。",
            module: "contracts" as ModuleId,
          },
        ]
      : []),
  ];
  const metricCards = [
    {
      label: "本期应收",
      sublabel: `${bills.length} 张账单`,
      value: money(receivableTotal),
    },
    {
      label: "已到账",
      sublabel: collectionText(receivedAmount, receivableTotal),
      value: money(receivedAmount),
    },
    {
      label: "未到账",
      sublabel: "需要跟进",
      tone: unreceivedAmount > 0 ? "danger" : "ok",
      value: money(unreceivedAmount),
    },
    {
      label: "应付余额",
      sublabel: `${periodPayables.length} 条应付`,
      tone: payableOutstanding > 0 ? "danger" : "ok",
      value: money(payableOutstanding),
    },
    {
      label: profits.length > 0 ? "已核算毛利" : "测算毛利",
      sublabel: `毛利率 ${formatPercent(grossMargin)}`,
      tone: profitAmount < 0 ? "danger" : "ok",
      value: money(profitAmount),
    },
    {
      label: "红色待办",
      sublabel: redTaskCount > 0 ? "需要优先处理" : "暂无卡点",
      tone: redTaskCount > 0 ? "danger" : "ok",
      value: redTaskCount.toString(),
    },
  ];
  const businessRows = [
    { label: "客户", value: customers.length },
    { label: "合作中合同", value: activeContracts },
    { label: "本期应收账单", value: bills.length },
    { label: "本期成本应付", value: periodPayables.length },
  ];
  const topProfitRows = [...profits]
    .sort(
      (left, right) =>
        amountNumber(right.profitAmount) - amountNumber(left.profitAmount),
    )
    .slice(0, 6);

  return (
    <section className="workspace dashboard-layout">
      <div className="metric-grid dashboard-metrics" aria-label="关键指标">
        {metricCards.map((metric) => (
          <div className="metric" data-tone={metric.tone} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.sublabel}</small>
          </div>
        ))}
      </div>

      <div
        className="panel dashboard-alert-panel"
        data-empty={riskAlerts.length === 0}
      >
        <div className="panel-header">
          <h2>异常与待办</h2>
          <span>
            {riskAlerts.length > 0 ? "红色优先处理" : "当前无红色提醒"}
          </span>
        </div>
        <div className="alert-list">
          {riskAlerts.length > 0 ? (
            riskAlerts.map((alert) => (
              <button
                data-alert="true"
                key={alert.label}
                onClick={() => setActive(alert.module)}
                type="button"
              >
                {alert.label}
              </button>
            ))
          ) : (
            <div className="empty-state">当前账期没有需要红色提醒的异常。</div>
          )}
        </div>
      </div>

      <div className="panel task-panel">
        <div className="panel-header">
          <h2>待办队列</h2>
          <span>按流程推进</span>
        </div>
        <div className="task-list">
          {taskItems.map((task) => (
            <button
              className="task-row"
              data-alert={task.value > 0}
              key={task.label}
              onClick={() => setActive(task.module)}
              type="button"
            >
              <span>
                {task.label}
                <small>{money(task.amount)}</small>
              </span>
              <strong>{task.value}</strong>
            </button>
          ))}
        </div>
      </div>

      <div className="panel chart-panel">
        <div className="panel-header">
          <h2>应收状态</h2>
          <span>{periodMonth}</span>
        </div>
        <DashboardBarChart rows={receivableRows} />
      </div>

      <div className="panel chart-panel">
        <div className="panel-header">
          <h2>回款进度</h2>
          <span>{collectionText(receivedAmount, receivableTotal)}</span>
        </div>
        <DashboardDonut
          label="到账率"
          total={receivableTotal}
          value={receivedAmount}
        />
      </div>

      <div className="panel chart-panel">
        <div className="panel-header">
          <h2>应付状态</h2>
          <span>{periodMonth}</span>
        </div>
        <DashboardBarChart rows={payableRows} />
      </div>

      <div className="panel chart-panel">
        <div className="panel-header">
          <h2>业务规模</h2>
          <span>客户到结算</span>
        </div>
        <div className="business-number-grid">
          {businessRows.map((row) => (
            <div key={row.label}>
              <strong>{row.value}</strong>
              <span>{row.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel chart-panel profit-chart-panel">
        <div className="panel-header">
          <h2>客户毛利排行</h2>
          <span>{profits.length > 0 ? "已关闭账期" : "暂无已核算利润"}</span>
        </div>
        {topProfitRows.length > 0 ? (
          <DashboardProfitBars rows={topProfitRows} />
        ) : (
          <div className="empty-state">账期关闭后会在这里显示客户利润。</div>
        )}
      </div>

      <TablePanel title="最近账单" count={`${bills.length} 条`}>
        <BillsTable bills={bills.slice(0, 6)} onSelect={() => undefined} />
      </TablePanel>

      <ProfitTable profits={profits} />
    </section>
  );
}

function DashboardBarChart({
  rows,
}: {
  rows: Array<{
    amount: number;
    count: number;
    label: string;
    tone?: string;
  }>;
}) {
  const maxAmount = Math.max(...rows.map((row) => row.amount), 1);

  return (
    <div className="dashboard-bars">
      {rows.map((row) => (
        <div className="dashboard-bar-row" data-tone={row.tone} key={row.label}>
          <div>
            <span>{row.label}</span>
            <strong>{row.count} 项</strong>
          </div>
          <div className="bar-track" aria-hidden="true">
            <span
              style={{ width: `${boundedPercent(row.amount, maxAmount)}%` }}
            />
          </div>
          <em>{money(row.amount)}</em>
        </div>
      ))}
    </div>
  );
}

function DashboardDonut({
  label,
  total,
  value,
}: {
  label: string;
  total: number;
  value: number;
}) {
  const progress = boundedPercent(value, total);
  const degrees = progress * 3.6;

  return (
    <div className="donut-wrap">
      <div
        aria-label={`${label}${progress.toFixed(1)}%`}
        className="donut"
        role="img"
        style={{
          background: `conic-gradient(var(--accent) 0deg ${degrees}deg, #e3e9e5 ${degrees}deg 360deg)`,
        }}
      >
        <div>
          <strong>{progress.toFixed(1)}%</strong>
          <span>{label}</span>
        </div>
      </div>
      <div className="donut-legend">
        <div>
          <span>已到账</span>
          <strong>{money(value)}</strong>
        </div>
        <div>
          <span>未到账</span>
          <strong>{money(Math.max(0, total - value))}</strong>
        </div>
      </div>
    </div>
  );
}

function DashboardProfitBars({ rows }: { rows: ProfitRow[] }) {
  const maxProfit = Math.max(
    ...rows.map((row) => Math.abs(amountNumber(row.profitAmount))),
    1,
  );

  return (
    <div className="dashboard-bars">
      {rows.map((row) => {
        const profit = amountNumber(row.profitAmount);
        return (
          <div
            className="dashboard-bar-row"
            data-tone={profit < 0 ? "danger" : "ok"}
            key={row.customerName}
          >
            <div>
              <span>{row.customerName}</span>
              <strong>毛利率 {row.grossMargin ?? "-"}</strong>
            </div>
            <div className="bar-track" aria-hidden="true">
              <span
                style={{
                  width: `${boundedPercent(Math.abs(profit), maxProfit)}%`,
                }}
              />
            </div>
            <em>{money(profit)}</em>
          </div>
        );
      })}
    </div>
  );
}

function dashboardStatusRow(
  label: string,
  bills: Bill[],
  status: string,
  tone?: string,
) {
  const filtered = bills.filter((bill) => bill.status === status);
  return {
    amount: sumAmount(filtered, (bill) => bill.totalAmount),
    count: filtered.length,
    label,
    tone: filtered.length > 0 ? tone : undefined,
  };
}

function dashboardPayableRow(
  label: string,
  payables: Payable[],
  status: string | string[],
  tone?: string,
) {
  const statuses = Array.isArray(status) ? status : [status];
  const filtered = payables.filter((payable) =>
    statuses.includes(payable.status),
  );
  return {
    amount: sumAmount(filtered, (payable) => payable.amount),
    count: filtered.length,
    label,
    tone: filtered.length > 0 ? tone : undefined,
  };
}

function amountNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sumAmount<T>(
  rows: T[],
  read: (row: T) => string | number | null | undefined,
) {
  return rows.reduce((total, row) => total + amountNumber(read(row)), 0);
}

function boundedPercent(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (value / total) * 100));
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function collectionText(receivedAmount: number, totalAmount: number) {
  return `到账率 ${boundedPercent(receivedAmount, totalAmount).toFixed(1)}%`;
}

function ActivationModule({ apiBase }: { apiBase: string }) {
  return (
    <section className="workspace two-column">
      <div className="panel">
        <div className="panel-header">
          <h2>正式启用清单</h2>
          <span>连接目标 API</span>
        </div>
        <ol className="check-list">
          <li>部署 PostgreSQL、Redis、API、Worker、Web 和对象存储。</li>
          <li>设置生产环境变量，替换 JWT_SECRET 和管理员初始密码。</li>
          <li>执行数据库迁移，创建组织管理员，导入客户和合同。</li>
          <li>用真实账号登录，刷新数据，确认账期、客户权限和角色权限。</li>
          <li>选择一个账期试跑完整流程，再关闭该账期作为验收。</li>
        </ol>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>当前连接</h2>
          <span>前端配置</span>
        </div>
        <div className="definition-list">
          <div>
            <span>API Base</span>
            <strong>{apiBase}</strong>
          </div>
          <div>
            <span>页面角色</span>
            <strong>正式入口</strong>
          </div>
          <div>
            <span>生产状态</span>
            <strong>
              <span className={statusClassName("ACTIVE")}>
                已连接 Web/API/Worker/数据库
              </span>
            </strong>
          </div>
        </div>
      </div>
    </section>
  );
}

function SuperAdminsModule({
  closeSuperAdminDialog,
  deleteSuperAdmin,
  disabledReason,
  editingSuperAdmin,
  openCreateSuperAdminDialog,
  openEditSuperAdminDialog,
  saveSuperAdmin,
  setSuperAdminConfirmPassword,
  setSuperAdminIsActive,
  setSuperAdminName,
  setSuperAdminPassword,
  setSuperAdminPhone,
  superAdminConfirmPassword,
  superAdminDialogOpen,
  superAdminIsActive,
  superAdminName,
  superAdminPassword,
  superAdminPhone,
  superAdmins,
}: {
  closeSuperAdminDialog: () => void;
  deleteSuperAdmin: (item: ConsoleUser) => void;
  disabledReason: string;
  editingSuperAdmin?: ConsoleUser;
  openCreateSuperAdminDialog: () => void;
  openEditSuperAdminDialog: (item: ConsoleUser) => void;
  saveSuperAdmin: (event: FormEvent<HTMLFormElement>) => void;
  setSuperAdminConfirmPassword: (value: string) => void;
  setSuperAdminIsActive: (value: boolean) => void;
  setSuperAdminName: (value: string) => void;
  setSuperAdminPassword: (value: string) => void;
  setSuperAdminPhone: (value: string) => void;
  superAdminConfirmPassword: string;
  superAdminDialogOpen: boolean;
  superAdminIsActive: boolean;
  superAdminName: string;
  superAdminPassword: string;
  superAdminPhone: string;
  superAdmins: ConsoleUser[];
}) {
  return (
    <section className="workspace">
      <TablePanel
        action={
          <button
            className="primary"
            disabled={Boolean(disabledReason)}
            onClick={openCreateSuperAdminDialog}
            type="button"
          >
            新增超级管理员
          </button>
        }
        count={`${superAdmins.length} 个`}
        title="超级管理员列表"
      >
        {disabledReason ? (
          <div className="inline-notice">{disabledReason}</div>
        ) : null}
        <table>
          <thead>
            <tr>
              <th>昵称</th>
              <th>手机号</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {superAdmins.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.phone ?? "-"}</td>
                <td>
                  <span className={statusClassName(item.isActive)}>
                    {item.isActive ? "启用" : "停用"}
                  </span>
                </td>
                <td>{dateText(item.createdAt)}</td>
                <td>
                  <div className="row-actions">
                    <button
                      disabled={Boolean(disabledReason)}
                      onClick={() => openEditSuperAdminDialog(item)}
                      type="button"
                    >
                      编辑
                    </button>
                    <button
                      disabled={Boolean(disabledReason)}
                      onClick={() => deleteSuperAdmin(item)}
                      type="button"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablePanel>

      {superAdminDialogOpen ? (
        <div
          aria-modal="true"
          className="modal-backdrop"
          onMouseDown={closeSuperAdminDialog}
          role="dialog"
        >
          <div
            className="modal-panel"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <h2>{editingSuperAdmin ? "编辑超级管理员" : "新增超级管理员"}</h2>
              <button
                aria-label="关闭"
                className="icon-button"
                onClick={closeSuperAdminDialog}
                type="button"
              >
                ×
              </button>
            </div>
            <form className="module-form" onSubmit={saveSuperAdmin}>
              <label>
                昵称
                <input
                  onChange={(event) => setSuperAdminName(event.target.value)}
                  value={superAdminName}
                />
              </label>
              <label>
                手机号
                <input
                  onChange={(event) => setSuperAdminPhone(event.target.value)}
                  value={superAdminPhone}
                />
              </label>
              <label>
                {editingSuperAdmin ? "重置密码" : "密码"}
                <input
                  autoComplete="new-password"
                  onChange={(event) =>
                    setSuperAdminPassword(event.target.value)
                  }
                  placeholder={editingSuperAdmin ? "不填写则保持原密码" : ""}
                  type="password"
                  value={superAdminPassword}
                />
              </label>
              <label>
                确认密码
                <input
                  autoComplete="new-password"
                  onChange={(event) =>
                    setSuperAdminConfirmPassword(event.target.value)
                  }
                  type="password"
                  value={superAdminConfirmPassword}
                />
              </label>
              {editingSuperAdmin ? (
                <label className="checkbox-row">
                  <input
                    checked={superAdminIsActive}
                    onChange={(event) =>
                      setSuperAdminIsActive(event.target.checked)
                    }
                    type="checkbox"
                  />
                  启用账号
                </label>
              ) : null}
              <div className="modal-actions">
                <button onClick={closeSuperAdminDialog} type="button">
                  取消
                </button>
                <button className="primary" type="submit">
                  {editingSuperAdmin ? "保存修改" : "创建超管"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TenantsModule({
  closeTenantDialog,
  closeTenantUserDialog,
  deleteTenant,
  deleteTenantUser,
  disabledReason,
  editingTenant,
  editingTenantUser,
  openCreateTenantDialog,
  openEditTenantDialog,
  openEditTenantUserDialog,
  roleOptions,
  saveTenant,
  saveTenantUser,
  setTenantAdminConfirmPassword,
  setTenantAdminName,
  setTenantAdminPassword,
  setTenantAdminPhone,
  setTenantName,
  setTenantUserConfirmPassword,
  setTenantUserIsActive,
  setTenantUserName,
  setTenantUserPassword,
  setTenantUserPhone,
  setTenantUserRoleCode,
  tenantAdminConfirmPassword,
  tenantAdminName,
  tenantAdminPassword,
  tenantAdminPhone,
  tenantDialogOpen,
  tenantName,
  tenants,
  tenantUserConfirmPassword,
  tenantUserDialogOpen,
  tenantUserIsActive,
  tenantUserName,
  tenantUserPassword,
  tenantUserPhone,
  tenantUserRoleCode,
}: {
  closeTenantDialog: () => void;
  closeTenantUserDialog: () => void;
  deleteTenant: (item: Tenant) => void;
  deleteTenantUser: (tenantId: string, item: ConsoleUser) => void;
  disabledReason: string;
  editingTenant?: Tenant;
  editingTenantUser: { tenantId: string; user: ConsoleUser } | null;
  openCreateTenantDialog: () => void;
  openEditTenantDialog: (item: Tenant) => void;
  openEditTenantUserDialog: (tenantId: string, item: ConsoleUser) => void;
  roleOptions: Array<{ code: string; name: string }>;
  saveTenant: (event: FormEvent<HTMLFormElement>) => void;
  saveTenantUser: (event: FormEvent<HTMLFormElement>) => void;
  setTenantAdminConfirmPassword: (value: string) => void;
  setTenantAdminName: (value: string) => void;
  setTenantAdminPassword: (value: string) => void;
  setTenantAdminPhone: (value: string) => void;
  setTenantName: (value: string) => void;
  setTenantUserConfirmPassword: (value: string) => void;
  setTenantUserIsActive: (value: boolean) => void;
  setTenantUserName: (value: string) => void;
  setTenantUserPassword: (value: string) => void;
  setTenantUserPhone: (value: string) => void;
  setTenantUserRoleCode: (value: string) => void;
  tenantAdminConfirmPassword: string;
  tenantAdminName: string;
  tenantAdminPassword: string;
  tenantAdminPhone: string;
  tenantDialogOpen: boolean;
  tenantName: string;
  tenants: Tenant[];
  tenantUserConfirmPassword: string;
  tenantUserDialogOpen: boolean;
  tenantUserIsActive: boolean;
  tenantUserName: string;
  tenantUserPassword: string;
  tenantUserPhone: string;
  tenantUserRoleCode: string;
}) {
  return (
    <section className="workspace">
      <TablePanel
        action={
          <button
            className="primary"
            disabled={Boolean(disabledReason)}
            onClick={openCreateTenantDialog}
            type="button"
          >
            新建租户
          </button>
        }
        count={`${tenants.length} 个`}
        title="租户列表"
      >
        {disabledReason ? (
          <div className="inline-notice">{disabledReason}</div>
        ) : null}
        <table>
          <thead>
            <tr>
              <th>租户名称</th>
              <th>租户编码</th>
              <th>用户信息</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id}>
                <td>{tenant.name}</td>
                <td>{tenant.code}</td>
                <td className="wrap-cell">
                  <div className="tenant-user-list">
                    {tenant.users.length > 0 ? (
                      tenant.users.map((item) => (
                        <div className="tenant-user-row" key={item.id}>
                          <span>
                            {item.name} · {item.phone ?? "-"} ·{" "}
                            {item.roles.map((role) => role.name).join("、") ||
                              "-"}
                          </span>
                          <div className="row-actions">
                            <button
                              disabled={Boolean(disabledReason)}
                              onClick={() =>
                                openEditTenantUserDialog(tenant.id, item)
                              }
                              type="button"
                            >
                              编辑
                            </button>
                            <button
                              disabled={Boolean(disabledReason)}
                              onClick={() => deleteTenantUser(tenant.id, item)}
                              type="button"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <span className="empty-inline">暂无用户</span>
                    )}
                  </div>
                </td>
                <td>
                  <span className={statusClassName(tenant.isActive)}>
                    {tenant.isActive ? "启用" : "停用"}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      disabled={Boolean(disabledReason)}
                      onClick={() => openEditTenantDialog(tenant)}
                      type="button"
                    >
                      编辑
                    </button>
                    <button
                      disabled={Boolean(disabledReason)}
                      onClick={() => deleteTenant(tenant)}
                      type="button"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablePanel>

      {tenantDialogOpen ? (
        <div
          aria-modal="true"
          className="modal-backdrop"
          onMouseDown={closeTenantDialog}
          role="dialog"
        >
          <div
            className="modal-panel"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <h2>{editingTenant ? "编辑租户" : "新建租户"}</h2>
              <button
                aria-label="关闭"
                className="icon-button"
                onClick={closeTenantDialog}
                type="button"
              >
                ×
              </button>
            </div>
            <form className="module-form" onSubmit={saveTenant}>
              <label>
                租户名称
                <input
                  onChange={(event) => setTenantName(event.target.value)}
                  value={tenantName}
                />
              </label>
              {!editingTenant ? (
                <>
                  <label>
                    管理员昵称
                    <input
                      onChange={(event) =>
                        setTenantAdminName(event.target.value)
                      }
                      value={tenantAdminName}
                    />
                  </label>
                  <label>
                    手机号
                    <input
                      onChange={(event) =>
                        setTenantAdminPhone(event.target.value)
                      }
                      value={tenantAdminPhone}
                    />
                  </label>
                  <label>
                    密码
                    <input
                      autoComplete="new-password"
                      onChange={(event) =>
                        setTenantAdminPassword(event.target.value)
                      }
                      type="password"
                      value={tenantAdminPassword}
                    />
                  </label>
                  <label>
                    确认密码
                    <input
                      autoComplete="new-password"
                      onChange={(event) =>
                        setTenantAdminConfirmPassword(event.target.value)
                      }
                      type="password"
                      value={tenantAdminConfirmPassword}
                    />
                  </label>
                </>
              ) : null}
              <div className="modal-actions">
                <button onClick={closeTenantDialog} type="button">
                  取消
                </button>
                <button className="primary" type="submit">
                  {editingTenant ? "保存修改" : "创建租户"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {tenantUserDialogOpen && editingTenantUser ? (
        <div
          aria-modal="true"
          className="modal-backdrop"
          onMouseDown={closeTenantUserDialog}
          role="dialog"
        >
          <div
            className="modal-panel"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <h2>编辑租户用户</h2>
              <button
                aria-label="关闭"
                className="icon-button"
                onClick={closeTenantUserDialog}
                type="button"
              >
                ×
              </button>
            </div>
            <form className="module-form" onSubmit={saveTenantUser}>
              <label>
                昵称
                <input
                  onChange={(event) => setTenantUserName(event.target.value)}
                  value={tenantUserName}
                />
              </label>
              <label>
                手机号
                <input
                  onChange={(event) => setTenantUserPhone(event.target.value)}
                  value={tenantUserPhone}
                />
              </label>
              <label>
                角色
                <select
                  onChange={(event) =>
                    setTenantUserRoleCode(event.target.value)
                  }
                  value={tenantUserRoleCode}
                >
                  {roleOptions.map((role) => (
                    <option key={role.code} value={role.code}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                重置密码
                <input
                  autoComplete="new-password"
                  onChange={(event) =>
                    setTenantUserPassword(event.target.value)
                  }
                  placeholder="不填写则保持原密码"
                  type="password"
                  value={tenantUserPassword}
                />
              </label>
              <label>
                确认密码
                <input
                  autoComplete="new-password"
                  onChange={(event) =>
                    setTenantUserConfirmPassword(event.target.value)
                  }
                  type="password"
                  value={tenantUserConfirmPassword}
                />
              </label>
              <label className="checkbox-row">
                <input
                  checked={tenantUserIsActive}
                  onChange={(event) =>
                    setTenantUserIsActive(event.target.checked)
                  }
                  type="checkbox"
                />
                启用账号
              </label>
              <div className="modal-actions">
                <button onClick={closeTenantUserDialog} type="button">
                  取消
                </button>
                <button className="primary" type="submit">
                  保存修改
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function IdentityModule({
  auditLogs,
  closeUserDialog,
  createConsoleUser,
  creatableRoles,
  currentUserId,
  deleteConsoleUser,
  disabledReason,
  editingUser,
  newUserEmail,
  newUserIsActive,
  newUserName,
  newUserPassword,
  newUserRoleCode,
  openCreateUserDialog,
  openEditUserDialog,
  roles,
  setNewUserEmail,
  setNewUserIsActive,
  setNewUserName,
  setNewUserPassword,
  setNewUserRoleCode,
  updateRolePermission,
  userRoles,
  userDialogOpen,
  users,
}: {
  auditLogs: AuditLog[];
  closeUserDialog: () => void;
  createConsoleUser: (event: FormEvent<HTMLFormElement>) => void;
  creatableRoles: Role[];
  currentUserId: string;
  deleteConsoleUser: (item: ConsoleUser) => void;
  disabledReason: string;
  editingUser?: ConsoleUser;
  newUserEmail: string;
  newUserIsActive: boolean;
  newUserName: string;
  newUserPassword: string;
  newUserRoleCode: string;
  openCreateUserDialog: () => void;
  openEditUserDialog: (item: ConsoleUser) => void;
  roles: Role[];
  setNewUserEmail: (value: string) => void;
  setNewUserIsActive: (value: boolean) => void;
  setNewUserName: (value: string) => void;
  setNewUserPassword: (value: string) => void;
  setNewUserRoleCode: (value: string) => void;
  updateRolePermission: (
    role: Role,
    permissionCode: string,
    enabled: boolean,
  ) => void;
  userRoles: string[];
  userDialogOpen: boolean;
  users: ConsoleUser[];
}) {
  const isAdmin = userRoles.includes("admin");
  const isOwner = userRoles.includes("owner");
  const canEditRole = (role: Role) =>
    (isAdmin && tenantAdminDelegatedRoleCodes.includes(role.code)) ||
    (isOwner && ownerDelegatedRoleCodes.includes(role.code));
  const canEditUser = (item: ConsoleUser) =>
    item.id === currentUserId ||
    (isAdmin &&
      item.roles.every((role) =>
        tenantAdminDelegatedRoleCodes.includes(role.code),
      )) ||
    (isOwner &&
      item.roles.every((role) => ownerDelegatedRoleCodes.includes(role.code)));
  const isEditingSelf = Boolean(
    editingUser && editingUser.id === currentUserId,
  );

  return (
    <section className="workspace">
      <TablePanel
        action={
          <button
            className="primary"
            disabled={Boolean(disabledReason)}
            onClick={openCreateUserDialog}
            type="button"
          >
            新建内部用户
          </button>
        }
        count={`${users.length} 个`}
        title="内部用户"
      >
        {disabledReason ? (
          <div className="inline-notice">{disabledReason}</div>
        ) : null}
        <table>
          <thead>
            <tr>
              <th>姓名</th>
              <th>登录账号</th>
              <th>角色</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.phone ?? item.email}</td>
                <td>{item.roles.map((role) => role.name).join("、")}</td>
                <td>
                  <span className={statusClassName(item.isActive)}>
                    {item.isActive ? "启用" : "停用"}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      disabled={Boolean(disabledReason) || !canEditUser(item)}
                      onClick={() => openEditUserDialog(item)}
                      type="button"
                    >
                      编辑
                    </button>
                    <button
                      disabled={
                        Boolean(disabledReason) ||
                        item.id === currentUserId ||
                        !canEditUser(item)
                      }
                      onClick={() => deleteConsoleUser(item)}
                      type="button"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablePanel>

      {userDialogOpen ? (
        <div
          aria-modal="true"
          className="modal-backdrop"
          onMouseDown={closeUserDialog}
          role="dialog"
        >
          <div
            className="modal-panel"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <h2>{editingUser ? "编辑内部用户" : "新建内部用户"}</h2>
              <button
                aria-label="关闭"
                className="icon-button"
                onClick={closeUserDialog}
                type="button"
              >
                ×
              </button>
            </div>
            <form className="module-form" onSubmit={createConsoleUser}>
              <label>
                登录账号
                <input
                  autoComplete="username"
                  onChange={(event) => setNewUserEmail(event.target.value)}
                  placeholder="手机号或邮箱"
                  value={newUserEmail}
                />
              </label>
              <label>
                姓名
                <input
                  onChange={(event) => setNewUserName(event.target.value)}
                  placeholder="内部用户姓名"
                  value={newUserName}
                />
              </label>
              <label>
                {editingUser ? "重置密码" : "初始密码"}
                <input
                  autoComplete="new-password"
                  onChange={(event) => setNewUserPassword(event.target.value)}
                  placeholder={
                    editingUser ? "不填写则保持原密码" : "至少 10 位"
                  }
                  type="password"
                  value={newUserPassword}
                />
              </label>
              <label>
                角色
                {isEditingSelf ? (
                  <input
                    disabled
                    value={
                      editingUser?.roles.map((role) => role.name).join("、") ??
                      "-"
                    }
                  />
                ) : (
                  <select
                    onChange={(event) => setNewUserRoleCode(event.target.value)}
                    value={newUserRoleCode}
                  >
                    <option value="">选择角色</option>
                    {creatableRoles.map((role) => (
                      <option key={role.id} value={role.code}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <label className="checkbox-row">
                <input
                  checked={newUserIsActive}
                  disabled={isEditingSelf}
                  onChange={(event) => setNewUserIsActive(event.target.checked)}
                  type="checkbox"
                />
                启用账号
              </label>
              {isEditingSelf ? (
                <small className="form-note">
                  当前账号只能修改登录账号、姓名和密码，角色与启用状态保持不变。
                </small>
              ) : null}
              {disabledReason ? (
                <small className="form-note">{disabledReason}</small>
              ) : null}
              <div className="modal-actions">
                <button onClick={closeUserDialog} type="button">
                  取消
                </button>
                <button
                  className="primary"
                  disabled={Boolean(disabledReason)}
                  type="submit"
                >
                  {editingUser ? "保存修改" : "创建用户"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <TablePanel title="角色权限" count={`${roles.length} 个角色`}>
        <table>
          <thead>
            <tr>
              <th>角色</th>
              <th>编码</th>
              <th>权限配置</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id}>
                <td>{role.name}</td>
                <td>{role.code}</td>
                <td className="wrap-cell">
                  <div className="permission-grid">
                    {permissionOptions.map((permission) => {
                      const checked =
                        role.permissions?.some(
                          (item) => item.permission.code === permission.code,
                        ) ?? false;
                      return (
                        <label key={permission.code}>
                          <input
                            checked={checked}
                            disabled={!canEditRole(role)}
                            onChange={(event) =>
                              updateRolePermission(
                                role,
                                permission.code,
                                event.target.checked,
                              )
                            }
                            type="checkbox"
                          />
                          {permission.label}
                        </label>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablePanel>

      <TablePanel title="最近审计" count={`${auditLogs.length} 条`}>
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>操作</th>
              <th>对象</th>
              <th>操作者</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log) => (
              <tr key={log.id}>
                <td>{dateText(log.createdAt)}</td>
                <td>{log.action}</td>
                <td>
                  {log.entityType}
                  {log.entityId ? ` / ${log.entityId.slice(0, 8)}` : ""}
                </td>
                <td>{log.actor?.name ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablePanel>
    </section>
  );
}

function CustomersModule({
  closeCustomerDialog,
  createCustomer,
  customerCode,
  customerDialogOpen,
  customerFullName,
  customerName,
  customers,
  deleteCustomer,
  disabledReason,
  editingCustomer,
  openCreateCustomerDialog,
  openEditCustomerDialog,
  selectedCustomerId,
  setCustomerFullName,
  setCustomerName,
  setSelectedCustomerId,
}: {
  closeCustomerDialog: () => void;
  createCustomer: (event: FormEvent<HTMLFormElement>) => void;
  customerCode: string;
  customerDialogOpen: boolean;
  customerFullName: string;
  customerName: string;
  customers: Customer[];
  deleteCustomer: (customer: Customer) => void;
  disabledReason: string;
  editingCustomer?: Customer;
  openCreateCustomerDialog: () => void;
  openEditCustomerDialog: (customer: Customer) => void;
  selectedCustomerId: string;
  setCustomerFullName: (value: string) => void;
  setCustomerName: (value: string) => void;
  setSelectedCustomerId: (value: string) => void;
}) {
  return (
    <section className="workspace">
      <TablePanel
        action={
          <button
            className="primary"
            disabled={Boolean(disabledReason)}
            onClick={openCreateCustomerDialog}
            type="button"
          >
            新增客户
          </button>
        }
        count={`${customers.length} 个`}
        title="客户列表"
      >
        {disabledReason ? (
          <div className="inline-notice">{disabledReason}</div>
        ) : null}
        <table>
          <thead>
            <tr>
              <th>客户编码</th>
              <th>客户简称</th>
              <th>客户全称</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr
                data-selected={selectedCustomerId === customer.id}
                key={customer.id}
                onClick={() => setSelectedCustomerId(customer.id)}
              >
                <td>{customer.code}</td>
                <td>{customer.name}</td>
                <td className="wrap-cell">
                  {customer.fullName ?? customer.name}
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      disabled={Boolean(disabledReason)}
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditCustomerDialog(customer);
                      }}
                      type="button"
                    >
                      编辑
                    </button>
                    <button
                      disabled={Boolean(disabledReason)}
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteCustomer(customer);
                      }}
                      type="button"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablePanel>

      {customerDialogOpen ? (
        <div
          aria-modal="true"
          className="modal-backdrop"
          onMouseDown={closeCustomerDialog}
          role="dialog"
        >
          <div
            className="modal-panel"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <h2>{editingCustomer ? "编辑客户" : "新增客户"}</h2>
              <button
                aria-label="关闭"
                className="icon-button"
                onClick={closeCustomerDialog}
                type="button"
              >
                ×
              </button>
            </div>
            <form className="module-form" onSubmit={createCustomer}>
              <label>
                客户编码
                <input
                  placeholder="系统自动分配"
                  readOnly
                  value={customerCode}
                />
              </label>
              <label>
                客户简称
                <input
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="用于列表和业务单据快速识别"
                  value={customerName}
                />
              </label>
              <label>
                客户全称
                <input
                  onChange={(event) => setCustomerFullName(event.target.value)}
                  placeholder="工商注册名或合同主体全称"
                  value={customerFullName}
                />
              </label>
              {disabledReason ? (
                <small className="form-note">{disabledReason}</small>
              ) : null}
              <div className="modal-actions">
                <button onClick={closeCustomerDialog} type="button">
                  取消
                </button>
                <button
                  className="primary"
                  disabled={Boolean(disabledReason)}
                  type="submit"
                >
                  {editingCustomer ? "保存修改" : "创建客户"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SigningEntitiesModule({
  closeSigningEntityDialog,
  deleteSigningEntity,
  disabledReason,
  editingSigningEntity,
  openCreateSigningEntityDialog,
  openEditSigningEntityDialog,
  saveSigningEntity,
  selectedSigningEntityId,
  setSelectedSigningEntityId,
  setSigningEntityFullName,
  setSigningEntityLegalRepresentative,
  setSigningEntityShortName,
  setSigningEntityTaxpayerType,
  signingEntities,
  signingEntityCode,
  signingEntityDialogOpen,
  signingEntityFullName,
  signingEntityLegalRepresentative,
  signingEntityShortName,
  signingEntityTaxpayerType,
}: {
  closeSigningEntityDialog: () => void;
  deleteSigningEntity: (entity: SigningEntity) => void;
  disabledReason: string;
  editingSigningEntity?: SigningEntity;
  openCreateSigningEntityDialog: () => void;
  openEditSigningEntityDialog: (entity: SigningEntity) => void;
  saveSigningEntity: (event: FormEvent<HTMLFormElement>) => void;
  selectedSigningEntityId: string;
  setSelectedSigningEntityId: (value: string) => void;
  setSigningEntityFullName: (value: string) => void;
  setSigningEntityLegalRepresentative: (value: string) => void;
  setSigningEntityShortName: (value: string) => void;
  setSigningEntityTaxpayerType: (value: TaxpayerType) => void;
  signingEntities: SigningEntity[];
  signingEntityCode: string;
  signingEntityDialogOpen: boolean;
  signingEntityFullName: string;
  signingEntityLegalRepresentative: string;
  signingEntityShortName: string;
  signingEntityTaxpayerType: TaxpayerType;
}) {
  return (
    <section className="workspace">
      <TablePanel
        action={
          <button
            className="primary"
            disabled={Boolean(disabledReason)}
            onClick={openCreateSigningEntityDialog}
            type="button"
          >
            新增主体
          </button>
        }
        count={`${signingEntities.length} 个`}
        title="签约主体列表"
      >
        {disabledReason ? (
          <div className="inline-notice">{disabledReason}</div>
        ) : null}
        <table>
          <thead>
            <tr>
              <th>主体编号</th>
              <th>签约主体简称</th>
              <th>签约主体全称</th>
              <th>法人姓名</th>
              <th>纳税人信息</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {signingEntities.map((entity) => (
              <tr
                data-selected={selectedSigningEntityId === entity.id}
                key={entity.id}
                onClick={() => setSelectedSigningEntityId(entity.id)}
              >
                <td>{entity.code}</td>
                <td>{entity.shortName}</td>
                <td className="wrap-cell">{entity.fullName}</td>
                <td>{entity.legalRepresentative}</td>
                <td>{taxpayerTypeText[entity.taxpayerType]}</td>
                <td>
                  <div className="row-actions">
                    <button
                      disabled={Boolean(disabledReason)}
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditSigningEntityDialog(entity);
                      }}
                      type="button"
                    >
                      编辑
                    </button>
                    <button
                      disabled={Boolean(disabledReason)}
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteSigningEntity(entity);
                      }}
                      type="button"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablePanel>

      {signingEntityDialogOpen ? (
        <div
          aria-modal="true"
          className="modal-backdrop"
          onMouseDown={closeSigningEntityDialog}
          role="dialog"
        >
          <div
            className="modal-panel"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <h2>{editingSigningEntity ? "编辑主体" : "新增主体"}</h2>
              <button
                aria-label="关闭"
                className="icon-button"
                onClick={closeSigningEntityDialog}
                type="button"
              >
                ×
              </button>
            </div>
            <form className="module-form" onSubmit={saveSigningEntity}>
              <label>
                主体编号
                <input
                  placeholder="系统自动分配"
                  readOnly
                  value={signingEntityCode}
                />
              </label>
              <label>
                签约主体简称
                <input
                  onChange={(event) =>
                    setSigningEntityShortName(event.target.value)
                  }
                  placeholder="用于合同快速选择"
                  value={signingEntityShortName}
                />
              </label>
              <label>
                签约主体全称
                <input
                  onChange={(event) =>
                    setSigningEntityFullName(event.target.value)
                  }
                  placeholder="营业执照或合同签署全称"
                  value={signingEntityFullName}
                />
              </label>
              <label>
                法人姓名
                <input
                  onChange={(event) =>
                    setSigningEntityLegalRepresentative(event.target.value)
                  }
                  placeholder="法定代表人姓名"
                  value={signingEntityLegalRepresentative}
                />
              </label>
              <label>
                纳税人信息
                <select
                  onChange={(event) =>
                    setSigningEntityTaxpayerType(
                      event.target.value as TaxpayerType,
                    )
                  }
                  value={signingEntityTaxpayerType}
                >
                  {Object.entries(taxpayerTypeText).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {disabledReason ? (
                <small className="form-note">{disabledReason}</small>
              ) : null}
              <div className="modal-actions">
                <button onClick={closeSigningEntityDialog} type="button">
                  取消
                </button>
                <button
                  className="primary"
                  disabled={Boolean(disabledReason)}
                  type="submit"
                >
                  {editingSigningEntity ? "保存修改" : "创建主体"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ContractsModule({
  attachmentPreview,
  closeContractDialog,
  closeContractDetail,
  contractCode,
  contractDetailOpen,
  contractDialogOpen,
  contractEndDate,
  contractCustomerContact,
  contractFee,
  contractFiles,
  contractIncentiveUnitPrice,
  contractServiceFeeRate,
  contractStartDate,
  contractTierDescription,
  contractTierMode,
  contracts,
  createContract,
  customers,
  deleteContract,
  disabledReason,
  editingContract,
  openAttachmentPreview,
  openCreateContractDialog,
  openContractDetail,
  openEditContractDialog,
  selectedCustomerId,
  selectedContract,
  selectedContractId,
  setContractEndDate,
  setContractCustomerContact,
  setContractFee,
  setContractIncentiveUnitPrice,
  setContractServiceFeeRate,
  setContractStartDate,
  setContractTierDescription,
  setContractTierMode,
  setSelectedCustomerId,
  setSelectedContractId,
  selectedSigningEntityId,
  setSelectedSigningEntityId,
  signingEntities,
  updateContractFiles,
}: {
  attachmentPreview: AttachmentPreview | null;
  closeContractDialog: () => void;
  closeContractDetail: () => void;
  contractCode: string;
  contractDetailOpen: boolean;
  contractDialogOpen: boolean;
  contractEndDate: string;
  contractCustomerContact: string;
  contractFee: string;
  contractFiles: File[];
  contractIncentiveUnitPrice: string;
  contractServiceFeeRate: string;
  contractStartDate: string;
  contractTierDescription: string;
  contractTierMode: string;
  contracts: Contract[];
  createContract: (event: FormEvent<HTMLFormElement>) => void;
  customers: Customer[];
  deleteContract: (contract: Contract) => void;
  disabledReason: string;
  editingContract?: Contract;
  openAttachmentPreview: (attachment: Attachment) => void;
  openCreateContractDialog: () => void;
  openContractDetail: (contract: Contract) => void;
  openEditContractDialog: (contract: Contract) => void;
  selectedCustomerId: string;
  selectedContract?: Contract;
  selectedContractId: string;
  setContractEndDate: (value: string) => void;
  setContractCustomerContact: (value: string) => void;
  setContractFee: (value: string) => void;
  setContractIncentiveUnitPrice: (value: string) => void;
  setContractServiceFeeRate: (value: string) => void;
  setContractStartDate: (value: string) => void;
  setContractTierDescription: (value: string) => void;
  setContractTierMode: (value: string) => void;
  setSelectedCustomerId: (value: string) => void;
  setSelectedContractId: (value: string) => void;
  selectedSigningEntityId: string;
  setSelectedSigningEntityId: (value: string) => void;
  signingEntities: SigningEntity[];
  updateContractFiles: (fileList: FileList | null) => void;
}) {
  return (
    <section className="workspace">
      <TablePanel
        action={
          <button
            className="primary"
            disabled={Boolean(disabledReason)}
            onClick={openCreateContractDialog}
            type="button"
          >
            新增合同
          </button>
        }
        count={`${contracts.length} 份`}
        title="合同列表"
      >
        {disabledReason ? (
          <div className="inline-notice">{disabledReason}</div>
        ) : null}
        <table>
          <thead>
            <tr>
              <th>合同编号</th>
              <th>客户简称</th>
              <th>我方签约主体</th>
              <th>合同周期</th>
              <th>费用规则</th>
              <th>合同附件</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract) => {
              const attachments = contract.attachments ?? [];
              return (
                <tr
                  data-selected={selectedContractId === contract.id}
                  key={contract.id}
                  onClick={() => setSelectedContractId(contract.id)}
                >
                  <td>{contract.code}</td>
                  <td>{contract.customer?.name ?? "-"}</td>
                  <td>{contract.signingEntity?.shortName ?? "-"}</td>
                  <td>{contractPeriod(contract)}</td>
                  <td className="truncate-cell">
                    基础 {moneyText(contractBaseFee(contract))} / 激励{" "}
                    {moneyText(contract.incentiveUnitPrice)} / 服务费{" "}
                    {rateText(contract.serviceFeeRate)}
                  </td>
                  <td>
                    {attachments.length > 0
                      ? `${attachments.length} 个附件`
                      : "未上传"}
                  </td>
                  <td>
                    <span className={statusClassName(contractStatus(contract))}>
                      {contractStatus(contract)}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          openContractDetail(contract);
                        }}
                        type="button"
                      >
                        查看
                      </button>
                      <button
                        disabled={Boolean(disabledReason)}
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditContractDialog(contract);
                        }}
                        type="button"
                      >
                        编辑
                      </button>
                      <button
                        disabled={Boolean(disabledReason)}
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteContract(contract);
                        }}
                        type="button"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TablePanel>

      {contractDialogOpen ? (
        <div
          aria-modal="true"
          className="modal-backdrop"
          onMouseDown={closeContractDialog}
          role="dialog"
        >
          <div
            className="modal-panel wide"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <h2>{editingContract ? "编辑合同" : "新增合同"}</h2>
              <button
                aria-label="关闭"
                className="icon-button"
                onClick={closeContractDialog}
                type="button"
              >
                ×
              </button>
            </div>
            <form className="module-form" onSubmit={createContract}>
              <div className="form-grid">
                <label>
                  客户选择
                  <select
                    onChange={(event) =>
                      setSelectedCustomerId(event.target.value)
                    }
                    value={selectedCustomerId}
                  >
                    <option value="">选择客户</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  合同编号
                  <input
                    placeholder="系统自动分配"
                    readOnly
                    value={contractCode}
                  />
                </label>
                <label>
                  我方签约主体
                  <select
                    onChange={(event) =>
                      setSelectedSigningEntityId(event.target.value)
                    }
                    value={selectedSigningEntityId}
                  >
                    <option value="">选择签约主体</option>
                    {signingEntities.map((entity) => (
                      <option key={entity.id} value={entity.id}>
                        {entity.shortName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  客户对接人
                  <input
                    onChange={(event) =>
                      setContractCustomerContact(event.target.value)
                    }
                    placeholder="例如 张三 13800000000"
                    value={contractCustomerContact}
                  />
                </label>
                <label>
                  周期开始
                  <input
                    onChange={(event) =>
                      setContractStartDate(event.target.value)
                    }
                    type="date"
                    value={contractStartDate}
                  />
                </label>
                <label>
                  周期结束
                  <input
                    onChange={(event) => setContractEndDate(event.target.value)}
                    type="date"
                    value={contractEndDate}
                  />
                </label>
                <label>
                  基础费用
                  <input
                    inputMode="decimal"
                    onChange={(event) => setContractFee(event.target.value)}
                    value={contractFee}
                  />
                </label>
                <label>
                  激励单价
                  <input
                    inputMode="decimal"
                    onChange={(event) =>
                      setContractIncentiveUnitPrice(event.target.value)
                    }
                    value={contractIncentiveUnitPrice}
                  />
                </label>
                <label>
                  服务费比例 %
                  <input
                    inputMode="decimal"
                    onChange={(event) =>
                      setContractServiceFeeRate(event.target.value)
                    }
                    value={contractServiceFeeRate}
                  />
                </label>
                <label>
                  阶梯规则模式
                  <select
                    onChange={(event) =>
                      setContractTierMode(event.target.value)
                    }
                    value={contractTierMode}
                  >
                    <option value="NONE">无</option>
                    <option value="ACCUMULATE">增量累加</option>
                    <option value="FULL_COVERAGE">全量覆盖</option>
                  </select>
                </label>
                {contractTierMode !== "NONE" ? (
                  <label>
                    规则描述
                    <input
                      onChange={(event) =>
                        setContractTierDescription(event.target.value)
                      }
                      placeholder="例如 达到约定业务量后按合同附件规则重算"
                      value={contractTierDescription}
                    />
                  </label>
                ) : null}
                <label className="full-span">
                  合同附件
                  <input
                    accept="application/pdf,.pdf"
                    multiple
                    onChange={(event) =>
                      updateContractFiles(event.target.files)
                    }
                    type="file"
                  />
                </label>
              </div>
              <div className="file-list">
                {contractFiles.length > 0
                  ? contractFiles.map((file) => (
                      <span key={`${file.name}-${file.size}`}>{file.name}</span>
                    ))
                  : "仅支持 PDF，单个文件小于 20MB，可一次选择多个文件。"}
              </div>
              {disabledReason ? (
                <small className="form-note">{disabledReason}</small>
              ) : null}
              <div className="modal-actions">
                <button onClick={closeContractDialog} type="button">
                  取消
                </button>
                <button
                  className="primary"
                  disabled={Boolean(disabledReason)}
                  type="submit"
                >
                  {editingContract ? "保存修改" : "创建合同"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {contractDetailOpen && selectedContract ? (
        <div
          aria-modal="true"
          className="modal-backdrop"
          onMouseDown={closeContractDetail}
          role="dialog"
        >
          <div
            className="modal-panel wide attachment-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <h2>合同详情</h2>
              <button
                aria-label="关闭"
                className="icon-button"
                onClick={closeContractDetail}
                type="button"
              >
                ×
              </button>
            </div>
            <div className="definition-list compact">
              <div>
                <span>合同编号</span>
                <strong>{selectedContract.code}</strong>
              </div>
              <div>
                <span>客户简称</span>
                <strong>{selectedContract.customer?.name ?? "-"}</strong>
              </div>
              <div>
                <span>我方签约主体</span>
                <strong>
                  {selectedContract.signingEntity?.shortName ?? "-"}
                </strong>
              </div>
              <div>
                <span>客户对接人</span>
                <strong>{selectedContract.customerContactText || "-"}</strong>
              </div>
              <div>
                <span>合同周期</span>
                <strong>{contractPeriod(selectedContract)}</strong>
              </div>
              <div>
                <span>基础费用</span>
                <strong>{moneyText(contractBaseFee(selectedContract))}</strong>
              </div>
              <div>
                <span>激励单价</span>
                <strong>
                  {moneyText(selectedContract.incentiveUnitPrice)}
                </strong>
              </div>
              <div>
                <span>服务费比例</span>
                <strong>{rateText(selectedContract.serviceFeeRate)}</strong>
              </div>
              <div>
                <span>阶梯规则</span>
                <strong>
                  {tierModeText(selectedContract.tierMode ?? "NONE")}
                </strong>
              </div>
              {selectedContract.tierRules?.[0]?.description ? (
                <div>
                  <span>规则描述</span>
                  <strong>{selectedContract.tierRules[0].description}</strong>
                </div>
              ) : null}
              <div>
                <span>状态</span>
                <strong>
                  <span
                    className={statusClassName(
                      contractStatus(selectedContract),
                    )}
                  >
                    {contractStatus(selectedContract)}
                  </span>
                </strong>
              </div>
            </div>
            <div className="attachment-list">
              {(selectedContract.attachments ?? []).length > 0 ? (
                selectedContract.attachments?.map((attachment) => (
                  <button
                    className="attachment-row"
                    key={attachment.id}
                    onClick={() => openAttachmentPreview(attachment)}
                    type="button"
                  >
                    <span>{attachment.fileName}</span>
                    <strong>合同附件</strong>
                    <small>{dateTimeText(attachment.createdAt)}</small>
                  </button>
                ))
              ) : (
                <div className="empty-state">暂无合同附件</div>
              )}
            </div>
            {attachmentPreview ? (
              <div className="attachment-preview">
                <div className="panel-header">
                  <h2>{attachmentPreview.attachment.fileName}</h2>
                  <a
                    href={attachmentPreview.downloadUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    下载
                  </a>
                </div>
                {isPreviewableAttachment(attachmentPreview.attachment) ? (
                  attachmentPreview.attachment.contentType?.startsWith(
                    "image/",
                  ) ? (
                    <img
                      alt={attachmentPreview.attachment.fileName}
                      src={attachmentPreview.url}
                    />
                  ) : (
                    <iframe
                      src={attachmentPreview.url}
                      title={attachmentPreview.attachment.fileName}
                    />
                  )
                ) : (
                  <div className="empty-state">
                    该附件暂不支持在线预览，请点击下载查看
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ClosingModule({
  periodMonth,
  profits,
}: {
  periodMonth: string;
  profits: ProfitRow[];
}) {
  return (
    <section className="workspace closing-layout">
      <div className="panel">
        <div className="panel-header">
          <h2>自动结账</h2>
          <span>{periodMonth}</span>
        </div>
        <div className="module-form">
          <p className="helper-text">
            当应收账单已到账，且该账期关联成本应付均已支付后，系统会自动关闭账期并刷新客户利润。
          </p>
        </div>
      </div>

      <ProfitTable profits={profits} />
    </section>
  );
}

function ReceivableBillingModule({
  attachmentPreview,
  billAttachments,
  billAttachmentsDialogOpen,
  billDialogOpen,
  billStatusDialogOpen,
  billStatusFiles,
  billStatusTarget,
  bills,
  closeBillAttachmentsDialog,
  closeBillDialog,
  closeBillStatusDialog,
  contracts,
  createReceivableBill,
  customers,
  disabledReason,
  openAttachmentPreview,
  openBillAttachmentsDialog,
  openBillStatusDialog,
  openCreateReceivableDialog,
  periodMonth,
  receivableAmount,
  receivableProjectName,
  receivableSigningEntityId,
  receivableTab,
  receiptAccount,
  saveBillStatus,
  selectedBill,
  selectedBillId,
  selectedContractId,
  selectedCustomerId,
  setBillStatusFiles,
  setBillStatusTarget,
  setPeriodMonth,
  setReceivableAmount,
  setReceivableProjectName,
  setReceivableSigningEntityId,
  setReceiptAccount,
  setReceivableTab,
  setSelectedBillId,
  setSelectedContractId,
  setSelectedCustomerId,
  signingEntities,
  statusDisabledReason,
}: {
  attachmentPreview: AttachmentPreview | null;
  billAttachments: Attachment[];
  billAttachmentsDialogOpen: boolean;
  billDialogOpen: boolean;
  billStatusDialogOpen: boolean;
  billStatusFiles: File[];
  billStatusTarget: string;
  bills: Bill[];
  closeBillAttachmentsDialog: () => void;
  closeBillDialog: () => void;
  closeBillStatusDialog: () => void;
  contracts: Contract[];
  createReceivableBill: (event: FormEvent<HTMLFormElement>) => void;
  customers: Customer[];
  disabledReason: string;
  openAttachmentPreview: (attachment: Attachment) => void;
  openBillAttachmentsDialog: (bill: Bill) => void;
  openBillStatusDialog: (bill: Bill) => void;
  openCreateReceivableDialog: () => void;
  periodMonth: string;
  receivableAmount: string;
  receivableProjectName: string;
  receivableSigningEntityId: string;
  receivableTab: "open" | "received";
  receiptAccount: string;
  saveBillStatus: (event: FormEvent<HTMLFormElement>) => void;
  selectedBill?: Bill;
  selectedBillId: string;
  selectedContractId: string;
  selectedCustomerId: string;
  setBillStatusFiles: (fileList: FileList | null) => void;
  setBillStatusTarget: (value: string) => void;
  setPeriodMonth: (value: string) => void;
  setReceivableAmount: (value: string) => void;
  setReceivableProjectName: (value: string) => void;
  setReceivableSigningEntityId: (value: string) => void;
  setReceiptAccount: (value: string) => void;
  setReceivableTab: (value: "open" | "received") => void;
  setSelectedBillId: (value: string) => void;
  setSelectedContractId: (value: string) => void;
  setSelectedCustomerId: (value: string) => void;
  signingEntities: SigningEntity[];
  statusDisabledReason: string;
}) {
  const customerContracts = contracts.filter(
    (contract) =>
      !selectedCustomerId ||
      contract.customerId === selectedCustomerId ||
      contract.customer?.id === selectedCustomerId,
  );
  const visibleBills = bills.filter((bill) =>
    receivableTab === "received"
      ? bill.status === "RECEIVED"
      : ["PENDING_APPROVAL", "PENDING_SETTLEMENT", "INVOICED"].includes(
          bill.status,
        ),
  );
  const nextStatus = selectedBill
    ? nextReceivableStatus(selectedBill.status)
    : "";
  const billStatusAttachmentRequired =
    billStatusTarget !== "PENDING_SETTLEMENT";
  function selectReceivableContract(contractId: string) {
    const nextContract = contracts.find(
      (contract) => contract.id === contractId,
    );
    const currentContract = contracts.find(
      (contract) => contract.id === selectedContractId,
    );
    const shouldRefreshProjectName =
      !receivableProjectName.trim() ||
      receivableProjectName.trim() === currentContract?.name.trim();
    setSelectedContractId(contractId);
    if (nextContract?.signingEntityId || nextContract?.signingEntity?.id) {
      setReceivableSigningEntityId(
        nextContract.signingEntityId ?? nextContract.signingEntity?.id ?? "",
      );
    } else {
      setReceivableSigningEntityId(signingEntities[0]?.id ?? "");
    }
    if (shouldRefreshProjectName && nextContract?.name) {
      setReceivableProjectName(nextContract.name);
    }
  }

  function selectReceivableCustomer(customerId: string) {
    const nextContract = contracts.find(
      (contract) =>
        contract.customerId === customerId ||
        contract.customer?.id === customerId,
    );
    setSelectedCustomerId(customerId);
    selectReceivableContract(nextContract?.id ?? "");
  }

  return (
    <section className="workspace billing-layout">
      <TablePanel
        action={
          <button
            className="primary"
            disabled={Boolean(disabledReason)}
            onClick={openCreateReceivableDialog}
            type="button"
          >
            新增账单应收
          </button>
        }
        count={`${visibleBills.length} 条`}
        title="账单应收列表"
      >
        {disabledReason ? (
          <div className="inline-notice">{disabledReason}</div>
        ) : null}
        <div className="sub-tabs">
          <button
            data-active={receivableTab === "open"}
            onClick={() => setReceivableTab("open")}
            type="button"
          >
            应收账单
          </button>
          <button
            data-active={receivableTab === "received"}
            onClick={() => setReceivableTab("received")}
            type="button"
          >
            已收账单
          </button>
        </div>
        <BillsTable
          bills={visibleBills}
          onAttachments={openBillAttachmentsDialog}
          onSelect={setSelectedBillId}
          onStatusEdit={openBillStatusDialog}
          selectedBillId={selectedBillId}
        />
      </TablePanel>

      {billDialogOpen ? (
        <div
          aria-modal="true"
          className="modal-backdrop"
          onMouseDown={closeBillDialog}
          role="dialog"
        >
          <div
            className="modal-panel xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <h2>新增账单应收</h2>
              <button
                aria-label="关闭"
                className="icon-button"
                onClick={closeBillDialog}
                type="button"
              >
                ×
              </button>
            </div>
            <form className="module-form" onSubmit={createReceivableBill}>
              <div className="form-grid">
                <label>
                  客户
                  <select
                    onChange={(event) =>
                      selectReceivableCustomer(event.target.value)
                    }
                    value={selectedCustomerId}
                  >
                    <option value="">选择客户</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  合同
                  <select
                    onChange={(event) =>
                      selectReceivableContract(event.target.value)
                    }
                    value={selectedContractId}
                  >
                    <option value="">选择合同</option>
                    {customerContracts.map((contract) => (
                      <option key={contract.id} value={contract.id}>
                        {contract.code} · {contractPeriod(contract)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  项目名称
                  <input
                    onChange={(event) =>
                      setReceivableProjectName(event.target.value)
                    }
                    placeholder="输入项目名称"
                    value={receivableProjectName}
                  />
                </label>
                <label>
                  我方主体
                  <select
                    onChange={(event) =>
                      setReceivableSigningEntityId(event.target.value)
                    }
                    value={receivableSigningEntityId}
                  >
                    <option value="">选择我方主体</option>
                    {signingEntities.map((entity) => (
                      <option key={entity.id} value={entity.id}>
                        {entity.shortName} · {entity.fullName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  月份
                  <input
                    className="month-picker"
                    onChange={(event) => setPeriodMonth(event.target.value)}
                    type="month"
                    value={periodMonth}
                  />
                </label>
                <label>
                  金额
                  <input
                    inputMode="decimal"
                    onChange={(event) =>
                      setReceivableAmount(event.target.value)
                    }
                    value={receivableAmount}
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button onClick={closeBillDialog} type="button">
                  取消
                </button>
                <button className="primary" type="submit">
                  提交审批
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {billStatusDialogOpen && selectedBill ? (
        <div
          aria-modal="true"
          className="modal-backdrop"
          onMouseDown={closeBillStatusDialog}
          role="dialog"
        >
          <div
            className="modal-panel"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <h2>修改账单状态</h2>
              <button
                aria-label="关闭"
                className="icon-button"
                onClick={closeBillStatusDialog}
                type="button"
              >
                ×
              </button>
            </div>
            <form className="module-form" onSubmit={saveBillStatus}>
              <div className="definition-list compact">
                <div>
                  <span>账单号</span>
                  <strong>{selectedBill.billNo}</strong>
                </div>
                <div>
                  <span>当前状态</span>
                  <strong>
                    <span className={statusClassName(selectedBill.status)}>
                      {billStatus(selectedBill.status)}
                    </span>
                  </strong>
                </div>
              </div>
              <label>
                修改为
                <select
                  onChange={(event) => setBillStatusTarget(event.target.value)}
                  value={billStatusTarget}
                >
                  {nextStatus ? (
                    <option value={nextStatus}>{billStatus(nextStatus)}</option>
                  ) : null}
                </select>
              </label>
              {billStatusTarget === "RECEIVED" ? (
                <label>
                  收款账户
                  <input
                    onChange={(event) => setReceiptAccount(event.target.value)}
                    value={receiptAccount}
                  />
                </label>
              ) : null}
              <label>
                {billStatusAttachmentRequired ? "状态附件" : "状态附件（可选）"}
                <input
                  accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
                  multiple
                  onChange={(event) => setBillStatusFiles(event.target.files)}
                  type="file"
                />
              </label>
              <small className="file-list">
                {billStatusFiles.map((file) => file.name).join("、") ||
                  (billStatusAttachmentRequired
                    ? "未选择状态附件"
                    : "当前步骤可不上传附件")}
              </small>
              {statusDisabledReason ? (
                <small className="form-note">{statusDisabledReason}</small>
              ) : null}
              <div className="modal-actions">
                <button onClick={closeBillStatusDialog} type="button">
                  取消
                </button>
                <button
                  className="primary"
                  disabled={Boolean(statusDisabledReason) || !nextStatus}
                  type="submit"
                >
                  保存状态
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {billAttachmentsDialogOpen && selectedBill ? (
        <div
          aria-modal="true"
          className="modal-backdrop"
          onMouseDown={closeBillAttachmentsDialog}
          role="dialog"
        >
          <div
            className="modal-panel wide attachment-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <h2>账单附件</h2>
              <button
                aria-label="关闭"
                className="icon-button"
                onClick={closeBillAttachmentsDialog}
                type="button"
              >
                ×
              </button>
            </div>
            <div className="attachment-list">
              {billAttachments.length > 0 ? (
                billAttachments.map((attachment) => (
                  <button
                    className="attachment-row"
                    key={attachment.id}
                    onClick={() => openAttachmentPreview(attachment)}
                    type="button"
                  >
                    <span>{attachment.fileName}</span>
                    <strong>
                      {attachmentStatusLabel(attachment, selectedBill)}
                    </strong>
                    <small>{dateTimeText(attachment.createdAt)}</small>
                  </button>
                ))
              ) : (
                <div className="empty-state">暂无附件</div>
              )}
            </div>
            {attachmentPreview ? (
              <div className="attachment-preview">
                <div className="panel-header">
                  <h2>{attachmentPreview.attachment.fileName}</h2>
                  <a
                    href={attachmentPreview.downloadUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    下载
                  </a>
                </div>
                {isPreviewableAttachment(attachmentPreview.attachment) ? (
                  attachmentPreview.attachment.contentType?.startsWith(
                    "image/",
                  ) ? (
                    <img
                      alt={attachmentPreview.attachment.fileName}
                      src={attachmentPreview.url}
                    />
                  ) : (
                    <iframe
                      src={attachmentPreview.url}
                      title={attachmentPreview.attachment.fileName}
                    />
                  )
                ) : (
                  <div className="empty-state">
                    该附件暂不支持在线预览，请点击下载查看
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CostPayableModule({
  attachmentPreview,
  bills,
  closePayableAttachmentsDialog,
  closePayableDialog,
  closePayableStatusDialog,
  closeRecipientAttachmentsDialog,
  closeRecipientDialog,
  createCostPayable,
  deletePaymentRecipient,
  disabledReason,
  editingRecipient,
  openAttachmentPreview,
  openCreatePayableDialog,
  openCreateRecipientDialog,
  openEditRecipientDialog,
  openPayableAttachmentsDialog,
  openPayableStatusDialog,
  openRecipientAttachmentsDialog,
  payableAmount,
  payableAttachments,
  payableAttachmentsDialogOpen,
  payableDialogOpen,
  payablePaymentAccount,
  payableRemarks,
  payableStatusDialogOpen,
  payableStatusFiles,
  payableStatusTarget,
  payableTab,
  payableRecipientSearch,
  payables,
  paymentRecipients,
  recipientAccountName,
  recipientAccountNo,
  recipientAttachments,
  recipientAttachmentsDialogOpen,
  recipientBankBranch,
  recipientDialogOpen,
  recipientFiles,
  recipientName,
  recipientPlatform,
  savePayableStatus,
  savePaymentRecipient,
  selectedBillId,
  selectedPayable,
  selectedPayableId,
  selectedPaymentRecipient,
  selectedPaymentRecipientId,
  setPayableAmount,
  setPayablePaymentAccount,
  setPayableRecipientSearch,
  setPayableRemarks,
  setPayableStatusFiles,
  setPayableStatusTarget,
  setPayableTab,
  setRecipientAccountName,
  setRecipientAccountNo,
  setRecipientBankBranch,
  setRecipientFiles,
  setRecipientName,
  setRecipientPlatform,
  setSelectedBillId,
  setSelectedPayableId,
  setSelectedPaymentRecipientId,
  statusDisabledReason,
}: {
  attachmentPreview: AttachmentPreview | null;
  bills: Bill[];
  closePayableAttachmentsDialog: () => void;
  closePayableDialog: () => void;
  closePayableStatusDialog: () => void;
  closeRecipientAttachmentsDialog: () => void;
  closeRecipientDialog: () => void;
  createCostPayable: (event: FormEvent<HTMLFormElement>) => void;
  deletePaymentRecipient: (recipient: PaymentRecipient) => void;
  disabledReason: string;
  editingRecipient?: PaymentRecipient;
  openAttachmentPreview: (attachment: Attachment) => void;
  openCreatePayableDialog: () => void;
  openCreateRecipientDialog: () => void;
  openEditRecipientDialog: (recipient: PaymentRecipient) => void;
  openPayableAttachmentsDialog: (payable: Payable) => void;
  openPayableStatusDialog: (payable: Payable) => void;
  openRecipientAttachmentsDialog: (recipient: PaymentRecipient) => void;
  payableAmount: string;
  payableAttachments: Attachment[];
  payableAttachmentsDialogOpen: boolean;
  payableDialogOpen: boolean;
  payablePaymentAccount: string;
  payableRemarks: string;
  payableStatusDialogOpen: boolean;
  payableStatusFiles: File[];
  payableStatusTarget: string;
  payableTab: "bills" | "paid" | "recipients";
  payableRecipientSearch: string;
  payables: Payable[];
  paymentRecipients: PaymentRecipient[];
  recipientAccountName: string;
  recipientAccountNo: string;
  recipientAttachments: Attachment[];
  recipientAttachmentsDialogOpen: boolean;
  recipientBankBranch: string;
  recipientDialogOpen: boolean;
  recipientFiles: File[];
  recipientName: string;
  recipientPlatform: PaymentRecipientPlatform;
  savePayableStatus: (event: FormEvent<HTMLFormElement>) => void;
  savePaymentRecipient: (event: FormEvent<HTMLFormElement>) => void;
  selectedBillId: string;
  selectedPayable?: Payable;
  selectedPayableId: string;
  selectedPaymentRecipient?: PaymentRecipient;
  selectedPaymentRecipientId: string;
  setPayableAmount: (value: string) => void;
  setPayablePaymentAccount: (value: string) => void;
  setPayableRecipientSearch: (value: string) => void;
  setPayableRemarks: (value: string) => void;
  setPayableStatusFiles: (fileList: FileList | null) => void;
  setPayableStatusTarget: (value: string) => void;
  setPayableTab: (value: "bills" | "paid" | "recipients") => void;
  setRecipientAccountName: (value: string) => void;
  setRecipientAccountNo: (value: string) => void;
  setRecipientBankBranch: (value: string) => void;
  setRecipientFiles: (fileList: FileList | null) => void;
  setRecipientName: (value: string) => void;
  setRecipientPlatform: (value: PaymentRecipientPlatform) => void;
  setSelectedBillId: (value: string) => void;
  setSelectedPayableId: (value: string) => void;
  setSelectedPaymentRecipientId: (value: string) => void;
  statusDisabledReason: string;
}) {
  const [recipientListSearch, setRecipientListSearch] = useState("");
  const [payableRecipientPickerOpen, setPayableRecipientPickerOpen] =
    useState(false);
  const matchRecipient = (recipient: PaymentRecipient, keyword: string) => {
    if (!keyword) {
      return true;
    }
    const fields = [
      recipient.name,
      paymentRecipientPlatformText[recipient.platform],
      recipient.accountName,
      recipient.accountNo,
      recipient.bankBranch ?? "",
    ];
    return fields.some((field) => field.toLowerCase().includes(keyword));
  };
  const payableRecipientKeyword = payableRecipientSearch.trim().toLowerCase();
  const recipientListKeyword = recipientListSearch.trim().toLowerCase();
  const matchedPayableRecipients = paymentRecipients.filter((recipient) =>
    matchRecipient(recipient, payableRecipientKeyword),
  );
  const payableRecipientOptions = matchedPayableRecipients;
  const visibleRecipients = paymentRecipients.filter((recipient) =>
    matchRecipient(recipient, recipientListKeyword),
  );
  const visiblePayables = payables.filter((payable) =>
    payableTab === "paid"
      ? payable.status === "PAID"
      : payable.status !== "PAID" && payable.status !== "VOIDED",
  );
  const nextStatus = selectedPayable
    ? nextPayableStatus(selectedPayable.status)
    : "";

  return (
    <section className="workspace billing-layout">
      <TablePanel
        action={
          <button
            className="primary"
            disabled={Boolean(disabledReason)}
            onClick={
              payableTab === "recipients"
                ? openCreateRecipientDialog
                : openCreatePayableDialog
            }
            type="button"
          >
            {payableTab === "recipients" ? "新增收款人" : "新增成本应付"}
          </button>
        }
        count={
          payableTab === "recipients"
            ? `${visibleRecipients.length} 个`
            : `${visiblePayables.length} 条`
        }
        title={payableTab === "recipients" ? "收款人列表" : "成本应付列表"}
      >
        {disabledReason ? (
          <div className="inline-notice">{disabledReason}</div>
        ) : null}
        <div className="sub-tabs">
          <button
            data-active={payableTab === "bills"}
            onClick={() => setPayableTab("bills")}
            type="button"
          >
            应付账单
          </button>
          <button
            data-active={payableTab === "paid"}
            onClick={() => setPayableTab("paid")}
            type="button"
          >
            已付账单
          </button>
          <button
            data-active={payableTab === "recipients"}
            onClick={() => setPayableTab("recipients")}
            type="button"
          >
            收款人
          </button>
        </div>
        {payableTab !== "recipients" ? (
          <table>
            <thead>
              <tr>
                <th>收款方</th>
                <th>收款账户</th>
                <th>关联账单</th>
                <th>客户</th>
                <th>月份</th>
                <th>应付金额</th>
                <th>状态</th>
                <th>附件</th>
              </tr>
            </thead>
            <tbody>
              {visiblePayables.map((payable) => (
                <tr
                  data-selected={selectedPayableId === payable.id}
                  key={payable.id}
                  onClick={() => setSelectedPayableId(payable.id)}
                >
                  <td>{payable.vendorName}</td>
                  <td className="truncate-cell">
                    {payableAccountText(payable) || "-"}
                  </td>
                  <td>{payable.bill?.billNo ?? "-"}</td>
                  <td>{payable.customer?.name ?? "-"}</td>
                  <td>
                    {payable.periodMonth ?? payable.bill?.periodMonth ?? "-"}
                  </td>
                  <td>{money(payable.amount)}</td>
                  <td>
                    {nextPayableStatus(payable.status) ? (
                      <button
                        className={`${statusClassName(payable.status)} status-button`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openPayableStatusDialog(payable);
                        }}
                        type="button"
                      >
                        {payableStatusText[payable.status] ?? payable.status}
                      </button>
                    ) : (
                      <span className={statusClassName(payable.status)}>
                        {payableStatusText[payable.status] ?? payable.status}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      className="link-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openPayableAttachmentsDialog(payable);
                      }}
                      type="button"
                    >
                      查看附件
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <>
            <div className="table-toolbar">
              <input
                onChange={(event) => setRecipientListSearch(event.target.value)}
                placeholder="搜索资源名称、账户名、账号、支行"
                value={recipientListSearch}
              />
            </div>
            <table>
              <thead>
                <tr>
                  <th>资源名称</th>
                  <th>收款平台</th>
                  <th>账户名</th>
                  <th>账号</th>
                  <th>银行支行</th>
                  <th>附件</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecipients.map((recipient) => (
                  <tr
                    data-selected={selectedPaymentRecipientId === recipient.id}
                    key={recipient.id}
                    onClick={() => setSelectedPaymentRecipientId(recipient.id)}
                  >
                    <td>{recipient.name}</td>
                    <td>{paymentRecipientPlatformText[recipient.platform]}</td>
                    <td>{recipient.accountName}</td>
                    <td>{recipient.accountNo}</td>
                    <td>{recipient.bankBranch ?? "-"}</td>
                    <td>
                      <button
                        className="link-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openRecipientAttachmentsDialog(recipient);
                        }}
                        type="button"
                      >
                        查看附件
                        {recipient.attachmentCount
                          ? `（${recipient.attachmentCount}）`
                          : ""}
                      </button>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          disabled={Boolean(disabledReason)}
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditRecipientDialog(recipient);
                          }}
                          type="button"
                        >
                          编辑
                        </button>
                        <button
                          disabled={Boolean(disabledReason)}
                          onClick={(event) => {
                            event.stopPropagation();
                            deletePaymentRecipient(recipient);
                          }}
                          type="button"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </TablePanel>

      {payableDialogOpen ? (
        <div
          aria-modal="true"
          className="modal-backdrop"
          onMouseDown={closePayableDialog}
          role="dialog"
        >
          <div
            className="modal-panel"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <h2>新增成本应付</h2>
              <button
                aria-label="关闭"
                className="icon-button"
                onClick={closePayableDialog}
                type="button"
              >
                ×
              </button>
            </div>
            <form className="module-form" onSubmit={createCostPayable}>
              <label>
                关联账单
                <select
                  onChange={(event) => setSelectedBillId(event.target.value)}
                  value={selectedBillId}
                >
                  <option value="">选择账单</option>
                  {bills.map((bill) => (
                    <option key={bill.id} value={bill.id}>
                      {billOptionLabel(bill)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="field-block">
                <span className="field-label">资源名称</span>
                <div className="recipient-combobox">
                  <input
                    autoComplete="off"
                    onBlur={() => {
                      setTimeout(
                        () => setPayableRecipientPickerOpen(false),
                        120,
                      );
                    }}
                    onChange={(event) => {
                      setPayableRecipientSearch(event.target.value);
                      setPayableRecipientPickerOpen(true);
                      setSelectedPaymentRecipientId("");
                    }}
                    onFocus={() => setPayableRecipientPickerOpen(true)}
                    placeholder="搜索并选择资源名称、账户名、账号或支行"
                    value={payableRecipientSearch}
                  />
                  {payableRecipientPickerOpen ? (
                    <div className="recipient-picker-list">
                      {payableRecipientOptions.length > 0 ? (
                        payableRecipientOptions.map((recipient) => (
                          <button
                            data-selected={
                              selectedPaymentRecipientId === recipient.id
                            }
                            key={recipient.id}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setSelectedPaymentRecipientId(recipient.id);
                              setPayableRecipientSearch(
                                paymentRecipientOptionText(recipient),
                              );
                              setPayableRecipientPickerOpen(false);
                            }}
                            type="button"
                          >
                            <strong>{recipient.name}</strong>
                            <span>
                              {paymentRecipientAccountText(recipient)}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="recipient-picker-empty">
                          没有匹配的收款人
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="definition-list compact">
                <div>
                  <span>资源账户</span>
                  <strong>
                    {selectedPaymentRecipient
                      ? paymentRecipientAccountText(selectedPaymentRecipient)
                      : "-"}
                  </strong>
                </div>
              </div>
              <label>
                应付金额
                <input
                  inputMode="decimal"
                  onChange={(event) => setPayableAmount(event.target.value)}
                  value={payableAmount}
                />
              </label>
              <label>
                备注
                <input
                  onChange={(event) => setPayableRemarks(event.target.value)}
                  value={payableRemarks}
                />
              </label>
              <div className="modal-actions">
                <button onClick={closePayableDialog} type="button">
                  取消
                </button>
                <button className="primary" type="submit">
                  创建应付
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {recipientDialogOpen ? (
        <div
          aria-modal="true"
          className="modal-backdrop"
          onMouseDown={closeRecipientDialog}
          role="dialog"
        >
          <div
            className="modal-panel"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <h2>{editingRecipient ? "编辑收款人" : "新增收款人"}</h2>
              <button
                aria-label="关闭"
                className="icon-button"
                onClick={closeRecipientDialog}
                type="button"
              >
                ×
              </button>
            </div>
            <form className="module-form" onSubmit={savePaymentRecipient}>
              <label>
                资源名称
                <input
                  onChange={(event) => setRecipientName(event.target.value)}
                  value={recipientName}
                />
              </label>
              <label>
                收款平台
                <select
                  onChange={(event) =>
                    setRecipientPlatform(
                      event.target.value as PaymentRecipientPlatform,
                    )
                  }
                  value={recipientPlatform}
                >
                  {Object.entries(paymentRecipientPlatformText).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                账户名
                <input
                  onChange={(event) =>
                    setRecipientAccountName(event.target.value)
                  }
                  value={recipientAccountName}
                />
              </label>
              <label>
                账号
                <input
                  onChange={(event) =>
                    setRecipientAccountNo(event.target.value)
                  }
                  value={recipientAccountNo}
                />
              </label>
              <label>
                银行支行
                <input
                  onChange={(event) =>
                    setRecipientBankBranch(event.target.value)
                  }
                  value={recipientBankBranch}
                />
              </label>
              <label>
                附件
                <input
                  multiple
                  onChange={(event) => setRecipientFiles(event.target.files)}
                  type="file"
                />
              </label>
              <small className="file-list">
                {recipientFiles.length > 0
                  ? recipientFiles.map((file) => (
                      <span key={`${file.name}-${file.size}`}>{file.name}</span>
                    ))
                  : "可上传多个附件，非必传，单个文件小于 20MB。"}
              </small>
              {disabledReason ? (
                <small className="form-note">{disabledReason}</small>
              ) : null}
              <div className="modal-actions">
                <button onClick={closeRecipientDialog} type="button">
                  取消
                </button>
                <button
                  className="primary"
                  disabled={Boolean(disabledReason)}
                  type="submit"
                >
                  {editingRecipient ? "保存修改" : "创建收款人"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {payableStatusDialogOpen && selectedPayable ? (
        <div
          aria-modal="true"
          className="modal-backdrop"
          onMouseDown={closePayableStatusDialog}
          role="dialog"
        >
          <div
            className="modal-panel"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <h2>修改应付状态</h2>
              <button
                aria-label="关闭"
                className="icon-button"
                onClick={closePayableStatusDialog}
                type="button"
              >
                ×
              </button>
            </div>
            <form className="module-form" onSubmit={savePayableStatus}>
              <div className="definition-list compact">
                <div>
                  <span>收款方</span>
                  <strong>{selectedPayable.vendorName}</strong>
                </div>
                <div>
                  <span>收款账户</span>
                  <strong>{payableAccountText(selectedPayable) || "-"}</strong>
                </div>
                <div>
                  <span>当前状态</span>
                  <strong>
                    <span className={statusClassName(selectedPayable.status)}>
                      {payableStatusText[selectedPayable.status] ??
                        selectedPayable.status}
                    </span>
                  </strong>
                </div>
              </div>
              <label>
                修改为
                <select
                  onChange={(event) =>
                    setPayableStatusTarget(event.target.value)
                  }
                  value={payableStatusTarget}
                >
                  {nextStatus ? (
                    <option value={nextStatus}>
                      {payableStatusText[nextStatus] ?? nextStatus}
                    </option>
                  ) : null}
                </select>
              </label>
              {payableStatusTarget === "PAID" ? (
                <label>
                  付款账户
                  <input
                    onChange={(event) =>
                      setPayablePaymentAccount(event.target.value)
                    }
                    value={payablePaymentAccount}
                  />
                </label>
              ) : null}
              <label>
                文件/截图
                <input
                  accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
                  multiple
                  onChange={(event) =>
                    setPayableStatusFiles(event.target.files)
                  }
                  type="file"
                />
              </label>
              <small className="file-list">
                {payableStatusFiles.map((file) => file.name).join("、") ||
                  "未选择状态附件"}
              </small>
              {statusDisabledReason ? (
                <small className="form-note">{statusDisabledReason}</small>
              ) : null}
              <div className="modal-actions">
                <button onClick={closePayableStatusDialog} type="button">
                  取消
                </button>
                <button
                  className="primary"
                  disabled={Boolean(statusDisabledReason) || !nextStatus}
                  type="submit"
                >
                  保存状态
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {payableAttachmentsDialogOpen && selectedPayable ? (
        <div
          aria-modal="true"
          className="modal-backdrop"
          onMouseDown={closePayableAttachmentsDialog}
          role="dialog"
        >
          <div
            className="modal-panel wide attachment-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <h2>应付附件</h2>
              <button
                aria-label="关闭"
                className="icon-button"
                onClick={closePayableAttachmentsDialog}
                type="button"
              >
                ×
              </button>
            </div>
            <div className="attachment-list">
              {payableAttachments.length > 0 ? (
                payableAttachments.map((attachment) => (
                  <button
                    className="attachment-row"
                    key={attachment.id}
                    onClick={() => openAttachmentPreview(attachment)}
                    type="button"
                  >
                    <span>{attachment.fileName}</span>
                    <strong>
                      {payableAttachmentStatusLabel(
                        attachment,
                        selectedPayable,
                      )}
                    </strong>
                    <small>{dateTimeText(attachment.createdAt)}</small>
                  </button>
                ))
              ) : (
                <div className="empty-state">暂无附件</div>
              )}
            </div>
            {attachmentPreview ? (
              <div className="attachment-preview">
                <div className="panel-header">
                  <h2>{attachmentPreview.attachment.fileName}</h2>
                  <a
                    href={attachmentPreview.downloadUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    下载
                  </a>
                </div>
                {isPreviewableAttachment(attachmentPreview.attachment) ? (
                  attachmentPreview.attachment.contentType?.startsWith(
                    "image/",
                  ) ? (
                    <img
                      alt={attachmentPreview.attachment.fileName}
                      src={attachmentPreview.url}
                    />
                  ) : (
                    <iframe
                      src={attachmentPreview.url}
                      title={attachmentPreview.attachment.fileName}
                    />
                  )
                ) : (
                  <div className="empty-state">
                    该附件暂不支持在线预览，请点击下载查看
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {recipientAttachmentsDialogOpen && selectedPaymentRecipient ? (
        <div
          aria-modal="true"
          className="modal-backdrop"
          onMouseDown={closeRecipientAttachmentsDialog}
          role="dialog"
        >
          <div
            className="modal-panel wide attachment-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <h2>资源附件</h2>
              <button
                aria-label="关闭"
                className="icon-button"
                onClick={closeRecipientAttachmentsDialog}
                type="button"
              >
                ×
              </button>
            </div>
            <div className="definition-list compact">
              <div>
                <span>资源名称</span>
                <strong>{selectedPaymentRecipient.name}</strong>
              </div>
              <div>
                <span>收款账户</span>
                <strong>
                  {paymentRecipientAccountText(selectedPaymentRecipient)}
                </strong>
              </div>
            </div>
            <div className="attachment-list">
              {recipientAttachments.length > 0 ? (
                recipientAttachments.map((attachment) => (
                  <button
                    className="attachment-row"
                    key={attachment.id}
                    onClick={() => openAttachmentPreview(attachment)}
                    type="button"
                  >
                    <span>{attachment.fileName}</span>
                    <strong>资源附件</strong>
                    <small>{dateTimeText(attachment.createdAt)}</small>
                  </button>
                ))
              ) : (
                <div className="empty-state">暂无附件</div>
              )}
            </div>
            {attachmentPreview ? (
              <div className="attachment-preview">
                <div className="panel-header">
                  <h2>{attachmentPreview.attachment.fileName}</h2>
                  <a
                    href={attachmentPreview.downloadUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    下载
                  </a>
                </div>
                {isPreviewableAttachment(attachmentPreview.attachment) ? (
                  attachmentPreview.attachment.contentType?.startsWith(
                    "image/",
                  ) ? (
                    <img
                      alt={attachmentPreview.attachment.fileName}
                      src={attachmentPreview.url}
                    />
                  ) : (
                    <iframe
                      src={attachmentPreview.url}
                      title={attachmentPreview.attachment.fileName}
                    />
                  )
                ) : (
                  <div className="empty-state">
                    该附件暂不支持在线预览，请点击下载查看
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function BillsTable({
  bills,
  onAttachments,
  onSelect,
  onStatusEdit,
  selectedBillId,
}: {
  bills: Bill[];
  onAttachments?: (bill: Bill) => void;
  onSelect: (id: string) => void;
  onStatusEdit?: (bill: Bill) => void;
  selectedBillId?: string;
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>账单号</th>
          <th>项目名称</th>
          <th>客户</th>
          <th>我方主体</th>
          <th>月份</th>
          <th>应收金额</th>
          <th>状态</th>
          <th>附件</th>
        </tr>
      </thead>
      <tbody>
        {bills.map((bill) => (
          <tr
            data-selected={selectedBillId === bill.id}
            key={bill.id}
            onClick={() => onSelect(bill.id)}
          >
            <td>{bill.billNo}</td>
            <td>{billProjectName(bill)}</td>
            <td>{bill.customer?.name ?? "-"}</td>
            <td>{billSigningEntityName(bill)}</td>
            <td>{bill.periodMonth}</td>
            <td>{money(bill.totalAmount)}</td>
            <td>
              {onStatusEdit && nextReceivableStatus(bill.status) ? (
                <button
                  className={`${statusClassName(bill.status)} status-button`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onStatusEdit(bill);
                  }}
                  type="button"
                >
                  {billStatus(bill.status)}
                </button>
              ) : (
                <span className={statusClassName(bill.status)}>
                  {billStatus(bill.status)}
                </span>
              )}
            </td>
            <td>
              {onAttachments ? (
                <button
                  className="link-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAttachments(bill);
                  }}
                  type="button"
                >
                  查看附件（{billAttachmentIds(bill).length}）
                </button>
              ) : (
                `${billAttachmentIds(bill).length} 个`
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ProfitTable({ profits }: { profits: ProfitRow[] }) {
  return (
    <TablePanel title="客户利润" count={`${profits.length} 个客户`}>
      <table>
        <thead>
          <tr>
            <th>客户</th>
            <th>收入</th>
            <th>成本</th>
            <th>利润</th>
            <th>毛利率</th>
          </tr>
        </thead>
        <tbody>
          {profits.map((row) => (
            <tr key={row.customerName}>
              <td>{row.customerName}</td>
              <td>{money(row.incomeAmount)}</td>
              <td>{money(row.costAmount)}</td>
              <td>{money(row.profitAmount)}</td>
              <td>{row.grossMargin ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TablePanel>
  );
}

function TablePanel({
  action,
  children,
  count,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  count: string;
  title: string;
}) {
  return (
    <div className="panel table-panel">
      <div className="panel-header">
        <h2>{title}</h2>
        <div className="panel-actions">
          <span>{count}</span>
          {action}
        </div>
      </div>
      {children}
    </div>
  );
}
