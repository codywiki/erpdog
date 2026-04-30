import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { CustomerStatus, Prisma } from "@prisma/client";

import {
  PERMISSION_CODES,
  type AuthenticatedUser
} from "@erpdog/contracts";

import { AuditService } from "../../common/audit/audit.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  arrayField,
  bodyObject,
  booleanField,
  optionalString,
  stringField,
  type Payload
} from "../../common/utils/payload";

type CustomerFilters = {
  q?: string;
  status?: string;
};

@Injectable()
export class CustomersService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async list(user: AuthenticatedUser, filters: CustomerFilters) {
    const where: Prisma.CustomerWhereInput = {
      orgId: user.orgId,
      ...(filters.status ? { status: filters.status as CustomerStatus } : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" } },
              { code: { contains: filters.q, mode: "insensitive" } }
            ]
          }
        : {})
    };

    if (!this.canReadAll(user)) {
      where.owners = { some: { userId: user.id } };
    }

    return this.prisma.customer.findMany({
      where,
      include: this.customerInclude(),
      orderBy: { createdAt: "desc" }
    });
  }

  async get(user: AuthenticatedUser, id: string) {
    await this.ensureCustomerAccess(user, id);

    return this.prisma.customer.findUniqueOrThrow({
      where: { id },
      include: this.customerInclude()
    });
  }

  async create(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const ownerUserIds = this.ownerIds(body, user);
    const contacts = arrayField<Payload>(body, "contacts");
    const billingProfiles = arrayField<Payload>(body, "billingProfiles");

    const customer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          orgId: user.orgId,
          code: stringField(body, "code"),
          name: stringField(body, "name"),
          status: this.status(body),
          industry: optionalString(body, "industry"),
          source: optionalString(body, "source"),
          notes: optionalString(body, "notes"),
          owners: {
            create: ownerUserIds.map((userId, index) => ({
              userId,
              isPrimary: index === 0
            }))
          },
          contacts: {
            create: contacts.map((contact) => this.contactData(contact))
          },
          billingProfiles: {
            create: billingProfiles.map((profile) =>
              this.billingProfileData(profile)
            )
          }
        },
        include: this.customerInclude()
      });

      await tx.auditLog.create({
        data: {
          orgId: user.orgId,
          actorUserId: user.id,
          action: "customer.create",
          entityType: "customer",
          entityId: created.id,
          after: { id: created.id, code: created.code, name: created.name }
        }
      });

      return created;
    });

    return customer;
  }

  async update(user: AuthenticatedUser, id: string, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const before = await this.ensureCustomerAccess(user, id);

    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        code: optionalString(body, "code") ?? before.code,
        name: optionalString(body, "name") ?? before.name,
        status: this.status(body, before.status),
        industry: optionalString(body, "industry") ?? before.industry,
        source: optionalString(body, "source") ?? before.source,
        notes: optionalString(body, "notes") ?? before.notes
      },
      include: this.customerInclude()
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "customer.update",
      entityType: "customer",
      entityId: id,
      before: { code: before.code, name: before.name, status: before.status },
      after: { code: updated.code, name: updated.name, status: updated.status }
    });

    return updated;
  }

  async addContact(user: AuthenticatedUser, customerId: string, rawBody: unknown) {
    await this.ensureCustomerAccess(user, customerId);
    const body = bodyObject(rawBody);

    const contact = await this.prisma.customerContact.create({
      data: {
        customerId,
        ...this.contactData(body)
      }
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "customer.contact.create",
      entityType: "customer",
      entityId: customerId,
      after: { id: contact.id, name: contact.name }
    });

    return contact;
  }

  async addBillingProfile(
    user: AuthenticatedUser,
    customerId: string,
    rawBody: unknown
  ) {
    await this.ensureCustomerAccess(user, customerId);
    const body = bodyObject(rawBody);

    const profile = await this.prisma.customerBillingProfile.create({
      data: {
        customerId,
        ...this.billingProfileData(body)
      }
    });

    await this.audit.log({
      orgId: user.orgId,
      actorUserId: user.id,
      action: "customer.billing_profile.create",
      entityType: "customer",
      entityId: customerId,
      after: { id: profile.id, title: profile.title }
    });

    return profile;
  }

  async importCustomers(user: AuthenticatedUser, rawBody: unknown) {
    const body = bodyObject(rawBody);
    const rows = arrayField<Payload>(body, "rows");
    const results: Array<{ row: number; id?: string; error?: string }> = [];

    for (const [index, row] of rows.entries()) {
      try {
        const created = await this.create(user, {
          ...row,
          ownerUserIds: arrayField<string>(row, "ownerUserIds")
        });
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

  async ensureCustomerAccess(user: AuthenticatedUser, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        orgId: user.orgId
      }
    });

    if (!customer) {
      throw new NotFoundException("Customer not found.");
    }

    if (this.canReadAll(user)) {
      return customer;
    }

    const owner = await this.prisma.customerOwner.findUnique({
      where: {
        customerId_userId: {
          customerId,
          userId: user.id
        }
      }
    });

    if (!owner) {
      throw new ForbiddenException("You can only access your own customers.");
    }

    return customer;
  }

  private canReadAll(user: AuthenticatedUser) {
    return user.permissions.includes(PERMISSION_CODES.CUSTOMER_READ_ALL);
  }

  private customerInclude() {
    return {
      contacts: true,
      billingProfiles: true,
      owners: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      }
    } satisfies Prisma.CustomerInclude;
  }

  private ownerIds(body: Payload, user: AuthenticatedUser) {
    const requested = arrayField<string>(body, "ownerUserIds").filter(Boolean);
    return requested.length ? requested : [user.id];
  }

  private status(
    body: Payload,
    fallback: CustomerStatus = CustomerStatus.ACTIVE
  ): CustomerStatus {
    const value = optionalString(body, "status");
    return value && value in CustomerStatus ? (value as CustomerStatus) : fallback;
  }

  private contactData(body: Payload) {
    return {
      name: stringField(body, "name"),
      title: optionalString(body, "title"),
      phone: optionalString(body, "phone"),
      email: optionalString(body, "email"),
      address: optionalString(body, "address"),
      isPrimary: booleanField(body, "isPrimary")
    };
  }

  private billingProfileData(body: Payload) {
    return {
      title: stringField(body, "title"),
      taxNumber: optionalString(body, "taxNumber"),
      bankName: optionalString(body, "bankName"),
      bankAccount: optionalString(body, "bankAccount"),
      address: optionalString(body, "address"),
      phone: optionalString(body, "phone"),
      isDefault: booleanField(body, "isDefault")
    };
  }
}
