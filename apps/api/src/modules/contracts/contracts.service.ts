import { Injectable, NotFoundException } from "@nestjs/common";
import { ChargeItemKind, ContractStatus, Prisma } from "@prisma/client";

import {
  PERMISSION_CODES,
  type AuthenticatedUser
} from "@erpdog/contracts";

import { AuditService } from "../../common/audit/audit.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { decimal, optionalDecimal } from "../../common/utils/finance";
import {
  arrayField,
  bodyObject,
  booleanField,
  dateField,
  intField,
  optionalDate,
  optionalString,
  stringField,
  type Payload
} from "../../common/utils/payload";
import { CustomersService } from "../customers/customers.service";

type ContractFilters = {
  customerId?: string;
  status?: string;
};

@Injectable()
export class ContractsService {
  constructor(
    private readonly audit: AuditService,
    private readonly customers: CustomersService,
    private readonly prisma: PrismaService
  ) {}

  async list(user: AuthenticatedUser, filters: ContractFilters) {
    const where: Prisma.ContractWhereInput = {
      orgId: user.orgId,
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.status ? { status: filters.status as ContractStatus } : {})
    };

    if (!user.permissions.includes(PERMISSION_CODES.CUSTOMER_READ_ALL)) {
      where.customer = { owners: { some: { userId: user.id } } };
    }

    return this.prisma.contract.findMany({
      where,
      include: this.contractInclude(),
      orderBy: { createdAt: "desc" }
    });
  }

  async get(user: AuthenticatedUser, id: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, orgId: user.orgId },
      include: this.contractInclude()
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
          create: chargeItems.map((item) => this.chargeItemData(item))
        }
      },
      include: this.contractInclude()
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
        customerId: contract.customerId
      }
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
        notes: optionalString(body, "notes") ?? before.notes
      },
      include: this.contractInclude()
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "contract.update",
      entityType: "contract",
      entityId: id,
      before: { code: before.code, status: before.status },
      after: { code: updated.code, status: updated.status }
    });

    return updated;
  }

  async addChargeItem(
    user: AuthenticatedUser,
    contractId: string,
    rawBody: unknown
  ) {
    const contract = await this.get(user, contractId);
    const body = bodyObject(rawBody);
    const item = await this.prisma.contractChargeItem.create({
      data: {
        contractId: contract.id,
        ...this.chargeItemData(body)
      }
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "contract.charge_item.create",
      entityType: "contract",
      entityId: contract.id,
      after: { id: item.id, name: item.name, amount: item.amount.toString() }
    });

    return item;
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
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    return {
      total: rows.length,
      succeeded: results.filter((result) => result.id).length,
      failed: results.filter((result) => result.error).length,
      results
    };
  }

  listTemplates(user: AuthenticatedUser) {
    return this.prisma.chargeRuleTemplate.findMany({
      where: { orgId: user.orgId, isActive: true },
      orderBy: { createdAt: "desc" }
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
        payload: (body.payload ?? {}) as Prisma.InputJsonValue
      }
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "charge_rule_template.create",
      entityType: "charge_rule_template",
      entityId: template.id,
      after: { id: template.id, code: template.code }
    });

    return template;
  }

  private status(
    body: Payload,
    fallback: ContractStatus = ContractStatus.DRAFT
  ): ContractStatus {
    const value = optionalString(body, "status");
    return value && value in ContractStatus ? (value as ContractStatus) : fallback;
  }

  private kind(
    body: Payload,
    fallback: ChargeItemKind = ChargeItemKind.FIXED
  ): ChargeItemKind {
    const value = optionalString(body, "kind");
    return value && value in ChargeItemKind ? (value as ChargeItemKind) : fallback;
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
      isActive: booleanField(body, "isActive", true)
    };
  }

  private contractInclude() {
    return {
      customer: {
        select: {
          id: true,
          code: true,
          name: true
        }
      },
      chargeItems: {
        orderBy: { createdAt: "asc" }
      }
    } satisfies Prisma.ContractInclude;
  }
}
