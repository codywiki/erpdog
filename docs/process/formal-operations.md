# Formal Operations Guide

This guide describes how erpdog should be used as a real internal ERP rather than a static preview.

## Production entry

GitHub Pages is only a static product preview. Real business usage requires the full stack:

- Web application
- API service
- Worker service
- PostgreSQL
- Redis
- S3-compatible object storage
- HTTPS domains for Web and API
- Backups, logs, and role-based accounts

The Web application must be built with `NEXT_PUBLIC_API_URL` pointing to the production API, for example:

```text
NEXT_PUBLIC_API_URL=https://api.example.com/api/v1
```

## Initial setup

1. Deploy infrastructure and run database migrations.
2. Replace all production secrets, especially `JWT_SECRET` and `ADMIN_PASSWORD`.
3. Run the seed script to create the first organization, roles, permissions, and administrator.
4. Log in as administrator and create business users.
5. Import or create customers and contracts.
6. Verify one test billing period before using the system for real month-end work.

## Monthly workflow

Use one billing period at a time:

1. Maintain customers, contacts, invoice profiles, and owners.
2. Maintain contracts, charge items, service dates, and monthly fees.
3. Record extra charges and pass-through expenses before bill generation.
4. Generate monthly bills.
5. Move bills through internal review, finance review, customer pending, and customer confirmed.
6. Issue invoices and allocate them to confirmed bills.
7. Record receipts and allocate them to bills.
8. Record costs and create payables.
9. Submit, approve, and pay payment requests.
10. Review customer profit and exceptions.
11. Close the period after all data is verified.

## Role ownership

- Business owner: customer records, contract context, customer confirmation evidence.
- Finance: invoices, receipts, cost entries, payables, payment execution, period closing.
- Approver: payment request approval and exception handling.
- Admin: user accounts, permissions, production configuration, emergency period reopen.

## Operating rules

- Do not create invoices or receipts against draft or voided bills.
- Do not edit a closed period unless an administrator reopens it with a clear reason.
- Do not use demo data for real reconciliation.
- Every manual adjustment must include a reason and should be backed by customer evidence.
- Month-end should not close until receivables, payables, and profit reports have been reviewed.
