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
import {
  decimal,
  nonNegativeMoney,
  optionalDecimal,
} from "../../common/utils/finance";
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
  "合同名称",
  "客户编码",
  "签约主体编号",
  "合同附件ID",
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

const contractCodePrefix = "HT";

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

    return paginated(
      items.map((contract) => this.presentContract(contract)),
      total,
      pagination,
    );
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
    return this.presentContract(contract);
  }

  async create(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const attachmentIds = this.attachmentIds(body);
    if (attachmentIds.length === 0) {
      throw new BadRequestException("Contract attachment is required.");
    }
    const customerId = stringField(body, "customerId");
    const customer = await this.customers.ensureCustomerAccess(
      user,
      customerId,
    );
    const signingEntityId = stringField(body, "signingEntityId");
    await this.ensureSigningEntity(user, signingEntityId);
    const chargeItems = arrayField<Payload>(body, "chargeItems");
    const startDate = dateField(body, "startDate");
    const endDate = optionalDate(body, "endDate");

    const contract = await this.prisma.$transaction(async (tx) => {
      const code = await this.nextContractCode(tx, user.orgId, startDate);
      const created = await tx.contract.create({
        data: {
          orgId: user.orgId,
          customerId,
          signingEntityId,
          code,
          name:
            optionalString(body, "name") ?? `${customer.name} ${code} 服务合同`,
          status: this.statusFromPeriod(startDate, endDate),
          startDate,
          endDate,
          billingDay: intField(body, "billingDay", 1),
          currency: stringField(body, "currency", "CNY"),
          notes: optionalString(body, "notes"),
          ...this.commercialTermsData(body),
          chargeItems: {
            create: this.contractChargeItems(body, chargeItems),
          },
        },
        include: this.contractInclude(),
      });

      await this.attachFiles(tx, user, created.id, body);

      return tx.contract.findUniqueOrThrow({
        where: { id: created.id },
        include: this.contractInclude(),
      });
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

    return this.presentContract(contract);
  }

  async update(user: AuthenticatedUser, id: string, rawBody: unknown) {
    const before = await this.get(user, id);
    const body = bodyObject(rawBody);
    const customerId = optionalString(body, "customerId") ?? before.customerId;
    await this.customers.ensureCustomerAccess(user, customerId);
    const signingEntityId =
      optionalString(body, "signingEntityId") ?? before.signingEntityId;
    if (signingEntityId) {
      await this.ensureSigningEntity(user, signingEntityId);
    }
    const startDate = optionalDate(body, "startDate") ?? before.startDate;
    const endDate =
      body.endDate === null
        ? null
        : (optionalDate(body, "endDate") ?? before.endDate);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id },
        data: {
          customerId,
          signingEntityId,
          code: before.code,
          name: optionalString(body, "name") ?? before.name,
          status: this.statusFromPeriod(startDate, endDate),
          startDate,
          endDate,
          billingDay: intField(body, "billingDay", before.billingDay),
          currency: optionalString(body, "currency") ?? before.currency,
          notes:
            body.notes === null
              ? null
              : (optionalString(body, "notes") ?? before.notes),
          ...this.commercialTermsData(body),
        },
        include: this.contractInclude(),
      });

      await this.syncBaseFeeChargeItem(tx, id, body);
      await this.attachFiles(tx, user, id, body);

      return tx.contract.findUniqueOrThrow({
        where: { id },
        include: this.contractInclude(),
      });
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

    return this.presentContract(updated);
  }

  async remove(user: AuthenticatedUser, id: string) {
    const contract = await this.get(user, id);
    const [billCount, extraChargeCount] = await this.prisma.$transaction([
      this.prisma.bill.count({ where: { contractId: id } }),
      this.prisma.extraCharge.count({ where: { contractId: id } }),
    ]);
    const usage = {
      bills: billCount,
      extraCharges: extraChargeCount,
    };
    if (Object.values(usage).some((count) => count > 0)) {
      throw new ConflictException(
        `Contract is already used by business records: ${this.formatUsageSummary(usage)}.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.attachment.deleteMany({
        where: { orgId: user.orgId, ownerType: "contract", ownerId: id },
      });
      await tx.contract.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          orgId: user.orgId,
          actorUserId: user.id,
          action: "contract.delete",
          entityType: "contract",
          entityId: id,
          before: {
            code: contract.code,
            customerId: contract.customerId,
            status: contract.status,
          },
        },
      });
    });

    return { id, deleted: true };
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
          { 字段: "合同编码", 说明: "系统自动生成，导入时无需填写。" },
          { 字段: "客户编码", 说明: "必填，必须匹配已存在客户编码。" },
          { 字段: "签约主体编号", 说明: "必填，必须匹配已存在签约主体编号。" },
          {
            字段: "合同附件ID",
            说明: "必填，先上传 PDF 合同附件后填写附件 ID；多个 ID 用逗号分隔。",
          },
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
            说明: "需要导入多收费项时，可填写同一合同编码作为分组标识；未填写则每行生成一份合同。",
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
      const code =
        this.cell(row, ["合同编码", "code", "Code"]) ?? `__row_${rowNumber}`;

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

  private contractChargeItems(body: Payload, chargeItems: Payload[]) {
    if (chargeItems.length > 0) {
      return chargeItems.map((item) => this.chargeItemData(item));
    }

    const baseFee = this.optionalMoney(body, "baseFee");
    if (baseFee === undefined || baseFee === null) {
      return [];
    }

    return [
      {
        name: "基础服务费",
        kind: ChargeItemKind.FIXED,
        amount: baseFee,
        quantity: new Prisma.Decimal(1),
        unit: "月",
        description: "合同基础费用",
        startsAt: undefined,
        endsAt: undefined,
        isActive: true,
      },
    ];
  }

  private async syncBaseFeeChargeItem(
    tx: Prisma.TransactionClient,
    contractId: string,
    body: Payload,
  ) {
    const baseFee = this.optionalMoney(body, "baseFee");
    if (baseFee === undefined || baseFee === null) {
      return;
    }

    const item =
      (await tx.contractChargeItem.findFirst({
        where: {
          contractId,
          name: "基础服务费",
          kind: ChargeItemKind.FIXED,
          isActive: true,
        },
        orderBy: { createdAt: "asc" },
      })) ??
      (await tx.contractChargeItem.findFirst({
        where: { contractId, kind: ChargeItemKind.FIXED, isActive: true },
        orderBy: { createdAt: "asc" },
      }));

    if (!item) {
      await tx.contractChargeItem.create({
        data: {
          contractId,
          name: "基础服务费",
          kind: ChargeItemKind.FIXED,
          amount: baseFee,
          quantity: new Prisma.Decimal(1),
          unit: "月",
          description: "合同基础费用",
        },
      });
      return;
    }

    const billItemCount = await tx.billItem.count({
      where: { contractChargeItemId: item.id, bill: { contractId } },
    });
    if (billItemCount > 0) {
      await tx.contractChargeItem.update({
        where: { id: item.id },
        data: {
          isActive: false,
          endsAt: new Date(),
        },
      });
      await tx.contractChargeItem.create({
        data: {
          contractId,
          name: "基础服务费",
          kind: ChargeItemKind.FIXED,
          amount: baseFee,
          quantity: new Prisma.Decimal(1),
          unit: "月",
          description: "合同基础费用",
        },
      });
      return;
    }

    await tx.contractChargeItem.update({
      where: { id: item.id },
      data: {
        name: "基础服务费",
        amount: baseFee,
        quantity: new Prisma.Decimal(1),
        unit: "月",
        description: "合同基础费用",
      },
    });
  }

  private commercialTermsData(body: Payload) {
    const baseFee = this.optionalMoney(body, "baseFee");
    const incentiveUnitPrice = this.optionalMoney(body, "incentiveUnitPrice");
    const serviceFeeRate = this.optionalRate(body, "serviceFeeRate");
    const tierMode = this.tierMode(body);
    const tierRules = this.tierRules(body, tierMode);

    return {
      ...(baseFee !== undefined ? { baseFee } : {}),
      ...(incentiveUnitPrice !== undefined ? { incentiveUnitPrice } : {}),
      ...(serviceFeeRate !== undefined ? { serviceFeeRate } : {}),
      ...(tierMode !== undefined ? { tierMode } : {}),
      ...(tierRules !== undefined ? { tierRules } : {}),
    };
  }

  private optionalMoney(body: Payload, field: string) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) {
      return undefined;
    }

    const value = body[field];
    if (value === null || value === "") {
      return null;
    }

    return nonNegativeMoney(value, field);
  }

  private optionalRate(body: Payload, field: string) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) {
      return undefined;
    }

    const value = body[field];
    if (value === null || value === "") {
      return null;
    }

    const parsed = decimal(value, field);
    if (!parsed.isFinite() || parsed.lessThan(0) || parsed.greaterThan(100)) {
      throw new BadRequestException(`${field} must be between 0 and 100.`);
    }

    if (parsed.decimalPlaces() > 4) {
      throw new BadRequestException(`${field} must have at most 4 decimals.`);
    }

    return parsed.toDecimalPlaces(4);
  }

  private tierMode(body: Payload) {
    if (!Object.prototype.hasOwnProperty.call(body, "tierMode")) {
      return undefined;
    }

    const value = optionalString(body, "tierMode");
    if (!value || value === "NONE") {
      return null;
    }

    if (!["ACCUMULATE", "FULL_COVERAGE"].includes(value)) {
      throw new BadRequestException(
        "tierMode must be ACCUMULATE, FULL_COVERAGE, or NONE.",
      );
    }

    return value;
  }

  private tierRules(body: Payload, tierMode?: string | null) {
    if (!Object.prototype.hasOwnProperty.call(body, "tierRules")) {
      return undefined;
    }

    const value = body.tierRules;
    if (value === null) {
      return Prisma.JsonNull;
    }

    if (!Array.isArray(value)) {
      throw new BadRequestException("tierRules must be an array.");
    }

    const requiresDescription =
      tierMode === "ACCUMULATE" || tierMode === "FULL_COVERAGE";
    if (requiresDescription && value.length === 0) {
      throw new BadRequestException(
        "ruleDescription is required when tierMode is ACCUMULATE or FULL_COVERAGE.",
      );
    }

    if (value.length > 0 && !tierMode) {
      throw new BadRequestException(
        "tierMode is required when tierRules are configured.",
      );
    }

    return value.map((rule, index) => {
      if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
        throw new BadRequestException(`tierRules[${index}] must be an object.`);
      }

      const payload = rule as Payload;
      const description = optionalString(payload, "description");
      if (description) {
        return { description };
      }
      if (requiresDescription) {
        throw new BadRequestException(
          `tierRules[${index}].description is required.`,
        );
      }

      const threshold = nonNegativeMoney(
        payload.threshold,
        `tierRules[${index}].threshold`,
      );
      const serviceFeeRate = this.optionalRate(
        { serviceFeeRate: payload.serviceFeeRate },
        "serviceFeeRate",
      );
      if (serviceFeeRate === undefined || serviceFeeRate === null) {
        throw new BadRequestException(
          `tierRules[${index}].serviceFeeRate is required.`,
        );
      }

      return {
        threshold: threshold.toFixed(2),
        serviceFeeRate: serviceFeeRate.toFixed(4),
      };
    }) satisfies Prisma.InputJsonValue;
  }

  private statusFromPeriod(
    startDate: Date,
    endDate?: Date | null,
  ): ContractStatus {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (endDate && endDate < today) {
      return ContractStatus.TERMINATED;
    }

    return ContractStatus.ACTIVE;
  }

  private presentContract<T extends { startDate: Date; endDate: Date | null }>(
    contract: T,
  ) {
    return {
      ...contract,
      status: this.statusFromPeriod(contract.startDate, contract.endDate),
    };
  }

  private async attachFiles(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    contractId: string,
    body: Payload,
  ) {
    const attachmentIds = this.attachmentIds(body);
    if (attachmentIds.length === 0) {
      return;
    }

    const attachments = await tx.attachment.findMany({
      where: {
        id: { in: attachmentIds },
        orgId: user.orgId,
        OR: [
          { uploadedById: user.id },
          { ownerType: "contract", ownerId: contractId },
        ],
      },
    });
    if (attachments.length !== new Set(attachmentIds).size) {
      throw new BadRequestException(
        "Contract attachments must be uploaded before saving.",
      );
    }
    for (const attachment of attachments) {
      this.validateContractAttachment(
        attachment.fileName,
        attachment.contentType ?? undefined,
        attachment.sizeBytes ?? undefined,
      );
    }

    await tx.attachment.updateMany({
      where: { id: { in: attachmentIds }, orgId: user.orgId },
      data: { ownerType: "contract", ownerId: contractId, contractId },
    });
  }

  private attachmentIds(body: Payload) {
    return arrayField<unknown>(body, "attachmentIds").filter(
      (id): id is string => typeof id === "string" && Boolean(id.trim()),
    );
  }

  private validateContractAttachment(
    fileName: string,
    contentType: string | undefined,
    sizeBytes: bigint | undefined,
  ) {
    const normalizedName = fileName.toLowerCase();
    const normalizedContentType = contentType?.toLowerCase();
    if (
      !normalizedName.endsWith(".pdf") ||
      (normalizedContentType !== undefined &&
        normalizedContentType !== "application/pdf")
    ) {
      throw new BadRequestException("Contract attachments must be PDF files.");
    }
    if (sizeBytes === undefined) {
      throw new BadRequestException(
        "Contract attachment sizeBytes is required.",
      );
    }
    if (sizeBytes > BigInt(20 * 1024 * 1024)) {
      throw new BadRequestException(
        "Contract attachments must be smaller than 20MB.",
      );
    }
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
          fullName: true,
        },
      },
      signingEntity: {
        select: {
          id: true,
          code: true,
          shortName: true,
          fullName: true,
          legalRepresentative: true,
          taxpayerType: true,
        },
      },
      attachments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fileName: true,
          contentType: true,
          createdAt: true,
        },
      },
      chargeItems: {
        orderBy: { createdAt: "asc" },
      },
    } satisfies Prisma.ContractInclude;
  }

  private async ensureSigningEntity(
    user: AuthenticatedUser,
    signingEntityId: string,
  ) {
    const signingEntity = await this.prisma.signingEntity.findFirst({
      where: { id: signingEntityId, orgId: user.orgId },
    });
    if (!signingEntity) {
      throw new NotFoundException("Signing entity not found.");
    }

    return signingEntity;
  }

  private async nextContractCode(
    tx: Prisma.TransactionClient,
    orgId: string,
    startDate: Date,
  ) {
    const year = startDate.getFullYear().toString().slice(-2);
    const prefix = `${contractCodePrefix}${year}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`contract-code:${orgId}:${prefix}`}))`;
    const existing = await tx.contract.findMany({
      where: { orgId, code: { startsWith: prefix } },
      select: { code: true },
    });
    const nextNumber =
      existing.reduce((max, item) => {
        const match = new RegExp(`^${prefix}(\\d+)$`).exec(item.code);
        return match?.[1] ? Math.max(max, Number(match[1])) : max;
      }, 0) + 1;

    return `${prefix}${nextNumber.toString().padStart(3, "0")}`;
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
      name: this.cell(group.row, ["合同名称", "name", "Name"]),
      signingEntityId: await this.signingEntityIdFromImportRow(user, group.row),
      attachmentIds: this.attachmentIdsFromImportRow(group.row),
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

  private async signingEntityIdFromImportRow(
    user: AuthenticatedUser,
    row: Record<string, unknown>,
  ) {
    const code = this.cell(row, [
      "签约主体编号",
      "我方签约主体编号",
      "signingEntityCode",
    ]);
    if (!code) {
      throw new BadRequestException("签约主体编号 is required.");
    }

    const signingEntity = await this.prisma.signingEntity.findFirst({
      where: { orgId: user.orgId, code },
      select: { id: true },
    });
    if (!signingEntity) {
      throw new NotFoundException(`Signing entity not found: ${code}`);
    }

    return signingEntity.id;
  }

  private attachmentIdsFromImportRow(row: Record<string, unknown>) {
    const raw = this.cell(row, [
      "合同附件ID",
      "合同附件Ids",
      "附件ID",
      "attachmentIds",
    ]);
    if (!raw) {
      return [];
    }

    return raw
      .split(/[,，;；\s]+/)
      .map((id) => id.trim())
      .filter(Boolean);
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

  private formatUsageSummary(usage: Record<string, number>) {
    return Object.entries(usage)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => `${key}=${count}`)
      .join(", ");
  }
}
