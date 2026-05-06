import { ExtraChargeKind, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { PERMISSION_CODES, ROLE_CODES } from "@erpdog/contracts";

const prisma = new PrismaClient();

const permissionNames: Record<string, string> = {
  [PERMISSION_CODES.DASHBOARD_VIEW]: "经营总览",
  [PERMISSION_CODES.TENANT_MANAGE]: "管理租户和超级管理员",
  [PERMISSION_CODES.USER_MANAGE]: "管理用户和权限",
  [PERMISSION_CODES.CUSTOMER_READ_ALL]: "查看全部客户",
  [PERMISSION_CODES.CUSTOMER_READ_OWN]: "查看负责客户",
  [PERMISSION_CODES.CUSTOMER_WRITE]: "维护客户资料",
  [PERMISSION_CODES.CONTRACT_WRITE]: "维护合同和收费规则",
  [PERMISSION_CODES.BILL_MANAGE]: "管理账单",
  [PERMISSION_CODES.BILL_APPROVE]: "审批应收账单",
  [PERMISSION_CODES.RECEIVABLE_SETTLE]: "登记开票和到账",
  [PERMISSION_CODES.INVOICE_MANAGE]: "管理发票",
  [PERMISSION_CODES.RECEIPT_MANAGE]: "管理收款",
  [PERMISSION_CODES.COST_MANAGE]: "管理成本与应付",
  [PERMISSION_CODES.PAYABLE_SETTLE]: "登记应付付款",
  [PERMISSION_CODES.PAYMENT_REQUEST_CREATE]: "发起付款申请",
  [PERMISSION_CODES.PAYMENT_REQUEST_APPROVE]: "审批付款申请",
  [PERMISSION_CODES.PAYMENT_PAY]: "登记付款",
  [PERMISSION_CODES.PERIOD_CLOSE]: "月度结账",
  [PERMISSION_CODES.PERIOD_REOPEN]: "打开账期",
  [PERMISSION_CODES.REPORT_VIEW]: "查看报表",
  [PERMISSION_CODES.AUDIT_VIEW]: "查看审计日志",
};

const roleDefinitions = [
  {
    code: ROLE_CODES.ADMIN,
    name: "租户管理员",
    permissions: Object.values(PERMISSION_CODES).filter(
      (code) => code !== PERMISSION_CODES.TENANT_MANAGE,
    ),
  },
  {
    code: ROLE_CODES.OWNER,
    name: "总负责人",
    permissions: [
      PERMISSION_CODES.DASHBOARD_VIEW,
      PERMISSION_CODES.CUSTOMER_READ_ALL,
      PERMISSION_CODES.CUSTOMER_WRITE,
      PERMISSION_CODES.CONTRACT_WRITE,
      PERMISSION_CODES.BILL_MANAGE,
      PERMISSION_CODES.BILL_APPROVE,
      PERMISSION_CODES.RECEIVABLE_SETTLE,
      PERMISSION_CODES.INVOICE_MANAGE,
      PERMISSION_CODES.RECEIPT_MANAGE,
      PERMISSION_CODES.COST_MANAGE,
      PERMISSION_CODES.PAYABLE_SETTLE,
      PERMISSION_CODES.PAYMENT_REQUEST_CREATE,
      PERMISSION_CODES.PAYMENT_REQUEST_APPROVE,
      PERMISSION_CODES.PAYMENT_PAY,
      PERMISSION_CODES.PERIOD_CLOSE,
      PERMISSION_CODES.PERIOD_REOPEN,
      PERMISSION_CODES.USER_MANAGE,
      PERMISSION_CODES.REPORT_VIEW,
      PERMISSION_CODES.AUDIT_VIEW,
    ],
  },
  {
    code: ROLE_CODES.FINANCE,
    name: "财务",
    permissions: [
      PERMISSION_CODES.DASHBOARD_VIEW,
      PERMISSION_CODES.CUSTOMER_READ_ALL,
      PERMISSION_CODES.BILL_MANAGE,
      PERMISSION_CODES.RECEIVABLE_SETTLE,
      PERMISSION_CODES.INVOICE_MANAGE,
      PERMISSION_CODES.RECEIPT_MANAGE,
      PERMISSION_CODES.COST_MANAGE,
      PERMISSION_CODES.PAYABLE_SETTLE,
      PERMISSION_CODES.PAYMENT_REQUEST_CREATE,
      PERMISSION_CODES.PAYMENT_PAY,
      PERMISSION_CODES.PERIOD_CLOSE,
      PERMISSION_CODES.REPORT_VIEW,
    ],
  },
  {
    code: ROLE_CODES.BUSINESS_OWNER,
    name: "业务负责人",
    permissions: [
      PERMISSION_CODES.DASHBOARD_VIEW,
      PERMISSION_CODES.CUSTOMER_READ_OWN,
      PERMISSION_CODES.CUSTOMER_WRITE,
      PERMISSION_CODES.CONTRACT_WRITE,
      PERMISSION_CODES.BILL_MANAGE,
      PERMISSION_CODES.COST_MANAGE,
      PERMISSION_CODES.PAYMENT_REQUEST_CREATE,
    ],
  },
];

const platformRoleDefinitions = [
  {
    code: ROLE_CODES.SUPER_ADMIN,
    name: "超级管理员",
    permissions: [PERMISSION_CODES.TENANT_MANAGE],
  },
];

const extraChargeCategories = [
  { code: "value-added", name: "增值服务", kind: ExtraChargeKind.VALUE_ADDED },
  {
    code: "advance-payment",
    name: "代垫费用",
    kind: ExtraChargeKind.ADVANCE_PAYMENT,
  },
];

const costCategories = [
  { code: "labor", name: "人工成本" },
  { code: "outsourcing", name: "外包服务" },
  { code: "advance-payment", name: "代垫支出" },
  { code: "software", name: "软件和工具" },
  { code: "other", name: "其他成本" },
];

async function main() {
  const org = await prisma.organization.upsert({
    where: { code: "default" },
    update: { isPlatform: false },
    create: {
      code: "default",
      name: "默认组织",
      isPlatform: false,
    },
  });

  const platformOrg = await prisma.organization.upsert({
    where: { code: "platform" },
    update: { isPlatform: true, isActive: true },
    create: {
      code: "platform",
      name: "平台管理",
      isPlatform: true,
      isActive: true,
    },
  });

  for (const code of Object.values(PERMISSION_CODES)) {
    await prisma.permission.upsert({
      where: { code },
      update: {
        name: permissionNames[code] ?? code,
      },
      create: {
        code,
        name: permissionNames[code] ?? code,
      },
    });
  }

  const tenantOrgs = await prisma.organization.findMany({
    where: { isPlatform: false, isActive: true },
    select: { id: true },
  });
  const tenantOrgIds = Array.from(
    new Set([org.id, ...tenantOrgs.map((tenantOrg) => tenantOrg.id)]),
  );

  for (const tenantOrgId of tenantOrgIds) {
    for (const roleDefinition of roleDefinitions) {
      const role = await prisma.role.upsert({
        where: {
          orgId_code: {
            orgId: tenantOrgId,
            code: roleDefinition.code,
          },
        },
        update: {
          name: roleDefinition.name,
          isSystem: true,
        },
        create: {
          orgId: tenantOrgId,
          code: roleDefinition.code,
          name: roleDefinition.name,
          isSystem: true,
        },
      });

      const permissions = await prisma.permission.findMany({
        where: { code: { in: roleDefinition.permissions } },
      });
      await prisma.rolePermission.deleteMany({
        where: {
          roleId: role.id,
          permissionId: {
            notIn: permissions.map((permission) => permission.id),
          },
        },
      });
      for (const permission of permissions) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }
    }
  }

  for (const roleDefinition of platformRoleDefinitions) {
    const role = await prisma.role.upsert({
      where: {
        orgId_code: {
          orgId: platformOrg.id,
          code: roleDefinition.code,
        },
      },
      update: {
        name: roleDefinition.name,
        isSystem: true,
      },
      create: {
        orgId: platformOrg.id,
        code: roleDefinition.code,
        name: roleDefinition.name,
        isSystem: true,
      },
    });

    const permissions = await prisma.permission.findMany({
      where: { code: { in: roleDefinition.permissions } },
    });
    await prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        permissionId: { notIn: permissions.map((permission) => permission.id) },
      },
    });
    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  const adminEmail = (
    process.env.ADMIN_EMAIL ?? "admin@erpdog.local"
  ).toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
  const adminName = process.env.ADMIN_NAME ?? "System Admin";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      passwordHash,
      isActive: true,
    },
    create: {
      orgId: org.id,
      email: adminEmail,
      name: adminName,
      passwordHash,
      isActive: true,
    },
  });

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: {
      orgId_code: {
        orgId: org.id,
        code: ROLE_CODES.ADMIN,
      },
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: admin.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      roleId: adminRole.id,
    },
  });

  const superAdminPhone = process.env.SUPER_ADMIN_PHONE ?? "13800000000";
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD ?? "ChangeMe123!";
  const superAdminName = process.env.SUPER_ADMIN_NAME ?? "超级管理员";
  const superAdminEmail = `super-${superAdminPhone.replace(/\D/g, "")}@phone.erpdog.local`;
  const superAdminPasswordHash = await bcrypt.hash(superAdminPassword, 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {
      name: superAdminName,
      phone: superAdminPhone,
      passwordHash: superAdminPasswordHash,
      isActive: true,
      orgId: platformOrg.id,
    },
    create: {
      orgId: platformOrg.id,
      email: superAdminEmail,
      phone: superAdminPhone,
      name: superAdminName,
      passwordHash: superAdminPasswordHash,
      isActive: true,
    },
  });

  const superAdminRole = await prisma.role.findUniqueOrThrow({
    where: {
      orgId_code: {
        orgId: platformOrg.id,
        code: ROLE_CODES.SUPER_ADMIN,
      },
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: superAdmin.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: superAdmin.id,
      roleId: superAdminRole.id,
    },
  });

  for (const tenantOrgId of tenantOrgIds) {
    for (const category of extraChargeCategories) {
      await prisma.extraChargeCategory.upsert({
        where: {
          orgId_code: {
            orgId: tenantOrgId,
            code: category.code,
          },
        },
        update: {
          name: category.name,
          kind: category.kind,
          isActive: true,
        },
        create: {
          orgId: tenantOrgId,
          code: category.code,
          name: category.name,
          kind: category.kind,
          isActive: true,
        },
      });
    }

    for (const category of costCategories) {
      await prisma.costCategory.upsert({
        where: {
          orgId_code: {
            orgId: tenantOrgId,
            code: category.code,
          },
        },
        update: {
          name: category.name,
          isActive: true,
        },
        create: {
          orgId: tenantOrgId,
          code: category.code,
          name: category.name,
          isActive: true,
        },
      });
    }
  }

  console.info(`Seeded erpdog tenant admin user: ${adminEmail}`);
  console.info(`Seeded erpdog super admin phone: ${superAdminPhone}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
