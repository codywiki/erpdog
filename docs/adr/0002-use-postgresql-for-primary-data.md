# ADR-0002: Use PostgreSQL for Primary Data

## Status

Proposed

## Context

erpdog stores financial and operational ledger data. Bills, invoice allocations, receipt allocations, costs, payables, payment approvals, and monthly closings all require relational integrity and strong transactional guarantees.

The data model includes many relationships and query patterns:

- Customers to contracts.
- Contracts to bill items.
- Bills to invoices through allocation rows.
- Bills to receipts through allocation rows.
- Costs to payables and payments.
- Users to customer-level permissions.
- Business objects to audit logs and attachments.

## Decision

Use PostgreSQL as the primary database.

Use Prisma for schema management, migrations, and common queries. Allow hand-written SQL migrations for constraints, indexes, views, report queries, and database features that Prisma does not model cleanly enough.

## Consequences

### Positive

- Strong ACID transactions for financial workflows.
- Foreign keys and constraints protect data integrity.
- Rich indexing and query capabilities for reports.
- Works well with TypeScript and Prisma.
- Supports JSON fields for limited extension metadata when needed.

### Negative

- Requires careful migration discipline.
- Complex reports may need SQL expertise.
- High availability is best handled by managed PostgreSQL, which adds cloud cost.

### Neutral

- If reporting load grows, add read replicas or a reporting database before splitting core writes.
- Some constraints should live in both application code and database constraints.

## Alternatives Considered

**MySQL**

Considered but not selected. It can handle many ERP workloads, but PostgreSQL is preferred for richer constraints, indexing, JSON support, and reporting flexibility.

**MongoDB**

Rejected. The domain is relational and financial. Document flexibility is less important than transactions, constraints, and joins.

**SQLite**

Rejected for production. It is suitable for local prototypes, not for a cloud multi-user financial ledger.

## References

- https://www.postgresql.org/docs/current/
- https://www.prisma.io/docs/orm/prisma-migrate
