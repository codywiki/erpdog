"use client";

import { FormEvent, useMemo, useState } from "react";

type ApiUser = {
  email: string;
  name: string;
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
  status: string;
};

type Contract = {
  id: string;
  code: string;
  name: string;
  status: string;
  customer?: Customer;
};

type Bill = {
  id: string;
  billNo: string;
  periodMonth: string;
  status: string;
  totalAmount: string;
  invoiceAmount?: string;
  receiptAmount?: string;
  customer?: Customer;
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
  vendorName: string;
  amount: string;
  status: string;
  customer?: Customer | null;
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
  email: string;
  name: string;
  isActive: boolean;
  roles: Role[];
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
  contracts: Contract[];
  bills: Bill[];
  invoices: Invoice[];
  receipts: Receipt[];
  costEntries: CostEntry[];
  payables: Payable[];
  paymentRequests: PaymentRequest[];
  payments: Payment[];
  users: ConsoleUser[];
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

const demoToken = "demo-token";

const demoUser: ApiUser = {
  email: "demo@erpdog.local",
  name: "Demo Admin",
  permissions: ["demo"],
};

const authExpiredMessage = "登录已过期，请重新登录。";
const loginRequiredMessage = "请先登录正式系统。";

const permissionLabels: Record<string, string> = {
  "user.manage": "用户管理",
  "customer.write": "客户维护",
  "contract.write": "合同维护",
  "bill.manage": "账单管理",
};

const configuredApiBase = process.env.NEXT_PUBLIC_API_URL?.trim();
const apiBase = configuredApiBase
  ? configuredApiBase.replace(/\/$/, "")
  : "/api/v1";

function uniqueSuffix() {
  return Date.now().toString(36).toUpperCase();
}

function defaultCustomerCode() {
  return `CUST-${uniqueSuffix()}`;
}

function defaultContractCode() {
  return `CTR-${uniqueSuffix()}`;
}

function defaultManagerEmail() {
  return `manager-${uniqueSuffix().toLowerCase()}@erpdog.local`;
}

function translateErrorMessage(message: string) {
  if (/Missing bearer token|Invalid or expired bearer token/i.test(message)) {
    return authExpiredMessage;
  }
  if (/You do not have permission/i.test(message)) {
    return "当前账号没有权限执行此操作。";
  }
  if (/Unique constraint failed|already exists/i.test(message)) {
    return "编码或邮箱已存在，请换一个。";
  }
  if (/customerId is required/i.test(message)) {
    return "请先选择客户。";
  }
  if (/roleCodes is required|One or more roles are invalid/i.test(message)) {
    return "请选择有效角色。";
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

const modules = [
  { id: "dashboard", label: "经营总览", title: "经营驾驶舱" },
  { id: "activation", label: "正式启用", title: "正式启用路径" },
  { id: "identity", label: "用户权限", title: "用户、角色与审计" },
  { id: "customers", label: "客户", title: "客户管理" },
  { id: "contracts", label: "合同", title: "合同管理" },
  { id: "billing", label: "账单", title: "账单中心" },
  { id: "receivables", label: "应收", title: "发票与收款" },
  { id: "costs", label: "成本付款", title: "成本与付款" },
  { id: "closing", label: "结账报表", title: "结账与报表" },
] as const;

type ModuleId = (typeof modules)[number]["id"];

const billStatusText: Record<string, string> = {
  DRAFT: "草稿",
  INTERNAL_REVIEW: "内部审核",
  FINANCE_REVIEW: "财务审核",
  CUSTOMER_PENDING: "待客户确认",
  CUSTOMER_CONFIRMED: "客户已确认",
  ADJUSTED: "已调整",
  CLOSED: "已关闭",
  VOIDED: "已作废",
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
    contracts: [],
    bills: [],
    invoices: [],
    receipts: [],
    costEntries: [],
    payables: [],
    paymentRequests: [],
    payments: [],
    users: [],
    roles: [],
    auditLogs: [],
    profits: [],
  };
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

function createDemoData(periodMonth: string): ConsoleData {
  const customerA: Customer = {
    id: "demo-customer-qingliu",
    code: "CUST-001",
    name: "上海清流派科技有限公司",
    status: "ACTIVE",
  };
  const customerB: Customer = {
    id: "demo-customer-yunhe",
    code: "CUST-002",
    name: "杭州云河供应链有限公司",
    status: "ACTIVE",
  };
  const contractA: Contract = {
    id: "demo-contract-qingliu",
    code: "CTR-001",
    name: "清流派月度运营服务合同",
    status: "ACTIVE",
    customer: customerA,
  };
  const contractB: Contract = {
    id: "demo-contract-yunhe",
    code: "CTR-002",
    name: "云河供应链财务外包服务",
    status: "ACTIVE",
    customer: customerB,
  };
  const billA: Bill = {
    id: "demo-bill-qingliu",
    billNo: `BILL-${periodMonth}-DEMO-CTR-001`,
    periodMonth,
    status: "CUSTOMER_CONFIRMED",
    totalAmount: "18200.00",
    invoiceAmount: "0.00",
    receiptAmount: "10000.00",
    customer: customerA,
  };
  const billB: Bill = {
    id: "demo-bill-yunhe",
    billNo: `BILL-${periodMonth}-DEMO-CTR-002`,
    periodMonth,
    status: "CLOSED",
    totalAmount: "12600.00",
    invoiceAmount: "12600.00",
    receiptAmount: "12600.00",
    customer: customerB,
  };

  return {
    customers: [customerA, customerB],
    contracts: [contractA, contractB],
    bills: [billA, billB],
    invoices: [
      {
        id: "demo-invoice-yunhe",
        invoiceNo: `INV-${periodMonth}-001`,
        status: "ISSUED",
        amount: "12600.00",
        issueDate: `${periodMonth}-18T00:00:00.000Z`,
      },
    ],
    receipts: [
      {
        id: "demo-receipt-yunhe",
        receiptNo: `RCPT-${periodMonth}-001`,
        amount: "12600.00",
        receivedAt: `${periodMonth}-21T00:00:00.000Z`,
      },
      {
        id: "demo-receipt-qingliu",
        receiptNo: `RCPT-${periodMonth}-002`,
        amount: "10000.00",
        receivedAt: `${periodMonth}-24T00:00:00.000Z`,
      },
    ],
    costEntries: [
      {
        id: "demo-cost-qingliu",
        amount: "4600.00",
        periodMonth,
        description: "外包执行服务",
        customer: customerA,
      },
      {
        id: "demo-cost-yunhe",
        amount: "3900.00",
        periodMonth,
        description: "财务资料整理",
        customer: customerB,
      },
    ],
    payables: [
      {
        id: "demo-payable-qingliu",
        vendorName: "上海砺行服务有限公司",
        amount: "4600.00",
        status: "PENDING",
        customer: customerA,
      },
    ],
    paymentRequests: [
      {
        id: "demo-payment-request-ops",
        requestNo: `PR-${periodMonth}-DEMO-001`,
        status: "SUBMITTED",
        supplierName: "上海砺行服务有限公司",
        requestedAmount: "4600.00",
      },
    ],
    payments: [],
    users: [
      {
        id: "demo-user-admin",
        email: "admin@erpdog.local",
        name: "Demo Admin",
        isActive: true,
        roles: [{ id: "demo-role-admin", code: "admin", name: "管理员" }],
      },
      {
        id: "demo-user-owner",
        email: "owner@erpdog.local",
        name: "业务负责人",
        isActive: true,
        roles: [
          {
            id: "demo-role-customer-manager",
            code: "customer_manager",
            name: "客户负责人",
          },
        ],
      },
    ],
    roles: [
      { id: "demo-role-admin", code: "admin", name: "管理员" },
      { id: "demo-role-finance", code: "finance", name: "财务" },
      {
        id: "demo-role-customer-manager",
        code: "customer_manager",
        name: "客户负责人",
      },
    ],
    auditLogs: [
      {
        id: "demo-audit-bill",
        action: "bill.customer_confirm",
        entityType: "bill",
        entityId: billA.id,
        createdAt: `${periodMonth}-28T10:00:00.000Z`,
        actor: { name: "Demo Admin", email: "admin@erpdog.local" },
      },
      {
        id: "demo-audit-payment-request",
        action: "payment_request.create",
        entityType: "payment_request",
        entityId: "demo-payment-request-ops",
        createdAt: `${periodMonth}-29T10:00:00.000Z`,
        actor: { name: "业务负责人", email: "owner@erpdog.local" },
      },
    ],
    profits: [
      {
        customerName: customerA.name,
        incomeAmount: "18200.00",
        costAmount: "4600.00",
        profitAmount: "13600.00",
        grossMargin: "74.73%",
      },
      {
        customerName: customerB.name,
        incomeAmount: "12600.00",
        costAmount: "3900.00",
        profitAmount: "8700.00",
        grossMargin: "69.05%",
      },
    ],
  };
}

export default function Home() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<ApiUser | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [message, setMessage] = useState("等待登录或进入演示");
  const [active, setActive] = useState<ModuleId>("dashboard");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [costEntries, setCostEntries] = useState<CostEntry[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [users, setUsers] = useState<ConsoleUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [profits, setProfits] = useState<ProfitRow[]>([]);
  const [email, setEmail] = useState("admin@erpdog.local");
  const [password, setPassword] = useState("");
  const [periodMonth, setPeriodMonth] = useState("2026-04");
  const [customerCode, setCustomerCode] = useState(defaultCustomerCode);
  const [customerName, setCustomerName] = useState("示例客户");
  const [contractCode, setContractCode] = useState(defaultContractCode);
  const [contractFee, setContractFee] = useState("10000.00");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedContractId, setSelectedContractId] = useState("");
  const [selectedBillId, setSelectedBillId] = useState("");
  const [newUserEmail, setNewUserEmail] = useState(defaultManagerEmail);
  const [newUserName, setNewUserName] = useState("客户负责人");
  const [newUserPassword, setNewUserPassword] = useState("ChangeMe123!");
  const [newUserRoleCode, setNewUserRoleCode] = useState("customer_manager");

  const selectedBill = bills.find((bill) => bill.id === selectedBillId);
  const selectedCustomer = customers.find(
    (customer) => customer.id === selectedCustomerId,
  );
  const activeModule = modules.find((module) => module.id === active)!;
  const isLoggedIn = Boolean(token && user && !demoMode);
  const hasPermission = (...permissions: string[]) =>
    permissions.length === 0 ||
    (user?.permissions.some((permission) => permissions.includes(permission)) ??
      false);
  const actionBlockReason = (...permissions: string[]) => {
    if (demoMode) {
      return "";
    }
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
  const metrics = useMemo(() => {
    const income = bills.reduce(
      (total, bill) => total + Number(bill.totalAmount ?? 0),
      0,
    );
    const receivable = bills.reduce(
      (total, bill) =>
        total + Number(bill.totalAmount ?? 0) - Number(bill.receiptAmount ?? 0),
      0,
    );
    const uninvoiced = bills.reduce(
      (total, bill) =>
        total + Number(bill.totalAmount ?? 0) - Number(bill.invoiceAmount ?? 0),
      0,
    );
    const cost = costEntries.reduce(
      (total, row) => total + Number(row.amount ?? 0),
      0,
    );
    const profit = profits.reduce(
      (total, row) => total + Number(row.profitAmount ?? 0),
      0,
    );

    return [
      { label: "本期收入", value: money(income) },
      { label: "未收金额", value: money(receivable) },
      { label: "未开票金额", value: money(uninvoiced) },
      { label: "本期成本", value: money(cost) },
      { label: "付款申请", value: paymentRequests.length.toString() },
      { label: "毛利", value: money(profit) },
    ];
  }, [bills, costEntries, paymentRequests.length, profits]);

  const pendingTasks = useMemo(
    () => [
      {
        label: "待客户确认账单",
        value: bills.filter((bill) => bill.status === "CUSTOMER_PENDING")
          .length,
      },
      {
        label: "待开票账单",
        value: bills.filter(
          (bill) =>
            Number(bill.totalAmount ?? 0) > Number(bill.invoiceAmount ?? 0),
        ).length,
      },
      {
        label: "待收款账单",
        value: bills.filter(
          (bill) =>
            Number(bill.totalAmount ?? 0) > Number(bill.receiptAmount ?? 0),
        ).length,
      },
      {
        label: "待审批付款",
        value: paymentRequests.filter(
          (request) => request.status === "SUBMITTED",
        ).length,
      },
    ],
    [bills, paymentRequests],
  );

  function applyConsoleData(data: ConsoleData) {
    setCustomers(data.customers);
    setContracts(data.contracts);
    setBills(data.bills);
    setInvoices(data.invoices);
    setReceipts(data.receipts);
    setCostEntries(data.costEntries);
    setPayables(data.payables);
    setPaymentRequests(data.paymentRequests);
    setPayments(data.payments);
    setUsers(data.users);
    setRoles(data.roles);
    setAuditLogs(data.auditLogs);
    setProfits(data.profits);
    setSelectedCustomerId((current) =>
      data.customers.some((customer) => customer.id === current)
        ? current
        : (data.customers[0]?.id ?? ""),
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
    setNewUserRoleCode((current) =>
      data.roles.some((role) => role.code === current)
        ? current
        : (data.roles[0]?.code ?? "customer_manager"),
    );
  }

  function enterDemoMode(nextPeriodMonth = periodMonth) {
    setDemoMode(true);
    setToken(demoToken);
    setUser(demoUser);
    applyConsoleData(createDemoData(nextPeriodMonth));
    setMessage("静态预览：演示数据只用于理解流程");
  }

  function resetSession(message = authExpiredMessage) {
    setDemoMode(false);
    setToken("");
    setUser(null);
    applyConsoleData(emptyConsoleData());
    setMessage(message);
  }

  async function request<T>(
    path: string,
    init?: RequestInit,
    options: { auth?: boolean } = {},
  ): Promise<T> {
    if (demoMode) {
      throw new Error("演示模式不会写入后端；正式使用请连接 API 后登录");
    }

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

  async function refresh(nextToken = token, nextUser = user) {
    if (demoMode || nextToken === demoToken) {
      enterDemoMode(periodMonth);
      return;
    }

    if (!nextToken) {
      setMessage("请先登录正式 API，或进入演示了解流程");
      return;
    }

    const authHeader = { Authorization: `Bearer ${nextToken}` };
    const can = (...permissions: string[]) =>
      nextUser?.permissions.some((permission) =>
        permissions.includes(permission),
      ) ?? false;
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
    const fetchIf = async <TValue,>(
      allowed: boolean,
      path: string,
      fallback: TValue,
    ) => (allowed ? fetchJson<TValue>(path) : fallback);

    const [
      nextCustomers,
      nextContracts,
      nextBills,
      nextInvoices,
      nextReceipts,
      nextCostEntries,
      nextPayables,
      nextRequests,
      nextPayments,
      nextUsers,
      nextRoles,
      nextAuditLogs,
      nextProfits,
    ] = await Promise.all([
      fetchIf<Customer[] | PaginatedResponse<Customer>>(
        can("customer.read_all", "customer.read_own"),
        "/customers?pageSize=50",
        emptyPage<Customer>(),
      ),
      fetchIf<Contract[] | PaginatedResponse<Contract>>(
        can("customer.read_all", "customer.read_own"),
        "/contracts?pageSize=50",
        emptyPage<Contract>(),
      ),
      fetchIf<Bill[] | PaginatedResponse<Bill>>(
        can("customer.read_all", "customer.read_own", "bill.manage"),
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
        can("cost.manage", "payment.pay"),
        "/payables?pageSize=50",
        emptyPage<Payable>(),
      ),
      fetchIf<PaymentRequest[] | PaginatedResponse<PaymentRequest>>(
        can("payment_request.create", "payment_request.approve", "payment.pay"),
        "/payment-requests?pageSize=50",
        emptyPage<PaymentRequest>(),
      ),
      fetchIf<Payment[] | PaginatedResponse<Payment>>(
        can("payment.pay"),
        "/payments?pageSize=50",
        emptyPage<Payment>(),
      ),
      fetchIf<ConsoleUser[] | PaginatedResponse<ConsoleUser>>(
        can("user.manage"),
        "/identity/users?pageSize=50",
        emptyPage<ConsoleUser>(),
      ),
      fetchIf<Role[]>(can("user.manage"), "/identity/roles", []),
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
      contracts: listItems(nextContracts),
      bills: listItems(nextBills),
      invoices: listItems(nextInvoices),
      receipts: listItems(nextReceipts),
      costEntries: listItems(nextCostEntries),
      payables: listItems(nextPayables),
      paymentRequests: listItems(nextRequests),
      payments: listItems(nextPayments),
      users: listItems(nextUsers),
      roles: nextRoles,
      auditLogs: listItems(nextAuditLogs),
      profits: nextProfits,
    });
    setMessage("正式数据已刷新");
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const result = await request<{
        accessToken: string;
        user: ApiUser;
      }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        },
        { auth: false },
      );
      setDemoMode(false);
      setToken(result.accessToken);
      setUser(result.user);
      setMessage(`已登录：${result.user.name}`);
      await refresh(result.accessToken, result.user);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `登录失败：${translateErrorMessage(error.message)}`
          : "登录失败，请检查后端服务",
      );
    }
  }

  function summarizeAction(label: string, result: unknown) {
    const summary = result as ActionSummary | undefined;
    if (
      label === "生成月度账单" &&
      summary &&
      typeof summary === "object"
    ) {
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
      if (demoMode) {
        setMessage(`${label}：演示模式仅展示流程，正式模式会写入后端`);
        return;
      }

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

  function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customerCode.trim() || !customerName.trim()) {
      setMessage("创建客户失败：客户编码和客户名称不能为空。");
      return;
    }

    void submitAction("创建客户", ["customer.write"], async () => {
      const result = await request("/customers", {
        method: "POST",
        body: JSON.stringify({
          code: customerCode,
          name: customerName,
          status: "ACTIVE",
        }),
      });
      setCustomerCode(defaultCustomerCode());
      return result;
    });
  }

  function createConsoleUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newUserEmail.trim() || !newUserName.trim()) {
      setMessage("创建用户失败：邮箱和姓名不能为空。");
      return;
    }
    if (!newUserRoleCode) {
      setMessage("创建用户失败：请选择有效角色。");
      return;
    }

    void submitAction("创建用户", ["user.manage"], async () => {
      const result = await request("/identity/users", {
        method: "POST",
        body: JSON.stringify({
          email: newUserEmail,
          name: newUserName,
          password: newUserPassword,
          roleCodes: [newUserRoleCode],
        }),
      });
      setNewUserEmail(defaultManagerEmail());
      return result;
    });
  }

  function createContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCustomerId) {
      setMessage("创建合同失败：请先选择客户。");
      return;
    }
    if (!contractCode.trim()) {
      setMessage("创建合同失败：合同编码不能为空。");
      return;
    }
    if (!Number.isFinite(Number(contractFee)) || Number(contractFee) <= 0) {
      setMessage("创建合同失败：基础月费必须大于 0。");
      return;
    }

    void submitAction("创建合同", ["contract.write"], async () => {
      const result = await request("/contracts", {
        method: "POST",
        body: JSON.stringify({
          customerId: selectedCustomerId,
          code: contractCode,
          name: `${selectedCustomer?.name ?? customerName} 服务合同`,
          status: "ACTIVE",
          startDate: `${periodMonth}-01`,
          chargeItems: [
            {
              name: "基础服务费",
              kind: "FIXED",
              amount: contractFee,
            },
          ],
        }),
      });
      setContractCode(defaultContractCode());
      return result;
    });
  }

  function runBilling() {
    if (!contracts.some((contract) => contract.status === "ACTIVE")) {
      setMessage("生成月度账单失败：当前没有可计费的 ACTIVE 合同。");
      return;
    }

    void submitAction("生成月度账单", ["bill.manage"], () =>
      request("/billing-runs", {
        method: "POST",
        body: JSON.stringify({ periodMonth }),
      }),
    );
  }

  function transitionBill(path: string, label: string, body: object = {}) {
    if (!selectedBillId) {
      setMessage("请先选择一张账单");
      return;
    }

    void submitAction(label, ["bill.manage"], () =>
      request(`/bills/${selectedBillId}/${path}`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }

  function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBill) {
      setMessage("请先选择一张账单");
      return;
    }

    void submitAction("登记发票", ["invoice.manage"], () =>
      request("/invoices", {
        method: "POST",
        body: JSON.stringify({
          invoiceNo: `INV-${Date.now().toString(36).toUpperCase()}`,
          invoiceType: "增值税普通发票",
          issueDate: new Date().toISOString(),
          amount: selectedBill.totalAmount,
          allocations: [
            {
              billId: selectedBill.id,
              amount: selectedBill.totalAmount,
            },
          ],
        }),
      }),
    );
  }

  function createReceipt() {
    if (!selectedBill) {
      setMessage("请先选择一张账单");
      return;
    }

    void submitAction("登记收款", ["receipt.manage"], () =>
      request("/receipts", {
        method: "POST",
        body: JSON.stringify({
          receivedAt: new Date().toISOString(),
          amount: selectedBill.totalAmount,
          account: "默认收款账户",
          allocations: [
            {
              billId: selectedBill.id,
              amount: selectedBill.totalAmount,
            },
          ],
        }),
      }),
    );
  }

  function createCostEntry() {
    if (!selectedCustomerId) {
      setMessage("请先选择客户");
      return;
    }

    void submitAction("登记成本", ["cost.manage"], () =>
      request("/cost-entries", {
        method: "POST",
        body: JSON.stringify({
          customerId: selectedCustomerId,
          periodMonth,
          amount: "1000.00",
          incurredDate: new Date().toISOString(),
          description: "服务成本",
          createPayable: true,
          vendorName: "示例供应商",
        }),
      }),
    );
  }

  function createPaymentRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitAction("发起付款申请", ["payment_request.create"], () =>
      request("/payment-requests", {
        method: "POST",
        body: JSON.stringify({
          supplierName: "示例供应商",
          customerId: selectedCustomerId || undefined,
          periodMonth,
          requestedAmount: "1000.00",
          reason: "服务成本付款",
          items: [
            {
              customerId: selectedCustomerId || undefined,
              periodMonth,
              amount: "1000.00",
              description: "服务成本",
            },
          ],
        }),
      }),
    );
  }

  function closePeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitAction("关闭账期", ["period.close"], () =>
      request(`/periods/${periodMonth}/close`, {
        method: "POST",
        body: JSON.stringify({ reason: "月度结账" }),
      }),
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>erpdog</strong>
          <span>服务型业务 ERP</span>
        </div>
        <nav className="nav" aria-label="主导航">
          {modules.map((item) => (
            <button
              data-active={active === item.id}
              key={item.id}
              onClick={() => setActive(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="session">
          <span>{user?.name ?? "未登录"}</span>
          {demoMode ? <small className="mode-pill">静态预览</small> : null}
          <small>{message}</small>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{activeModule.title}</h1>
            <p>
              {periodMonth}
              {demoMode ? " · Demo 数据" : " · 正式 API 模式"}
            </p>
          </div>
          <div className="toolbar">
            <input
              aria-label="账期"
              onChange={(event) => setPeriodMonth(event.target.value)}
              value={periodMonth}
            />
            <button
              onClick={() =>
                void refresh().catch((error: unknown) =>
                  setMessage(
                    error instanceof Error ? error.message : "刷新失败",
                  ),
                )
              }
              type="button"
            >
              刷新
            </button>
          </div>
        </header>

        <section className="mode-banner">
          <strong>
            {demoMode ? "当前是静态演示" : "当前连接正式后端 API"}
          </strong>
          <span>
            {demoMode
              ? "演示数据只用于理解流程，正式业务请退出演示并登录后端账号。"
              : "登录后会读取真实数据库数据，创建、审核、结账等操作会写入后端系统。"}
          </span>
        </section>

        {!token ? (
          <section className="panel login-panel">
            <form onSubmit={(event) => void login(event)}>
              <label>
                邮箱
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
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
              <button className="primary" type="submit">
                登录正式系统
              </button>
              <button
                className="secondary"
                onClick={() => enterDemoMode()}
                type="button"
              >
                进入演示
              </button>
            </form>
          </section>
        ) : null}

        {active === "dashboard" ? (
          <DashboardModule
            bills={bills}
            metrics={metrics}
            pendingTasks={pendingTasks}
            profits={profits}
            setActive={setActive}
          />
        ) : null}

        {active === "activation" ? (
          <ActivationModule apiBase={apiBase} demoMode={demoMode} />
        ) : null}

        {active === "identity" ? (
          <IdentityModule
            auditLogs={auditLogs}
            createConsoleUser={createConsoleUser}
            disabledReason={actionBlockReason("user.manage")}
            newUserEmail={newUserEmail}
            newUserName={newUserName}
            newUserPassword={newUserPassword}
            newUserRoleCode={newUserRoleCode}
            roles={roles}
            setNewUserEmail={setNewUserEmail}
            setNewUserName={setNewUserName}
            setNewUserPassword={setNewUserPassword}
            setNewUserRoleCode={setNewUserRoleCode}
            users={users}
          />
        ) : null}

        {active === "customers" ? (
          <CustomersModule
            createCustomer={createCustomer}
            customerCode={customerCode}
            customerName={customerName}
            customers={customers}
            disabledReason={actionBlockReason("customer.write")}
            selectedCustomerId={selectedCustomerId}
            setCustomerCode={setCustomerCode}
            setCustomerName={setCustomerName}
            setSelectedCustomerId={setSelectedCustomerId}
          />
        ) : null}

        {active === "contracts" ? (
          <ContractsModule
            contractCode={contractCode}
            contractFee={contractFee}
            contracts={contracts}
            createContract={createContract}
            customers={customers}
            disabledReason={actionBlockReason("contract.write")}
            selectedCustomerId={selectedCustomerId}
            selectedContractId={selectedContractId}
            setContractCode={setContractCode}
            setContractFee={setContractFee}
            setSelectedCustomerId={setSelectedCustomerId}
            setSelectedContractId={setSelectedContractId}
          />
        ) : null}

        {active === "billing" ? (
          <BillingModule
            bills={bills}
            disabledReason={actionBlockReason("bill.manage")}
            runBilling={runBilling}
            selectedBillId={selectedBillId}
            setSelectedBillId={setSelectedBillId}
            transitionBill={transitionBill}
          />
        ) : null}

        {active === "receivables" ? (
          <ReceivablesModule
            bills={bills}
            createInvoice={createInvoice}
            createReceipt={createReceipt}
            invoices={invoices}
            receipts={receipts}
            selectedBill={selectedBill}
            selectedBillId={selectedBillId}
            setSelectedBillId={setSelectedBillId}
          />
        ) : null}

        {active === "costs" ? (
          <CostsModule
            costEntries={costEntries}
            createCostEntry={createCostEntry}
            createPaymentRequest={createPaymentRequest}
            customers={customers}
            payables={payables}
            paymentRequests={paymentRequests}
            payments={payments}
            selectedCustomerId={selectedCustomerId}
            setSelectedCustomerId={setSelectedCustomerId}
          />
        ) : null}

        {active === "closing" ? (
          <ClosingModule
            closePeriod={closePeriod}
            periodMonth={periodMonth}
            profits={profits}
            reopenPeriod={() =>
              void submitAction("解锁账期", ["period.reopen"], () =>
                request(`/periods/${periodMonth}/reopen`, {
                  method: "POST",
                  body: JSON.stringify({ reason: "管理员解锁" }),
                }),
              )
            }
          />
        ) : null}
      </main>
    </div>
  );
}

function DashboardModule({
  bills,
  metrics,
  pendingTasks,
  profits,
  setActive,
}: {
  bills: Bill[];
  metrics: Array<{ label: string; value: string }>;
  pendingTasks: Array<{ label: string; value: number }>;
  profits: ProfitRow[];
  setActive: (module: ModuleId) => void;
}) {
  return (
    <section className="workspace dashboard-layout">
      <div className="metric-grid" aria-label="关键指标">
        {metrics.map((metric) => (
          <div className="metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>本月待办</h2>
          <span>按业务顺序处理</span>
        </div>
        <div className="task-list">
          {pendingTasks.map((task) => (
            <button
              className="task-row"
              key={task.label}
              onClick={() =>
                task.label.includes("付款")
                  ? setActive("costs")
                  : task.label.includes("客户确认")
                    ? setActive("billing")
                    : setActive("receivables")
              }
              type="button"
            >
              <span>{task.label}</span>
              <strong>{task.value}</strong>
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>标准月结流程</h2>
          <span>从客户到利润</span>
        </div>
        <ol className="flow-list">
          <li>维护客户、合同和收费项</li>
          <li>录入增值服务、代垫费用和成本</li>
          <li>生成账单，完成内部审核、财务审核、客户确认</li>
          <li>登记发票、收款、成本、应付和付款申请</li>
          <li>完成付款、关闭账期，查看客户利润</li>
        </ol>
      </div>

      <TablePanel title="最近账单" count={`${bills.length} 条`}>
        <BillsTable bills={bills.slice(0, 6)} onSelect={() => undefined} />
      </TablePanel>

      <ProfitTable profits={profits} />
    </section>
  );
}

function ActivationModule({
  apiBase,
  demoMode,
}: {
  apiBase: string;
  demoMode: boolean;
}) {
  return (
    <section className="workspace two-column">
      <div className="panel">
        <div className="panel-header">
          <h2>正式启用清单</h2>
          <span>{demoMode ? "当前仍是预览" : "连接目标 API"}</span>
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
            <strong>{demoMode ? "静态预览" : "正式入口"}</strong>
          </div>
          <div>
            <span>生产状态</span>
            <strong>
              {demoMode ? "等待连接正式后端" : "已连接 Web/API/Worker/数据库"}
            </strong>
          </div>
        </div>
      </div>
    </section>
  );
}

function IdentityModule({
  auditLogs,
  createConsoleUser,
  disabledReason,
  newUserEmail,
  newUserName,
  newUserPassword,
  newUserRoleCode,
  roles,
  setNewUserEmail,
  setNewUserName,
  setNewUserPassword,
  setNewUserRoleCode,
  users,
}: {
  auditLogs: AuditLog[];
  createConsoleUser: (event: FormEvent<HTMLFormElement>) => void;
  disabledReason: string;
  newUserEmail: string;
  newUserName: string;
  newUserPassword: string;
  newUserRoleCode: string;
  roles: Role[];
  setNewUserEmail: (value: string) => void;
  setNewUserName: (value: string) => void;
  setNewUserPassword: (value: string) => void;
  setNewUserRoleCode: (value: string) => void;
  users: ConsoleUser[];
}) {
  return (
    <section className="workspace two-column">
      <div className="panel">
        <div className="panel-header">
          <h2>新建内部用户</h2>
          <span>正式启用必做</span>
        </div>
        <form className="module-form" onSubmit={createConsoleUser}>
          <label>
            邮箱
            <input
              onChange={(event) => setNewUserEmail(event.target.value)}
              value={newUserEmail}
            />
          </label>
          <label>
            姓名
            <input
              onChange={(event) => setNewUserName(event.target.value)}
              value={newUserName}
            />
          </label>
          <label>
            初始密码
            <input
              onChange={(event) => setNewUserPassword(event.target.value)}
              type="password"
              value={newUserPassword}
            />
          </label>
          <label>
            角色
            <select
              onChange={(event) => setNewUserRoleCode(event.target.value)}
              value={newUserRoleCode}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.code}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          {disabledReason ? (
            <small className="form-note">{disabledReason}</small>
          ) : null}
          <button
            className="primary"
            disabled={Boolean(disabledReason)}
            type="submit"
          >
            创建用户
          </button>
        </form>
      </div>

      <TablePanel title="内部用户" count={`${users.length} 个`}>
        <table>
          <thead>
            <tr>
              <th>姓名</th>
              <th>邮箱</th>
              <th>角色</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {users.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.email}</td>
                <td>{item.roles.map((role) => role.name).join("、")}</td>
                <td>
                  <span className="status">
                    {item.isActive ? "启用" : "停用"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablePanel>

      <TablePanel title="角色权限" count={`${roles.length} 个角色`}>
        <table>
          <thead>
            <tr>
              <th>角色</th>
              <th>编码</th>
              <th>权限</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id}>
                <td>{role.name}</td>
                <td>{role.code}</td>
                <td className="wrap-cell">
                  {role.permissions
                    ?.map((item) => item.permission.name)
                    .join("、") ?? "-"}
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
  createCustomer,
  customerCode,
  customerName,
  customers,
  disabledReason,
  selectedCustomerId,
  setCustomerCode,
  setCustomerName,
  setSelectedCustomerId,
}: {
  createCustomer: (event: FormEvent<HTMLFormElement>) => void;
  customerCode: string;
  customerName: string;
  customers: Customer[];
  disabledReason: string;
  selectedCustomerId: string;
  setCustomerCode: (value: string) => void;
  setCustomerName: (value: string) => void;
  setSelectedCustomerId: (value: string) => void;
}) {
  return (
    <section className="workspace two-column">
      <div className="panel">
        <div className="panel-header">
          <h2>新建客户</h2>
          <span>档案入口</span>
        </div>
        <form className="module-form" onSubmit={createCustomer}>
          <label>
            客户编码
            <input
              onChange={(event) => setCustomerCode(event.target.value)}
              value={customerCode}
            />
          </label>
          <label>
            客户名称
            <input
              onChange={(event) => setCustomerName(event.target.value)}
              value={customerName}
            />
          </label>
          {disabledReason ? (
            <small className="form-note">{disabledReason}</small>
          ) : null}
          <button
            className="primary"
            disabled={Boolean(disabledReason)}
            type="submit"
          >
            创建客户
          </button>
        </form>
      </div>

      <TablePanel title="客户列表" count={`${customers.length} 个`}>
        <table>
          <thead>
            <tr>
              <th>编码</th>
              <th>客户</th>
              <th>状态</th>
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
                <td>
                  <span className="status">{customer.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablePanel>
    </section>
  );
}

function ContractsModule({
  contractCode,
  contractFee,
  contracts,
  createContract,
  customers,
  disabledReason,
  selectedCustomerId,
  selectedContractId,
  setContractCode,
  setContractFee,
  setSelectedCustomerId,
  setSelectedContractId,
}: {
  contractCode: string;
  contractFee: string;
  contracts: Contract[];
  createContract: (event: FormEvent<HTMLFormElement>) => void;
  customers: Customer[];
  disabledReason: string;
  selectedCustomerId: string;
  selectedContractId: string;
  setContractCode: (value: string) => void;
  setContractFee: (value: string) => void;
  setSelectedCustomerId: (value: string) => void;
  setSelectedContractId: (value: string) => void;
}) {
  return (
    <section className="workspace two-column">
      <div className="panel">
        <div className="panel-header">
          <h2>新建合同</h2>
          <span>收费规则</span>
        </div>
        <form className="module-form" onSubmit={createContract}>
          <label>
            客户
            <select
              onChange={(event) => setSelectedCustomerId(event.target.value)}
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
            合同编码
            <input
              onChange={(event) => setContractCode(event.target.value)}
              value={contractCode}
            />
          </label>
          <label>
            基础月费
            <input
              onChange={(event) => setContractFee(event.target.value)}
              value={contractFee}
            />
          </label>
          {disabledReason ? (
            <small className="form-note">{disabledReason}</small>
          ) : null}
          <button
            className="primary"
            disabled={Boolean(disabledReason)}
            type="submit"
          >
            创建合同
          </button>
        </form>
      </div>

      <TablePanel title="合同列表" count={`${contracts.length} 份`}>
        <table>
          <thead>
            <tr>
              <th>合同号</th>
              <th>合同</th>
              <th>客户</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract) => (
              <tr
                data-selected={selectedContractId === contract.id}
                key={contract.id}
                onClick={() => setSelectedContractId(contract.id)}
              >
                <td>{contract.code}</td>
                <td>{contract.name}</td>
                <td>{contract.customer?.name ?? "-"}</td>
                <td>
                  <span className="status">{contract.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablePanel>
    </section>
  );
}

function BillingModule({
  bills,
  disabledReason,
  runBilling,
  selectedBillId,
  setSelectedBillId,
  transitionBill,
}: {
  bills: Bill[];
  disabledReason: string;
  runBilling: () => void;
  selectedBillId: string;
  setSelectedBillId: (value: string) => void;
  transitionBill: (path: string, label: string, body?: object) => void;
}) {
  return (
    <section className="workspace">
      <div className="panel">
        <div className="panel-header">
          <h2>账单流转</h2>
          <span>生成到确认</span>
        </div>
        <div className="action-strip">
          <button
            className="primary"
            disabled={Boolean(disabledReason)}
            onClick={runBilling}
            type="button"
          >
            生成本月账单
          </button>
          <button
            disabled={Boolean(disabledReason)}
            onClick={() => transitionBill("submit", "提交内部审核")}
            type="button"
          >
            提交内部审核
          </button>
          <button
            disabled={Boolean(disabledReason)}
            onClick={() => transitionBill("finance-review", "提交财务审核")}
            type="button"
          >
            财务审核
          </button>
          <button
            disabled={Boolean(disabledReason)}
            onClick={() => transitionBill("send-to-customer", "发送客户确认")}
            type="button"
          >
            发给客户
          </button>
          <button
            disabled={Boolean(disabledReason)}
            onClick={() =>
              transitionBill("confirm-customer", "客户确认", {
                confirmedByName: "客户联系人",
              })
            }
            type="button"
          >
            客户确认
          </button>
          {disabledReason ? (
            <small className="form-note">{disabledReason}</small>
          ) : null}
        </div>
      </div>

      <TablePanel title="账单列表" count={`${bills.length} 条`}>
        <BillsTable
          bills={bills}
          onSelect={setSelectedBillId}
          selectedBillId={selectedBillId}
        />
      </TablePanel>
    </section>
  );
}

function ReceivablesModule({
  bills,
  createInvoice,
  createReceipt,
  invoices,
  receipts,
  selectedBill,
  selectedBillId,
  setSelectedBillId,
}: {
  bills: Bill[];
  createInvoice: (event: FormEvent<HTMLFormElement>) => void;
  createReceipt: () => void;
  invoices: Invoice[];
  receipts: Receipt[];
  selectedBill?: Bill;
  selectedBillId: string;
  setSelectedBillId: (value: string) => void;
}) {
  return (
    <section className="workspace two-column">
      <div className="panel">
        <div className="panel-header">
          <h2>开票收款</h2>
          <span>{selectedBill?.billNo ?? "未选择账单"}</span>
        </div>
        <form className="module-form" onSubmit={createInvoice}>
          <label>
            账单
            <select
              onChange={(event) => setSelectedBillId(event.target.value)}
              value={selectedBillId}
            >
              <option value="">选择账单</option>
              {bills.map((bill) => (
                <option key={bill.id} value={bill.id}>
                  {bill.billNo}
                </option>
              ))}
            </select>
          </label>
          <div className="definition-list compact">
            <div>
              <span>账单金额</span>
              <strong>{money(selectedBill?.totalAmount)}</strong>
            </div>
            <div>
              <span>已开票</span>
              <strong>{money(selectedBill?.invoiceAmount)}</strong>
            </div>
            <div>
              <span>已收款</span>
              <strong>{money(selectedBill?.receiptAmount)}</strong>
            </div>
          </div>
          <button className="primary" type="submit">
            按账单全额开票
          </button>
          <button onClick={createReceipt} type="button">
            按账单全额收款
          </button>
        </form>
      </div>

      <TablePanel title="发票记录" count={`${invoices.length} 张`}>
        <table>
          <thead>
            <tr>
              <th>发票号</th>
              <th>日期</th>
              <th>金额</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td>{invoice.invoiceNo}</td>
                <td>{dateText(invoice.issueDate)}</td>
                <td>{money(invoice.amount)}</td>
                <td>
                  <span className="status">{invoice.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablePanel>

      <TablePanel title="收款记录" count={`${receipts.length} 笔`}>
        <table>
          <thead>
            <tr>
              <th>收款号</th>
              <th>日期</th>
              <th>金额</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((receipt) => (
              <tr key={receipt.id}>
                <td>{receipt.receiptNo ?? "-"}</td>
                <td>{dateText(receipt.receivedAt)}</td>
                <td>{money(receipt.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablePanel>
    </section>
  );
}

function CostsModule({
  costEntries,
  createCostEntry,
  createPaymentRequest,
  customers,
  payables,
  paymentRequests,
  payments,
  selectedCustomerId,
  setSelectedCustomerId,
}: {
  costEntries: CostEntry[];
  createCostEntry: () => void;
  createPaymentRequest: (event: FormEvent<HTMLFormElement>) => void;
  customers: Customer[];
  payables: Payable[];
  paymentRequests: PaymentRequest[];
  payments: Payment[];
  selectedCustomerId: string;
  setSelectedCustomerId: (value: string) => void;
}) {
  return (
    <section className="workspace two-column">
      <div className="panel">
        <div className="panel-header">
          <h2>成本与付款动作</h2>
          <span>从成本到付款申请</span>
        </div>
        <form className="module-form" onSubmit={createPaymentRequest}>
          <label>
            关联客户
            <select
              onChange={(event) => setSelectedCustomerId(event.target.value)}
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
          <button onClick={createCostEntry} type="button">
            登记成本并生成应付
          </button>
          <button className="primary" type="submit">
            发起付款申请
          </button>
        </form>
      </div>

      <TablePanel title="成本记录" count={`${costEntries.length} 条`}>
        <table>
          <thead>
            <tr>
              <th>客户</th>
              <th>账期</th>
              <th>说明</th>
              <th>金额</th>
            </tr>
          </thead>
          <tbody>
            {costEntries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.customer?.name ?? "-"}</td>
                <td>{entry.periodMonth ?? "-"}</td>
                <td>{entry.description ?? "-"}</td>
                <td>{money(entry.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablePanel>

      <TablePanel title="应付" count={`${payables.length} 条`}>
        <table>
          <thead>
            <tr>
              <th>供应商</th>
              <th>客户</th>
              <th>金额</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {payables.map((payable) => (
              <tr key={payable.id}>
                <td>{payable.vendorName}</td>
                <td>{payable.customer?.name ?? "-"}</td>
                <td>{money(payable.amount)}</td>
                <td>
                  <span className="status">{payable.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablePanel>

      <TablePanel title="付款申请" count={`${paymentRequests.length} 条`}>
        <table>
          <thead>
            <tr>
              <th>申请号</th>
              <th>供应商</th>
              <th>金额</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {paymentRequests.map((request) => (
              <tr key={request.id}>
                <td>{request.requestNo}</td>
                <td>{request.supplierName}</td>
                <td>{money(request.requestedAmount)}</td>
                <td>
                  <span className="status">{request.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablePanel>

      <TablePanel title="付款记录" count={`${payments.length} 笔`}>
        <table>
          <thead>
            <tr>
              <th>付款号</th>
              <th>收款方</th>
              <th>日期</th>
              <th>金额</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td>{payment.paymentNo}</td>
                <td>{payment.payeeName}</td>
                <td>{dateText(payment.paidAt)}</td>
                <td>{money(payment.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablePanel>
    </section>
  );
}

function ClosingModule({
  closePeriod,
  periodMonth,
  profits,
  reopenPeriod,
}: {
  closePeriod: (event: FormEvent<HTMLFormElement>) => void;
  periodMonth: string;
  profits: ProfitRow[];
  reopenPeriod: () => void;
}) {
  return (
    <section className="workspace two-column">
      <div className="panel">
        <div className="panel-header">
          <h2>账期控制</h2>
          <span>{periodMonth}</span>
        </div>
        <form className="module-form" onSubmit={closePeriod}>
          <p className="helper-text">
            关闭账期后，该月账单、成本、开票、收款和付款会进入锁定状态。
          </p>
          <button className="primary" type="submit">
            关闭当前账期
          </button>
          <button onClick={reopenPeriod} type="button">
            管理员解锁
          </button>
        </form>
      </div>

      <ProfitTable profits={profits} />
    </section>
  );
}

function BillsTable({
  bills,
  onSelect,
  selectedBillId,
}: {
  bills: Bill[];
  onSelect: (id: string) => void;
  selectedBillId?: string;
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>账单号</th>
          <th>客户</th>
          <th>状态</th>
          <th>金额</th>
          <th>已开票</th>
          <th>已收</th>
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
            <td>{bill.customer?.name ?? "-"}</td>
            <td>
              <span className="status">{billStatus(bill.status)}</span>
            </td>
            <td>{money(bill.totalAmount)}</td>
            <td>{money(bill.invoiceAmount)}</td>
            <td>{money(bill.receiptAmount)}</td>
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
  children,
  count,
  title,
}: {
  children: React.ReactNode;
  count: string;
  title: string;
}) {
  return (
    <div className="panel table-panel">
      <div className="panel-header">
        <h2>{title}</h2>
        <span>{count}</span>
      </div>
      {children}
    </div>
  );
}
