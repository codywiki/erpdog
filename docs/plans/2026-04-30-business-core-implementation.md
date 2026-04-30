# Business Core Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the erpdog Phase 1-3 internal ERP business ledger loop.

**Architecture:** Keep the existing TypeScript modular monolith. PostgreSQL/Prisma owns financial integrity, NestJS owns authorization and workflows, BullMQ handles asynchronous billing/outbox jobs, and Next.js provides a dense internal operations console.

**Tech Stack:** Next.js, React, NestJS, Prisma, PostgreSQL, BullMQ, Redis, TypeScript.

---

## Implemented Scope

- Expanded Prisma schema and migration with customer, contract, billing, invoice, receipt, cost, payable, payment request, payment, closing, attachment, and reporting models.
- Added shared status constants to `@erpdog/contracts`.
- Added permission guard, audit service, period lock service, and money/date payload helpers.
- Added customer, contract, billing, and finance API modules under `/api/v1`.
- Added JSON import endpoints for customers and contracts. Excel parsing is intentionally left as an adapter layer so templates can be finalized with business fields.
- Added Worker handlers for `billing` and `outbox` queues.
- Replaced the static Web shell with an authenticated ERP operations console that calls the API.

## Remaining Integration Adapters

- Feishu OAuth, cards, todos, and approval sync need tenant app credentials before they can be wired to the Outbox delivery adapter.
- S3 upload currently stores attachment metadata and external URLs/storage keys. Presigned upload/download endpoints can be added once the production object store policy is confirmed.
- `.xlsx` import/export needs final field templates before adding an Excel parser and validation report.
