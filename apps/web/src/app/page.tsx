"use client";

import { FormEvent, useMemo, useState } from "react";

type ApiUser = {
  email: string;
  name: string;
  permissions: string[];
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

type ProfitRow = {
  customerName: string;
  incomeAmount: string;
  costAmount: string;
  profitAmount: string;
  grossMargin: string | null;
};

type PaymentRequest = {
  id: string;
  requestNo: string;
  status: string;
  supplierName: string;
  requestedAmount: string;
};

type ConsoleData = {
  customers: Customer[];
  contracts: Contract[];
  bills: Bill[];
  profits: ProfitRow[];
  paymentRequests: PaymentRequest[];
};

const demoToken = "demo-token";

const demoUser: ApiUser = {
  email: "demo@erpdog.local",
  name: "Demo Admin",
  permissions: ["demo"]
};

const apiBase =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:4000/api/v1";

const navItems = [
  "总览",
  "客户",
  "合同",
  "账单",
  "发票收款",
  "成本付款",
  "锁账报表"
];

function money(value: string | number | undefined) {
  return `¥${Number(value ?? 0).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function createDemoData(periodMonth: string): ConsoleData {
  const customerA: Customer = {
    id: "demo-customer-qingliu",
    code: "CUST-001",
    name: "上海清流派科技有限公司",
    status: "ACTIVE"
  };
  const customerB: Customer = {
    id: "demo-customer-yunhe",
    code: "CUST-002",
    name: "杭州云河供应链有限公司",
    status: "ACTIVE"
  };
  const contractA: Contract = {
    id: "demo-contract-qingliu",
    code: "CTR-001",
    name: "清流派月度运营服务合同",
    status: "ACTIVE",
    customer: customerA
  };
  const contractB: Contract = {
    id: "demo-contract-yunhe",
    code: "CTR-002",
    name: "云河供应链财务外包服务",
    status: "ACTIVE",
    customer: customerB
  };

  return {
    customers: [customerA, customerB],
    contracts: [contractA, contractB],
    bills: [
      {
        id: "demo-bill-qingliu",
        billNo: `BILL-${periodMonth}-DEMO-CTR-001`,
        periodMonth,
        status: "CUSTOMER_CONFIRMED",
        totalAmount: "18200.00",
        invoiceAmount: "0.00",
        receiptAmount: "10000.00",
        customer: customerA
      },
      {
        id: "demo-bill-yunhe",
        billNo: `BILL-${periodMonth}-DEMO-CTR-002`,
        periodMonth,
        status: "GENERATED",
        totalAmount: "12600.00",
        invoiceAmount: "12600.00",
        receiptAmount: "12600.00",
        customer: customerB
      }
    ],
    profits: [
      {
        customerName: customerA.name,
        incomeAmount: "18200.00",
        costAmount: "4600.00",
        profitAmount: "13600.00",
        grossMargin: "74.73%"
      },
      {
        customerName: customerB.name,
        incomeAmount: "12600.00",
        costAmount: "3900.00",
        profitAmount: "8700.00",
        grossMargin: "69.05%"
      }
    ],
    paymentRequests: [
      {
        id: "demo-payment-request-ops",
        requestNo: `PR-${periodMonth}-DEMO-001`,
        status: "SUBMITTED",
        supplierName: "上海砺行服务有限公司",
        requestedAmount: "4600.00"
      }
    ]
  };
}

export default function Home() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<ApiUser | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [message, setMessage] = useState("等待登录");
  const [active, setActive] = useState(navItems[0]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [profits, setProfits] = useState<ProfitRow[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [email, setEmail] = useState("admin@erpdog.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [periodMonth, setPeriodMonth] = useState("2026-04");
  const [customerCode, setCustomerCode] = useState("CUST-001");
  const [customerName, setCustomerName] = useState("示例客户");
  const [contractCode, setContractCode] = useState("CTR-001");
  const [contractFee, setContractFee] = useState("10000.00");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedContractId, setSelectedContractId] = useState("");
  const [selectedBillId, setSelectedBillId] = useState("");

  const metrics = useMemo(() => {
    const receivable = bills.reduce(
      (total, bill) =>
        total + Number(bill.totalAmount ?? 0) - Number(bill.receiptAmount ?? 0),
      0
    );
    const uninvoiced = bills.reduce(
      (total, bill) =>
        total + Number(bill.totalAmount ?? 0) - Number(bill.invoiceAmount ?? 0),
      0
    );
    const profit = profits.reduce(
      (total, row) => total + Number(row.profitAmount ?? 0),
      0
    );

    return [
      { label: "客户数", value: customers.length.toString() },
      { label: "合同数", value: contracts.length.toString() },
      { label: "未收金额", value: money(receivable) },
      { label: "未开票金额", value: money(uninvoiced) },
      { label: "付款申请", value: paymentRequests.length.toString() },
      { label: "毛利", value: money(profit) }
    ];
  }, [bills, contracts.length, customers.length, paymentRequests.length, profits]);

  function applyConsoleData(data: ConsoleData) {
    setCustomers(data.customers);
    setContracts(data.contracts);
    setBills(data.bills);
    setProfits(data.profits);
    setPaymentRequests(data.paymentRequests);
    setSelectedCustomerId((current) =>
      data.customers.some((customer) => customer.id === current)
        ? current
        : data.customers[0]?.id ?? ""
    );
    setSelectedContractId((current) =>
      data.contracts.some((contract) => contract.id === current)
        ? current
        : data.contracts[0]?.id ?? ""
    );
    setSelectedBillId((current) =>
      data.bills.some((bill) => bill.id === current)
        ? current
        : data.bills[0]?.id ?? ""
    );
  }

  function enterDemoMode(nextPeriodMonth = periodMonth) {
    setDemoMode(true);
    setToken(demoToken);
    setUser(demoUser);
    applyConsoleData(createDemoData(nextPeriodMonth));
    setMessage("演示模式：无需后端，数据保存在当前页面");
  }

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    if (demoMode) {
      throw new Error("演示模式不会调用后端接口");
    }

    const response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || response.statusText);
    }

    return (await response.json()) as T;
  }

  async function refresh(nextToken = token) {
    if (demoMode || nextToken === demoToken) {
      enterDemoMode(periodMonth);
      return;
    }

    if (!nextToken) {
      return;
    }

    const authHeader = { Authorization: `Bearer ${nextToken}` };
    const fetchJson = async <TValue,>(path: string): Promise<TValue> => {
      const response = await fetch(`${apiBase}${path}`, { headers: authHeader });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
      }

      return (await response.json()) as TValue;
    };
    const [nextCustomers, nextContracts, nextBills, nextProfits, nextRequests] =
      await Promise.all([
        fetchJson<Customer[]>("/customers"),
        fetchJson<Contract[]>("/contracts"),
        fetchJson<Bill[]>(`/bills?periodMonth=${periodMonth}`),
        fetchJson<ProfitRow[]>(
          `/reports/customer-profit?periodMonth=${periodMonth}`
        ),
        fetchJson<PaymentRequest[]>("/payment-requests")
      ]);

    applyConsoleData({
      customers: nextCustomers,
      contracts: nextContracts,
      bills: nextBills,
      profits: nextProfits,
      paymentRequests: nextRequests
    });
    setMessage("数据已刷新");
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const result = await request<{
        accessToken: string;
        user: ApiUser;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setDemoMode(false);
      setToken(result.accessToken);
      setUser(result.user);
      setMessage(`已登录：${result.user.name}`);
      await refresh(result.accessToken);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `登录失败：${error.message}`
          : "登录失败，请检查后端服务"
      );
    }
  }

  async function submitAction(
    label: string,
    action: () => Promise<unknown>
  ) {
    try {
      setMessage(`${label}处理中`);
      if (demoMode) {
        setMessage(`${label}已在演示模式模拟完成`);
        return;
      }

      await action();
      await refresh();
      setMessage(`${label}完成`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${label}失败`);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>erpdog</strong>
          <span>服务型业务 ERP</span>
        </div>
        <nav className="nav" aria-label="主导航">
          {navItems.map((item) => (
            <button
              data-active={active === item}
              key={item}
              onClick={() => setActive(item)}
              type="button"
            >
              {item}
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
            <h1>财务业务控制台</h1>
            <p>
              {active} · {periodMonth}
              {demoMode ? " · Demo" : ""}
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
                    error instanceof Error ? error.message : "刷新失败"
                  )
                )
              }
              type="button"
            >
              刷新
            </button>
          </div>
        </header>

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
                  type="password"
                  value={password}
                />
              </label>
              <button className="primary" type="submit">
                登录
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

        <section className="metric-grid" aria-label="关键指标">
          {metrics.map((metric) => (
            <div className="metric" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </section>

        <section className="workspace">
          <div className="panel">
            <div className="panel-header">
              <h2>业务动作</h2>
              <span>{active}</span>
            </div>
            <div className="form-grid">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitAction("创建客户", () =>
                    request("/customers", {
                      method: "POST",
                      body: JSON.stringify({
                        code: customerCode,
                        name: customerName,
                        status: "ACTIVE"
                      })
                    })
                  );
                }}
              >
                <h3>客户</h3>
                <input
                  aria-label="客户编码"
                  onChange={(event) => setCustomerCode(event.target.value)}
                  value={customerCode}
                />
                <input
                  aria-label="客户名称"
                  onChange={(event) => setCustomerName(event.target.value)}
                  value={customerName}
                />
                <button type="submit">新建客户</button>
              </form>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitAction("创建合同", () =>
                    request("/contracts", {
                      method: "POST",
                      body: JSON.stringify({
                        customerId: selectedCustomerId,
                        code: contractCode,
                        name: `${customerName} 服务合同`,
                        status: "ACTIVE",
                        startDate: `${periodMonth}-01`,
                        chargeItems: [
                          {
                            name: "基础服务费",
                            kind: "FIXED",
                            amount: contractFee
                          }
                        ]
                      })
                    })
                  );
                }}
              >
                <h3>合同</h3>
                <select
                  aria-label="客户"
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
                <input
                  aria-label="合同编码"
                  onChange={(event) => setContractCode(event.target.value)}
                  value={contractCode}
                />
                <input
                  aria-label="月费"
                  onChange={(event) => setContractFee(event.target.value)}
                  value={contractFee}
                />
                <button type="submit">新建合同</button>
              </form>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitAction("生成账单", () =>
                    request("/billing-runs", {
                      method: "POST",
                      body: JSON.stringify({ periodMonth })
                    })
                  );
                }}
              >
                <h3>账单</h3>
                <select
                  aria-label="合同"
                  onChange={(event) => setSelectedContractId(event.target.value)}
                  value={selectedContractId}
                >
                  <option value="">选择合同</option>
                  {contracts.map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      {contract.code}
                    </option>
                  ))}
                </select>
                <button type="submit">按合同生成账单</button>
                <button
                  onClick={() =>
                    selectedBillId &&
                    void submitAction("客户确认", () =>
                      request(`/bills/${selectedBillId}/confirm-customer`, {
                        method: "POST",
                        body: JSON.stringify({ confirmedByName: user?.name })
                      })
                    )
                  }
                  type="button"
                >
                  确认选中账单
                </button>
              </form>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitAction("登记发票", () =>
                    request("/invoices", {
                      method: "POST",
                      body: JSON.stringify({
                        invoiceNo: `INV-${Date.now().toString(36).toUpperCase()}`,
                        invoiceType: "增值税普通发票",
                        issueDate: new Date().toISOString(),
                        amount: bills.find((bill) => bill.id === selectedBillId)
                          ?.totalAmount,
                        allocations: [
                          {
                            billId: selectedBillId,
                            amount: bills.find((bill) => bill.id === selectedBillId)
                              ?.totalAmount
                          }
                        ]
                      })
                    })
                  );
                }}
              >
                <h3>发票 / 收款</h3>
                <select
                  aria-label="账单"
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
                <button type="submit">登记发票</button>
                <button
                  onClick={() =>
                    selectedBillId &&
                    void submitAction("登记收款", () =>
                      request("/receipts", {
                        method: "POST",
                        body: JSON.stringify({
                          receivedAt: new Date().toISOString(),
                          amount: bills.find((bill) => bill.id === selectedBillId)
                            ?.totalAmount,
                          account: "默认收款账户",
                          allocations: [
                            {
                              billId: selectedBillId,
                              amount: bills.find(
                                (bill) => bill.id === selectedBillId
                              )?.totalAmount
                            }
                          ]
                        })
                      })
                    )
                  }
                  type="button"
                >
                  登记收款
                </button>
              </form>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitAction("发起付款申请", () =>
                    request("/payment-requests", {
                      method: "POST",
                      body: JSON.stringify({
                        supplierName: "示例供应商",
                        customerId: selectedCustomerId,
                        periodMonth,
                        requestedAmount: "1000.00",
                        reason: "服务成本付款",
                        items: [
                          {
                            customerId: selectedCustomerId,
                            periodMonth,
                            amount: "1000.00",
                            description: "服务成本"
                          }
                        ]
                      })
                    })
                  );
                }}
              >
                <h3>成本 / 付款</h3>
                <button
                  onClick={() =>
                    selectedCustomerId &&
                    void submitAction("登记成本", () =>
                      request("/cost-entries", {
                        method: "POST",
                        body: JSON.stringify({
                          customerId: selectedCustomerId,
                          periodMonth,
                          amount: "1000.00",
                          incurredDate: new Date().toISOString(),
                          description: "服务成本",
                          createPayable: true,
                          vendorName: "示例供应商"
                        })
                      })
                    )
                  }
                  type="button"
                >
                  登记成本
                </button>
                <button type="submit">发起付款申请</button>
              </form>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitAction("月度结账", () =>
                    request(`/periods/${periodMonth}/close`, {
                      method: "POST",
                      body: JSON.stringify({ reason: "月度结账" })
                    })
                  );
                }}
              >
                <h3>锁账</h3>
                <button type="submit">关闭账期</button>
                <button
                  onClick={() =>
                    void submitAction("解锁账期", () =>
                      request(`/periods/${periodMonth}/reopen`, {
                        method: "POST",
                        body: JSON.stringify({ reason: "管理员解锁" })
                      })
                    )
                  }
                  type="button"
                >
                  解锁账期
                </button>
              </form>
            </div>
          </div>

          <div className="panel table-panel">
            <div className="panel-header">
              <h2>账单</h2>
              <span>{bills.length} 条</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>账单号</th>
                  <th>客户</th>
                  <th>状态</th>
                  <th>金额</th>
                  <th>已收</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => (
                  <tr
                    data-selected={selectedBillId === bill.id}
                    key={bill.id}
                    onClick={() => setSelectedBillId(bill.id)}
                  >
                    <td>{bill.billNo}</td>
                    <td>{bill.customer?.name}</td>
                    <td>
                      <span className="status">{bill.status}</span>
                    </td>
                    <td>{money(bill.totalAmount)}</td>
                    <td>{money(bill.receiptAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="panel table-panel">
            <div className="panel-header">
              <h2>利润</h2>
              <span>{profits.length} 个客户</span>
            </div>
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
          </div>
        </section>
      </main>
    </div>
  );
}
