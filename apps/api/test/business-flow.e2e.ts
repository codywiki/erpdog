import { ValidationPipe } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { AddressInfo } from "node:net";
import writeXlsxFile, { type SheetData } from "write-excel-file/node";

import { PERMISSION_CODES, ROLE_CODES } from "@erpdog/contracts";

type ApiClient = {
  baseUrl: string;
  token?: string;
};

type E2EIdentity = {
  email: string;
  password: string;
};

function configureEnv() {
  process.env.NODE_ENV ??= "test";
  process.env.APP_URL ??= "http://localhost:3000";
  process.env.API_URL ??= "http://localhost:4000";
  process.env.JWT_SECRET ??= "business-e2e-secret-with-at-least-24-chars";
  process.env.REDIS_URL ??= "redis://localhost:6379";

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run business e2e tests.");
  }
}

async function seedIdentity(prisma: PrismaClient): Promise<E2EIdentity> {
  const runId = Date.now().toString(36);
  const org = await prisma.organization.create({
    data: {
      code: `e2e-${runId}`,
      name: `E2E ${runId}`,
    },
  });

  for (const code of Object.values(PERMISSION_CODES)) {
    await prisma.permission.upsert({
      where: { code },
      update: { name: code },
      create: { code, name: code },
    });
  }

  const role = await prisma.role.create({
    data: {
      orgId: org.id,
      code: ROLE_CODES.ADMIN,
      name: "E2E Admin",
      isSystem: true,
    },
  });
  const permissions = await prisma.permission.findMany({
    where: { code: { in: Object.values(PERMISSION_CODES) } },
  });
  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({
      roleId: role.id,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });

  const password = `E2E-${runId}-Pass!`;
  const user = await prisma.user.create({
    data: {
      orgId: org.id,
      email: `e2e-${runId}@erpdog.local`,
      name: "E2E Admin",
      passwordHash: await bcrypt.hash(password, 12),
      isActive: true,
    },
  });
  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: role.id,
    },
  });

  return {
    email: user.email,
    password,
  };
}

async function request<T>(
  client: ApiClient,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    auth?: boolean;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.auth !== false && client.token) {
    headers.Authorization = `Bearer ${client.token}`;
  }

  const response = await fetch(`${client.baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      `${options.method ?? "GET"} ${path} failed with ${response.status}: ${text}`,
    );
  }

  return body as T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function workbookBase64(
  sheetName: string,
  headers: string[],
  rows: Array<Record<string, unknown>>,
) {
  const data: SheetData = [
    headers,
    ...rows.map((row) => headers.map((header) => row[header] ?? null)),
  ];
  const output = await writeXlsxFile([
    {
      sheet: sheetName,
      data,
      stickyRowsCount: 1,
    },
  ]).toBuffer();
  const buffer = Buffer.isBuffer(output) ? output : Buffer.from(output);
  return buffer.toString("base64");
}

async function main() {
  configureEnv();
  const prisma = new PrismaClient();
  let identity: E2EIdentity;
  try {
    identity = await seedIdentity(prisma);
  } finally {
    await prisma.$disconnect();
  }

  const { NestFactory } = await import("@nestjs/core");
  const { AppModule } = await import("../src/app.module");
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(0, "127.0.0.1");

  const address = app.getHttpServer().address() as AddressInfo;
  const client: ApiClient = {
    baseUrl: `http://127.0.0.1:${address.port}/api/v1`,
  };

  try {
    const login = await request<{ accessToken: string }>(
      client,
      "/auth/login",
      {
        method: "POST",
        auth: false,
        body: {
          email: identity.email,
          password: identity.password,
        },
      },
    );
    client.token = login.accessToken;

    const runId = Date.now().toString(36);
    const customerCode = `E2E-CUST-${runId}`;
    const contractCode = `E2E-CON-${runId}`;
    const periodMonth = "2026-02";

    await request(client, "/customers/import-template");
    const customerImport = await request<{
      succeeded: number;
      results: Array<{ id?: string; error?: string }>;
    }>(client, "/customers/import-xlsx", {
      method: "POST",
      body: {
        contentBase64: await workbookBase64(
          "客户导入",
          [
            "客户编码",
            "客户名称",
            "状态",
            "负责人邮箱",
            "联系人姓名",
            "开票抬头",
          ],
          [
            {
              客户编码: customerCode,
              客户名称: "E2E 客户",
              状态: "ACTIVE",
              负责人邮箱: identity.email,
              联系人姓名: "E2E 联系人",
              开票抬头: "E2E 客户",
            },
          ],
        ),
      },
    });
    assert(customerImport.succeeded === 1, "Customer Excel import failed.");
    const customerId = customerImport.results[0]?.id;
    assert(customerId, "Imported customer id missing.");

    await request(client, "/contracts/import-template");
    const contractImport = await request<{
      succeeded: number;
      results: Array<{ id?: string; error?: string }>;
    }>(client, "/contracts/import-xlsx", {
      method: "POST",
      body: {
        contentBase64: await workbookBase64(
          "合同导入",
          [
            "合同编码",
            "合同名称",
            "客户编码",
            "状态",
            "开始日期",
            "账期日",
            "币种",
            "收费项名称",
            "收费类型",
            "金额",
            "数量",
          ],
          [
            {
              合同编码: contractCode,
              合同名称: "E2E 服务合同",
              客户编码: customerCode,
              状态: "ACTIVE",
              开始日期: "2026-01-01",
              账期日: 1,
              币种: "CNY",
              收费项名称: "基础服务费",
              收费类型: "FIXED",
              金额: "1000.00",
              数量: "1",
            },
          ],
        ),
      },
    });
    assert(contractImport.succeeded === 1, "Contract Excel import failed.");
    const contractId = contractImport.results[0]?.id;
    assert(contractId, "Imported contract id missing.");

    const extraCharge = await request<{ id: string }>(
      client,
      "/extra-charges",
      {
        method: "POST",
        body: {
          customerId,
          contractId,
          kind: "VALUE_ADDED",
          name: "增值服务",
          amount: "200.00",
          incurredDate: "2026-02-05",
          periodMonth,
        },
      },
    );
    assert(extraCharge.id, "Extra charge was not created.");

    if (
      process.env.S3_ENDPOINT &&
      process.env.S3_ACCESS_KEY &&
      process.env.S3_SECRET_KEY
    ) {
      const presign = await request<{
        attachment: { id: string };
        upload: { url: string };
      }>(client, "/attachments/presign-upload", {
        method: "POST",
        body: {
          ownerType: "customer",
          ownerId: customerId,
          fileName: "e2e.pdf",
          contentType: "application/pdf",
          sizeBytes: 128,
        },
      });
      assert(presign.upload.url, "Attachment upload URL missing.");
      const download = await request<{ download: { url: string } }>(
        client,
        `/attachments/${presign.attachment.id}/download-url`,
      );
      assert(download.download.url, "Attachment download URL missing.");
    }

    const billingRun = await request<{
      created: number;
      results: Array<{ billId?: string }>;
    }>(client, "/billing-runs", {
      method: "POST",
      body: { periodMonth },
    });
    assert(billingRun.created === 1, "Billing run did not create a bill.");
    const billId = billingRun.results.find((result) => result.billId)?.billId;
    assert(billId, "Bill id missing from billing run.");

    await request(client, `/bills/${billId}/submit`, { method: "POST" });
    await request(client, `/bills/${billId}/finance-review`, {
      method: "POST",
    });
    await request(client, `/bills/${billId}/send-to-customer`, {
      method: "POST",
    });
    const confirmedBill = await request<{ totalAmount: string }>(
      client,
      `/bills/${billId}/confirm-customer`,
      {
        method: "POST",
        body: {
          confirmedByName: "E2E 客户",
          note: "E2E confirmed",
        },
      },
    );

    await request(client, "/invoices", {
      method: "POST",
      body: {
        invoiceNo: `INV-${runId}`,
        invoiceType: "增值税普通发票",
        issueDate: "2026-02-28",
        amount: confirmedBill.totalAmount,
        allocations: [{ billId, amount: confirmedBill.totalAmount }],
      },
    });
    await request(client, "/receipts", {
      method: "POST",
      body: {
        receiptNo: `RCPT-${runId}`,
        receivedAt: "2026-03-01",
        amount: confirmedBill.totalAmount,
        account: "E2E Bank",
        payer: "E2E 客户",
        allocations: [{ billId, amount: confirmedBill.totalAmount }],
      },
    });

    const costEntry = await request<{ payables: Array<{ id: string }> }>(
      client,
      "/cost-entries",
      {
        method: "POST",
        body: {
          customerId,
          periodMonth,
          amount: "300.00",
          incurredDate: "2026-02-10",
          createPayable: true,
          vendorName: "E2E Vendor",
          dueDate: "2026-02-20",
          description: "E2E cost",
        },
      },
    );
    const payableId = costEntry.payables[0]?.id;
    assert(payableId, "Payable was not created from cost entry.");

    const paymentRequest = await request<{ id: string }>(
      client,
      "/payment-requests",
      {
        method: "POST",
        body: {
          supplierName: "E2E Vendor",
          customerId,
          periodMonth,
          requestedAmount: "300.00",
          accountInfo: { bank: "E2E Bank", accountNo: "0001" },
          reason: "E2E payment request",
          items: [{ payableId, customerId, periodMonth, amount: "300.00" }],
        },
      },
    );
    await request(client, `/payment-requests/${paymentRequest.id}/approve`, {
      method: "POST",
      body: { note: "E2E approved" },
    });
    await request(client, "/payments", {
      method: "POST",
      body: {
        requestId: paymentRequest.id,
        paidAt: "2026-02-21",
        amount: "300.00",
        account: "E2E Bank",
        payeeName: "E2E Vendor",
      },
    });

    await request(client, `/periods/${periodMonth}/close`, {
      method: "POST",
      body: { reason: "E2E close" },
    });

    const profitRows = await request<Array<{ customerCode: string }>>(
      client,
      `/reports/customer-profit?periodMonth=${periodMonth}`,
    );
    assert(
      profitRows.some((row) => row.customerCode === customerCode),
      "Customer profit report missing imported customer.",
    );
    const exportedProfit = await request<{ contentBase64: string }>(
      client,
      `/reports/customer-profit/export?periodMonth=${periodMonth}`,
    );
    assert(exportedProfit.contentBase64, "Customer profit export is empty.");
    const exportedRanking = await request<{ contentBase64: string }>(
      client,
      `/reports/owner-ranking/export?periodMonth=${periodMonth}`,
    );
    assert(exportedRanking.contentBase64, "Owner ranking export is empty.");

    console.log("Business e2e flow passed.");
  } finally {
    await app.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
