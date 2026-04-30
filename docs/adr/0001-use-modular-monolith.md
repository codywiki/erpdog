# ADR-0001: Use Modular Monolith Architecture

## Status

Proposed

## Context

erpdog is an internal ERP for long-running service businesses. Phase 1 must replace Excel as the single operational and financial ledger. The first expected scale is 10-50 users, 50-300 customers, and hundreds of bills per month.

The system needs strong consistency across bills, invoices, receipts, costs, payables, payment approvals, closing, and audit logs. It also needs clear module boundaries because Feishu integration, reporting, and approval rules will expand later.

## Decision

Use a modular monolith for Phase 1.

The application will be split into clear domain modules inside one deployable backend:

- Identity & Access
- Customer
- Contract & Charging
- Billing
- Invoice
- Receipt
- Cost, Payable & Payment
- Closing & Audit
- Reporting
- File & Import
- Integration

Web, API, and Worker may run as separate processes, but core business data stays in one PostgreSQL database and one backend codebase.

## Consequences

### Positive

- Keeps deployment and debugging simple.
- Keeps financial transactions inside one database boundary.
- Reduces distributed system complexity.
- Makes it easier to enforce shared authorization and audit rules.
- Preserves clear paths for future module extraction.

### Negative

- Modules cannot scale independently at the codebase level in Phase 1.
- Requires discipline to avoid cross-module coupling.
- A bad deployment can affect multiple modules at once.

### Neutral

- Worker and Reporting can be split first if load grows.
- Module boundaries should be reviewed during implementation.

## Alternatives Considered

**Microservices**

Rejected for Phase 1. The current scale does not justify the operational cost, distributed transactions, network failure handling, and cross-service observability burden.

**Simple CRUD Monolith**

Rejected because erpdog has real domain complexity: locks, reversals, allocations, approvals, and auditability. A flat CRUD application would become hard to maintain quickly.

**Low-code ERP/Odoo-style customization**

Rejected for the initial build direction because the confirmed requirements need tailored billing, allocations, payment approvals, locking, and Feishu integration. Custom code gives better control.

