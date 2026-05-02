import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ChargeItemKind, ContractStatus, Prisma } from "@prisma/client";

import { PERMISSION_CODES, type AuthenticatedUser } from "@erpdog/contracts";

import { AuditService } from "../../common/audit/audit.service";
import { ExcelService } from "../../common/excel/excel.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { decimal, optionalDecimal } from "../../common/utils/finance";
import {
  paginated,
  parsePagination,
  type PaginationQuery,
} from "../../common/utils/pagination";
import {
  arrayField,
  bodyObject,
  booleanField,
  dateField,
  intField,
  optionalDate,
  optionalString,
  stringField,
  type Payload,
} from "../../common/utils/payload";
import { CustomersService } from "../customers/customers.service";

type ContractFilters = {
  customerId?: string;
  status?: string;
} & PaginationQuery;

const CONTRACT_IMPORT_HEADERS = [
  "合同编码",
  "合同名称",
  "客户编码",
  "状态",
  "开始日期",
  "结束日期",
  "账期日",
  "币种",
  "合同备注",
  "收费项名称",
  "收费类型",
  "金额",
  "数量",
  "单位",
  "收费说明",
  "生效日",
  "失效日",
  "是否启用",
];

@Injectable()
export class ContractsService {
  constructor(
    private readonly audit: AuditService,
    private readonly customers: CustomersService,
    private readonly excel: ExcelService,
    private readonly prisma: PrismaService,
  ) {}

  async list(user: AuthenticatedUser, filters: ContractFilters) {
    const where: Prisma.ContractWhereInput = {
      orgId: user.orgId,
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.status ? { status: filters.status as ContractStatus } : {}),
    };

    if (!user.permissions.includes(PERMISSION_CODES.CUSTOMER_READ_ALL)) {
      where.customer = { owners: { some: { userId: user.id } } };
    }

    const pagination = parsePagination(filters);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
        where,
        include: this.contractInclude(),
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.contract.count({ where }),
    ]);

    return paginated(items, total, pagination);
  }

  async get(user: AuthenticatedUser, id: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, orgId: user.orgId },
      include: this.contractInclude(),
    });

    if (!contract) {
      throw new NotFoundException("Contract not found.");
    }

    await this.customers.ensureCustomerAccess(user, contract.customerId);
    return contract;
  }

  async create(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const customerId = stringField(body, "customerId");
    await this.customers.ensureCustomerAccess(user, customerId);
    const chargeItems = arrayField<Payload>(body, "chargeItems");

    const contract = await this.prisma.contract.create({
      data: {
        orgId: user.orgId,
        customerId,
        code: stringField(body, "code"),
        name: stringField(body, "name"),
        status: this.status(body),
        startDate: dateField(body, "startDate"),
        endDate: optionalDate(body, "endDate"),
        billingDay: intField(body, "billingDay", 1),
        currency: stringField(body, "currency", "CNY"),
        notes: optionalString(body, "notes"),
        chargeItems: {
          create: chargeItems.map((item) => this.chargeItemData(item)),
        },
      },
      include: this.contractInclude(),
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "contract.create",
      entityType: "contract",
      entityId: contract.id,
      after: {
        id: contract.id,
        code: contract.code,
        customerId: contract.customerId,
      },
    });

    return contract;
  }

  async update(user: AuthenticatedUser, id: string, rawBody: unknown) {
    const before = await this.get(user, id);
    const body = bodyObject(rawBody);

    const updated = await this.prisma.contract.update({
      where: { id },
      data: {
        code: optionalString(body, "code") ?? before.code,
        name: optionalString(body, "name") ?? before.name,
        status: this.status(body, before.status),
        startDate: optionalDate(body, "startDate") ?? before.startDate,
        endDate:
          body.endDate === null
            ? null
            : (optionalDate(body, "endDate") ?? before.endDate),
        billingDay: intField(body, "billingDay", before.billingDay),
        currency: optionalString(body, "currency") ?? before.currency,
        notes: optionalString(body, "notes") ?? before.notes,
      },
      include: this.contractInclude(),
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "contract.update",
      entityType: "contract",
      entityId: id,
      before: { code: before.code, status: before.status },
      after: { code: updated.code, status: updated.status },
    });

    return updated;
  }

  async addChargeItem(
    user: AuthenticatedUser,
    contractId: string,
    rawBody: unknown,
  ) {
    const contract = await this.get(user, contractId);
    const body = bodyObject(rawBody);
    const item = await this.prisma.contractChargeItem.create({
      data: {
        contractId: contract.id,
        ...this.chargeItemData(body),
      },
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "contract.charge_item.create",
      entityType: "contract",
      entityId: contract.id,
      after: { id: item.id, name: item.name, amount: item.amount.toString() },
    });

    return item;
  }

  async updateChargeItem(
    user: AuthenticatedUser,
    contractId: string,
    itemId: string,
    rawBody: unknown,
  ) {
    const contract = await this.get(user, contractId);
    const before = await this.prisma.contractChargeItem.findFirst({
      where: { id: itemId, contractId: contract.id },
    });
    if (!before) {
      throw new NotFoundException("Contract charge item not found.");
    }

    await this.ensureChargeItemEditable(contract.id, itemId);
    const body = bodyObject(rawBody);
    const updated = await this.prisma.contractChargeItem.update({
      where: { id: itemId },
      data: {
        name: optionalString(body, "name") ?? before.name,
        kind: this.kind(body, before.kind),
        amount:
          body.amount === undefined ? before.amount : decimal(body.amount),
        quantity:
          body.quantity === undefined
            ? before.quantity
            : optionalDecimal(body.quantity, before.quantity),
        unit:
          body.unit === null
            ? null
            : (optionalString(body, "unit") ?? before.unit),
        description:
          body.description === null
            ? null
            : (optionalString(body, "description") ?? before.description),
        startsAt:
          body.startsAt === null
            ? null
            : (optionalDate(body, "startsAt") ?? before.startsAt),
        endsAt:
          body.endsAt === null
            ? null
            : (optionalDate(body, "endsAt") ?? before.endsAt),
        isActive: booleanField(body, "isActive", before.isActive),
      },
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "contract.charge_item.update",
      entityType: "contract",
      entityId: contract.id,
      before: {
        id: before.id,
        name: before.name,
        amount: before.amount.toString(),
        isActive: before.isActive,
      },
      after: {
        id: updated.id,
        name: updated.name,
        amount: updated.amount.toString(),
        isActive: updated.isActive,
      },
    });

    return updated;
  }

  async deactivateChargeItem(
    user: AuthenticatedUser,
    contractId: string,
    itemId: string,
    rawBody: unknown,
  ) {
    const contract = await this.get(user, contractId);
    const body = bodyObject(rawBody);
    const before = await this.prisma.contractChargeItem.findFirst({
      where: { id: itemId, contractId: contract.id },
    });
    if (!before) {
      throw new NotFoundException("Contract charge item not found.");
    }

    const updated = await this.prisma.contractChargeItem.update({
      where: { id: itemId },
      data: {
        isActive: false,
        endsAt: optionalDate(body, "endsAt") ?? before.endsAt ?? new Date(),
      },
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "contract.charge_item.deactivate",
      entityType: "contract",
      entityId: contract.id,
      before: { id: before.id, isActive: before.isActive },
      after: { id: updated.id, isActive: updated.isActive },
      reason: optionalString(body, "reason"),
    });

    return updated;
  }

  async importContracts(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const rows = arrayField<Payload>(body, "rows");
    const results: Array<{ row: number; id?: string; error?: string }> = [];

    for (const [index, row] of rows.entries()) {
      try {
        const created = await this.create(user, row);
        results.push({ row: index + 1, id: created.id });
      } catch (error) {
        results.push({
          row: index + 1,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      total: rows.length,
      succeeded: results.filter((result) => result.id).length,
      failed: results.filter((result) => result.error).length,
      results,
    };
  }

  contractImportTemplate() {
    return this.excel.createWorkbook("contracts-import-template.xlsx", [
      {
        name: "合同导入",
        headers: CONTRACT_IMPORT_HEADERS,
        rows: [],
      },
      {
        name: "字段说明",
        headers: ["字段", "说明"],
        rows: [
          { 字段: "合同编码", 说明: "必填，同一组织内唯一。" },
          { 字段: "客户编码", 说明: "必填，必须匹配已存在客户编码。" },
          {
            字段: "状态",
            说明: "可选：DRAFT/ACTIVE/SUSPENDED/EXPIRED/TERMINATED。",
          },
          {
            字段: "收费类型",
            说明: "可选：FIXED/VARIABLE/DISCOUNT/WAIVER/MANUAL，或 固定/变量/折扣/减免/手工。",
          },
          {
            字段: "多收费项",
            说明: "同一合同编码可填写多行，每行会作为一个收费项。",
          },
        ],
      },
    ]);
  }

  async importContractsWorkbook(user: AuthenticatedUser, rawBody: unknown) {
    const rows = (await this.excel.rowsFromBase64(rawBody))
      .map((row, index) => ({ rowNumber: index + 2, row }))
      .filter(({ row }) => !this.isEmptyImportRow(row));
    const grouped = new Map<
      string,
      {
        rowNumber: number;
        row: Record<string, unknown>;
        chargeItems: Payload[];
      }
    >();
    const results: Array<{ row: number; id?: string; error?: string }> = [];
    let invalidRowCount = 0;

    for (const { rowNumber, row } of rows) {
      const code = this.cell(row, ["合同编码", "code", "Code"]);
      if (!code) {
        invalidRowCount += 1;
        results.push({ row: rowNumber, error: "合同编码 is required." });
        continue;
      }

      const group = grouped.get(code) ?? {
        rowNumber,
        row,
        chargeItems: [],
      };
      const chargeItem = this.chargeItemImportPayload(row);
      if (chargeItem) {
        group.chargeItems.push(chargeItem);
      }
      grouped.set(code, group);
    }

    for (const group of grouped.values()) {
      try {
        const payload = await this.contractImportPayload(user, group);
        const created = await this.create(user, payload);
        results.push({ row: group.rowNumber, id: created.id });
      } catch (error) {
        results.push({
          row: group.rowNumber,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const sortedResults = results.sort((a, b) => a.row - b.row);
    return {
      total: grouped.size + invalidRowCount,
      totalRows: rows.length,
      succeeded: sortedResults.filter((result) => result.id).length,
      failed: sortedResults.filter((result) => result.error).length,
      results: sortedResults,
    };
  }

  listTemplates(user: AuthenticatedUser) {
    return this.prisma.chargeRuleTemplate.findMany({
      where: { orgId: user.orgId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async createTemplate(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const template = await this.prisma.chargeRuleTemplate.create({
      data: {
        orgId: user.orgId,
        code: stringField(body, "code"),
        name: stringField(body, "name"),
        description: optionalString(body, "description"),
        payload: (body.payload ?? {}) as Prisma.InputJsonValue,
      },
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "charge_rule_template.create",
      entityType: "charge_rule_template",
      entityId: template.id,
      after: { id: template.id, code: template.code },
    });

    return template;
  }

  private status(
    body: Payload,
    fallback: ContractStatus = ContractStatus.DRAFT,
  ): ContractStatus {
    const value = optionalString(body, "status");
    return value && value in ContractStatus
      ? (value as ContractStatus)
      : fallback;
  }

  private kind(
    body: Payload,
    fallback: ChargeItemKind = ChargeItemKind.FIXED,
  ): ChargeItemKind {
    const value = optionalString(body, "kind");
    return value && value in ChargeItemKind
      ? (value as ChargeItemKind)
      : fallback;
  }

  private chargeItemData(body: Payload) {
    return {
      name: stringField(body, "name"),
      kind: this.kind(body),
      amount: decimal(body.amount),
      quantity: optionalDecimal(body.quantity, new Prisma.Decimal(1)),
      unit: optionalString(body, "unit"),
      description: optionalString(body, "description"),
      startsAt: optionalDate(body, "startsAt"),
      endsAt: optionalDate(body, "endsAt"),
      isActive: booleanField(body, "isActive", true),
    };
  }

  private async ensureChargeItemEditable(contractId: string, itemId: string) {
    const billItemCount = await this.prisma.billItem.count({
      where: { contractChargeItemId: itemId, bill: { contractId } },
    });
    if (billItemCount > 0) {
      throw new ConflictException(
        "Charge items already used by bills cannot be edited directly. Deactivate it and add a new charge item instead.",
      );
    }
  }

  private contractInclude() {
    return {
      customer: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      chargeItems: {
        orderBy: { createdAt: "asc" },
      },
    } satisfies Prisma.ContractInclude;
  }

  private async contractImportPayload(
    user: AuthenticatedUser,
    group: {
      rowNumber: number;
      row: Record<string, unknown>;
      chargeItems: Payload[];
    },
  ): Promise<Payload> {
    const customerCode = this.cell(group.row, ["客户编码", "customerCode"]);
    if (!customerCode) {
      throw new BadRequestException("客户编码 is required.");
    }

    const customer = await this.prisma.customer.findFirst({
      where: { orgId: user.orgId, code: customerCode },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException(`Customer not found: ${customerCode}`);
    }

    return {
      customerId: customer.id,
      code: this.cell(group.row, ["合同编码", "code", "Code"]),
      name: this.cell(group.row, ["合同名称", "name", "Name"]),
      status: this.contractStatusFromCell(
        this.cell(group.row, ["状态", "status"]),
      ),
      startDate: this.dateCell(group.row, ["开始日期", "startDate"]),
      endDate: this.dateCell(group.row, ["结束日期", "endDate"]),
      billingDay: this.intCell(group.row, ["账期日", "billingDay"]) ?? 1,
      currency: this.cell(group.row, ["币种", "currency"]) ?? "CNY",
      notes: this.cell(group.row, ["合同备注", "notes"]),
      chargeItems: group.chargeItems,
    };
  }

  private chargeItemImportPayload(row: Record<string, unknown>) {
    const name = this.cell(row, ["收费项名称", "chargeItemName", "name"]);
    if (!name) {
      return undefined;
    }

    return {
      name,
      kind: this.chargeItemKindFromCell(this.cell(row, ["收费类型", "kind"])),
      amount: this.cell(row, ["金额", "amount"]),
      quantity: this.cell(row, ["数量", "quantity"]) ?? "1",
      unit: this.cell(row, ["单位", "unit"]),
      description: this.cell(row, ["收费说明", "description"]),
      startsAt: this.dateCell(row, ["生效日", "startsAt"]),
      endsAt: this.dateCell(row, ["失效日", "endsAt"]),
      isActive: this.booleanCell(row, ["是否启用", "isActive"]),
    };
  }

  private contractStatusFromCell(value?: string) {
    if (!value) {
      return undefined;
    }

    const normalized = value.trim().toUpperCase();
    const aliases: Record<string, ContractStatus> = {
      DRAFT: ContractStatus.DRAFT,
      ACTIVE: ContractStatus.ACTIVE,
      SUSPENDED: ContractStatus.SUSPENDED,
      EXPIRED: ContractStatus.EXPIRED,
      TERMINATED: ContractStatus.TERMINATED,
      草稿: ContractStatus.DRAFT,
      生效: ContractStatus.ACTIVE,
      有效: ContractStatus.ACTIVE,
      暂停: ContractStatus.SUSPENDED,
      过期: ContractStatus.EXPIRED,
      终止: ContractStatus.TERMINATED,
    };

    return aliases[normalized] ?? ContractStatus.DRAFT;
  }

  private chargeItemKindFromCell(value?: string) {
    if (!value) {
      return ChargeItemKind.FIXED;
    }

    const normalized = value.trim().toUpperCase();
    const aliases: Record<string, ChargeItemKind> = {
      FIXED: ChargeItemKind.FIXED,
      VARIABLE: ChargeItemKind.VARIABLE,
      DISCOUNT: ChargeItemKind.DISCOUNT,
      WAIVER: ChargeItemKind.WAIVER,
      MANUAL: ChargeItemKind.MANUAL,
      固定: ChargeItemKind.FIXED,
      变量: ChargeItemKind.VARIABLE,
      浮动: ChargeItemKind.VARIABLE,
      折扣: ChargeItemKind.DISCOUNT,
      减免: ChargeItemKind.WAIVER,
      手工: ChargeItemKind.MANUAL,
    };

    return aliases[normalized] ?? ChargeItemKind.FIXED;
  }

  private rawCell(row: Record<string, unknown>, aliases: string[]) {
    for (const alias of aliases) {
      const value = row[alias];
      if (value !== undefined && value !== null && String(value).trim()) {
        return value;
      }
    }

    return undefined;
  }

  private cell(row: Record<string, unknown>, aliases: string[]) {
    const value = this.rawCell(row, aliases);
    if (value === undefined) {
      return undefined;
    }
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }
    return String(value).trim();
  }

  private dateCell(row: Record<string, unknown>, aliases: string[]) {
    const value = this.rawCell(row, aliases);
    if (value === undefined) {
      return undefined;
    }
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      const excelEpoch = Date.UTC(1899, 11, 30);
      return new Date(excelEpoch + value * 86_400_000)
        .toISOString()
        .slice(0, 10);
    }
    return String(value).trim();
  }

  private intCell(row: Record<string, unknown>, aliases: string[]) {
    const value = this.rawCell(row, aliases);
    if (typeof value === "number" && Number.isInteger(value)) {
      return value;
    }
    if (typeof value === "string" && /^\d+$/.test(value.trim())) {
      return Number(value.trim());
    }
    return undefined;
  }

  private booleanCell(row: Record<string, unknown>, aliases: string[]) {
    const value = this.rawCell(row, aliases);
    if (typeof value === "boolean") {
      return value;
    }
    if (value === undefined) {
      return undefined;
    }
    const normalized = String(value).trim().toLowerCase();
    if (["true", "1", "yes", "y", "是", "启用"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "n", "否", "停用"].includes(normalized)) {
      return false;
    }
    return undefined;
  }

  private isEmptyImportRow(row: Record<string, unknown>) {
    return Object.values(row).every((value) => {
      if (value === null || value === undefined) {
        return true;
      }
      return String(value).trim() === "";
    });
  }
}
