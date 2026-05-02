import {
  BillStatus,
  ChargeSourceType,
  ContractStatus,
  ExtraChargeKind,
  ExtraChargeStatus,
  PaymentRequestStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { code: "default" },
  });
  const admin = await prisma.user.findUniqueOrThrow({
    where: {
      email: (process.env.ADMIN_EMAIL ?? "admin@erpdog.local").toLowerCase(),
    },
  });

  const customer = await prisma.customer.upsert({
    where: {
      orgId_code: {
        orgId: org.id,
        code: "DEMO-001",
      },
    },
    update: {
      name: "清流派科技",
      fullName: "上海清流派科技有限公司",
      status: "ACTIVE",
    },
    create: {
      orgId: org.id,
      code: "DEMO-001",
      name: "清流派科技",
      fullName: "上海清流派科技有限公司",
      status: "ACTIVE",
      industry: "长期服务",
      notes: "预览演示客户",
      owners: {
        create: {
          userId: admin.id,
          isPrimary: true,
        },
      },
      contacts: {
        create: {
          name: "王经理",
          title: "运营负责人",
          phone: "13800000000",
          email: "demo@example.com",
          isPrimary: true,
        },
      },
      billingProfiles: {
        create: {
          title: "上海清流派科技有限公司",
          taxNumber: "91310000DEMO00001",
          bankName: "招商银行上海分行",
          bankAccount: "6222000000000000000",
          isDefault: true,
        },
      },
    },
  });

  const contract = await prisma.contract.upsert({
    where: {
      orgId_code: {
        orgId: org.id,
        code: "DEMO-CTR-001",
      },
    },
    update: {
      status: ContractStatus.ACTIVE,
      name: "年度运营服务合同",
    },
    create: {
      orgId: org.id,
      customerId: customer.id,
      code: "DEMO-CTR-001",
      name: "年度运营服务合同",
      status: ContractStatus.ACTIVE,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      currency: "CNY",
      chargeItems: {
        create: [
          {
            name: "基础服务费",
            kind: "FIXED",
            amount: new Prisma.Decimal("12000.00"),
            quantity: new Prisma.Decimal("1"),
          },
          {
            name: "专属客服席位",
            kind: "FIXED",
            amount: new Prisma.Decimal("1800.00"),
            quantity: new Prisma.Decimal("2"),
          },
        ],
      },
    },
  });

  const extraCategory = await prisma.extraChargeCategory.findFirst({
    where: {
      orgId: org.id,
      kind: ExtraChargeKind.VALUE_ADDED,
    },
  });

  await prisma.extraCharge.upsert({
    where: { id: "demo-extra-charge-001" },
    update: {},
    create: {
      id: "demo-extra-charge-001",
      orgId: org.id,
      customerId: customer.id,
      contractId: contract.id,
      categoryId: extraCategory?.id,
      kind: ExtraChargeKind.VALUE_ADDED,
      name: "临时专项支持",
      amount: new Prisma.Decimal("2600.00"),
      incurredDate: new Date("2026-04-18T00:00:00.000Z"),
      periodMonth: "2026-04",
      status: ExtraChargeStatus.BILLING_INCLUDED,
      description: "演示增值服务",
    },
  });

  const bill = await prisma.bill.upsert({
    where: {
      orgId_contractId_periodMonth: {
        orgId: org.id,
        contractId: contract.id,
        periodMonth: "2026-04",
      },
    },
    update: {},
    create: {
      orgId: org.id,
      customerId: customer.id,
      contractId: contract.id,
      billNo: "BILL-2026-04-DEMO-CTR-001",
      periodMonth: "2026-04",
      status: BillStatus.CUSTOMER_CONFIRMED,
      subtotal: new Prisma.Decimal("18200.00"),
      totalAmount: new Prisma.Decimal("18200.00"),
      dueDate: new Date("2026-05-15T00:00:00.000Z"),
      confirmedAt: new Date("2026-05-01T00:00:00.000Z"),
      confirmedBy: "王经理",
      items: {
        create: [
          {
            sourceType: ChargeSourceType.CONTRACT,
            name: "基础服务费",
            amount: new Prisma.Decimal("12000.00"),
            quantity: new Prisma.Decimal("1"),
            lineTotal: new Prisma.Decimal("12000.00"),
          },
          {
            sourceType: ChargeSourceType.CONTRACT,
            name: "专属客服席位",
            amount: new Prisma.Decimal("1800.00"),
            quantity: new Prisma.Decimal("2"),
            lineTotal: new Prisma.Decimal("3600.00"),
          },
          {
            extraChargeId: "demo-extra-charge-001",
            sourceType: ChargeSourceType.EXTRA_CHARGE,
            name: "临时专项支持",
            amount: new Prisma.Decimal("2600.00"),
            quantity: new Prisma.Decimal("1"),
            lineTotal: new Prisma.Decimal("2600.00"),
          },
        ],
      },
      confirmations: {
        create: {
          confirmedByName: "王经理",
          note: "演示客户确认",
        },
      },
      statusEvents: {
        create: {
          toStatus: BillStatus.CUSTOMER_CONFIRMED,
          note: "Demo seed",
        },
      },
    },
  });

  await prisma.receipt.upsert({
    where: { id: "demo-receipt-001" },
    update: {},
    create: {
      id: "demo-receipt-001",
      orgId: org.id,
      receiptNo: "REC-2026-04-001",
      receivedAt: new Date("2026-05-03T00:00:00.000Z"),
      amount: new Prisma.Decimal("10000.00"),
      account: "招商银行基本户",
      payer: customer.name,
      allocations: {
        create: {
          billId: bill.id,
          amount: new Prisma.Decimal("10000.00"),
        },
      },
    },
  });

  const costCategory = await prisma.costCategory.findFirst({
    where: {
      orgId: org.id,
      code: "outsourcing",
    },
  });

  const cost = await prisma.costEntry.upsert({
    where: { id: "demo-cost-001" },
    update: {},
    create: {
      id: "demo-cost-001",
      orgId: org.id,
      customerId: customer.id,
      periodMonth: "2026-04",
      categoryId: costCategory?.id,
      amount: new Prisma.Decimal("5200.00"),
      incurredDate: new Date("2026-04-22T00:00:00.000Z"),
      handlerUserId: admin.id,
      description: "外包服务成本",
      payableCreated: true,
    },
  });

  const payable = await prisma.payable.upsert({
    where: { id: "demo-payable-001" },
    update: {},
    create: {
      id: "demo-payable-001",
      orgId: org.id,
      customerId: customer.id,
      costEntryId: cost.id,
      categoryId: costCategory?.id,
      vendorName: "示例外包供应商",
      periodMonth: "2026-04",
      amount: new Prisma.Decimal("5200.00"),
      dueDate: new Date("2026-05-10T00:00:00.000Z"),
    },
  });

  await prisma.paymentRequest.upsert({
    where: {
      orgId_requestNo: {
        orgId: org.id,
        requestNo: "PAYREQ-DEMO-001",
      },
    },
    update: {},
    create: {
      orgId: org.id,
      requestNo: "PAYREQ-DEMO-001",
      status: PaymentRequestStatus.SUBMITTED,
      applicantUserId: admin.id,
      supplierName: "示例外包供应商",
      customerId: customer.id,
      periodMonth: "2026-04",
      categoryId: costCategory?.id,
      totalAmount: new Prisma.Decimal("5200.00"),
      requestedAmount: new Prisma.Decimal("5200.00"),
      reason: "演示付款申请",
      submittedAt: new Date(),
      items: {
        create: {
          payableId: payable.id,
          customerId: customer.id,
          periodMonth: "2026-04",
          categoryId: costCategory?.id,
          amount: new Prisma.Decimal("5200.00"),
          description: "外包服务成本",
        },
      },
    },
  });

  console.info("Seeded erpdog demo data for 2026-04.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
