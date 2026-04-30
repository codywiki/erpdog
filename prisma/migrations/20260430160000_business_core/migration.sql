-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'PAUSED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "ChargeItemKind" AS ENUM ('FIXED', 'VARIABLE', 'DISCOUNT', 'WAIVER', 'MANUAL');

-- CreateEnum
CREATE TYPE "ChargeSourceType" AS ENUM ('CONTRACT', 'EXTRA_CHARGE', 'ADJUSTMENT', 'MANUAL');

-- CreateEnum
CREATE TYPE "ExtraChargeKind" AS ENUM ('VALUE_ADDED', 'ADVANCE_PAYMENT');

-- CreateEnum
CREATE TYPE "ExtraChargeStatus" AS ENUM ('DRAFT', 'BILLING_INCLUDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('DRAFT', 'INTERNAL_REVIEW', 'FINANCE_REVIEW', 'CUSTOMER_PENDING', 'CUSTOMER_CONFIRMED', 'CLOSED', 'VOIDED', 'ADJUSTED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('REGISTERED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PayableStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'VOIDED');

-- CreateEnum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'PARTIALLY_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('REGISTERED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PeriodClosingStatus" AS ENUM ('OPEN', 'CLOSED', 'REOPENED');

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "industry" TEXT,
    "source" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_contacts" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_billing_profiles" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tax_number" TEXT,
    "bank_name" TEXT,
    "bank_account" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_billing_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_owners" (
    "customer_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_owners_pkey" PRIMARY KEY ("customer_id","user_id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "billing_day" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_charge_items" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ChargeItemKind" NOT NULL DEFAULT 'FIXED',
    "amount" DECIMAL(18,2) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "unit" TEXT,
    "description" TEXT,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_charge_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge_rule_templates" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "payload" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charge_rule_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extra_charge_categories" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ExtraChargeKind" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extra_charge_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extra_charges" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "contract_id" TEXT,
    "category_id" TEXT,
    "kind" "ExtraChargeKind" NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "incurred_date" TIMESTAMP(3) NOT NULL,
    "period_month" TEXT NOT NULL,
    "status" "ExtraChargeStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extra_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_periods" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "period_month" TEXT NOT NULL,
    "starts_on" TIMESTAMP(3) NOT NULL,
    "ends_on" TIMESTAMP(3) NOT NULL,
    "status" "PeriodClosingStatus" NOT NULL DEFAULT 'OPEN',
    "closed_at" TIMESTAMP(3),
    "reopened_at" TIMESTAMP(3),
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "contract_id" TEXT,
    "bill_no" TEXT NOT NULL,
    "period_month" TEXT NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "adjustment_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "due_date" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "confirmed_by" TEXT,
    "confirmation_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_items" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "contract_charge_item_id" TEXT,
    "extra_charge_id" TEXT,
    "adjustment_id" TEXT,
    "source_type" "ChargeSourceType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "line_total" DECIMAL(18,2) NOT NULL,
    "occurred_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bill_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_confirmations" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "confirmed_by_name" TEXT NOT NULL,
    "confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "evidence_attachment_id" TEXT,

    CONSTRAINT "bill_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_adjustments" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bill_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_status_events" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "from_status" "BillStatus",
    "to_status" "BillStatus" NOT NULL,
    "note" TEXT,
    "actor_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bill_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "invoice_type" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "issue_date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "file_attachment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_allocations" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "receipt_no" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "account" TEXT NOT NULL,
    "payer" TEXT,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'REGISTERED',
    "remarks" TEXT,
    "attachment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_allocations" (
    "id" TEXT NOT NULL,
    "receipt_id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipt_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_categories" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_entries" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "period_month" TEXT NOT NULL,
    "category_id" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "incurred_date" TIMESTAMP(3) NOT NULL,
    "handler_user_id" TEXT,
    "description" TEXT,
    "attachment_id" TEXT,
    "payable_created" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payables" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "cost_entry_id" TEXT,
    "category_id" TEXT,
    "vendor_name" TEXT NOT NULL,
    "period_month" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "paid_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "PayableStatus" NOT NULL DEFAULT 'UNPAID',
    "due_date" TIMESTAMP(3),
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_requests" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "request_no" TEXT NOT NULL,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "applicant_user_id" TEXT,
    "supplier_name" TEXT NOT NULL,
    "customer_id" TEXT,
    "period_month" TEXT,
    "category_id" TEXT,
    "payable_id" TEXT,
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "requested_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "account_info" JSONB,
    "reason" TEXT,
    "expected_payment_date" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "decided_by_id" TEXT,
    "reject_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_request_items" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "payable_id" TEXT,
    "customer_id" TEXT,
    "period_month" TEXT,
    "category_id" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_approvals" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "approver_user_id" TEXT,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "payment_no" TEXT NOT NULL,
    "request_id" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "account" TEXT NOT NULL,
    "payee_name" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'REGISTERED',
    "remarks" TEXT,
    "attachment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "payable_id" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "period_closings" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "period_month" TEXT NOT NULL,
    "status" "PeriodClosingStatus" NOT NULL,
    "reason" TEXT,
    "snapshot" JSONB,
    "actor_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "period_closings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "owner_type" TEXT,
    "owner_id" TEXT,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT,
    "size_bytes" BIGINT,
    "storage_key" TEXT NOT NULL,
    "url" TEXT,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_customer_metrics" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "period_month" TEXT NOT NULL,
    "income_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cost_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "profit_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gross_margin" DECIMAL(9,4),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_customer_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_org_id_status_idx" ON "customers"("org_id", "status");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "customers_org_id_code_key" ON "customers"("org_id", "code");

-- CreateIndex
CREATE INDEX "customer_contacts_customer_id_idx" ON "customer_contacts"("customer_id");

-- CreateIndex
CREATE INDEX "customer_billing_profiles_customer_id_idx" ON "customer_billing_profiles"("customer_id");

-- CreateIndex
CREATE INDEX "customer_owners_user_id_idx" ON "customer_owners"("user_id");

-- CreateIndex
CREATE INDEX "contracts_org_id_status_idx" ON "contracts"("org_id", "status");

-- CreateIndex
CREATE INDEX "contracts_customer_id_status_idx" ON "contracts"("customer_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_org_id_code_key" ON "contracts"("org_id", "code");

-- CreateIndex
CREATE INDEX "contract_charge_items_contract_id_is_active_idx" ON "contract_charge_items"("contract_id", "is_active");

-- CreateIndex
CREATE INDEX "charge_rule_templates_org_id_is_active_idx" ON "charge_rule_templates"("org_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "charge_rule_templates_org_id_code_key" ON "charge_rule_templates"("org_id", "code");

-- CreateIndex
CREATE INDEX "extra_charge_categories_org_id_kind_idx" ON "extra_charge_categories"("org_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "extra_charge_categories_org_id_code_key" ON "extra_charge_categories"("org_id", "code");

-- CreateIndex
CREATE INDEX "extra_charges_org_id_period_month_idx" ON "extra_charges"("org_id", "period_month");

-- CreateIndex
CREATE INDEX "extra_charges_customer_id_period_month_idx" ON "extra_charges"("customer_id", "period_month");

-- CreateIndex
CREATE INDEX "extra_charges_status_period_month_idx" ON "extra_charges"("status", "period_month");

-- CreateIndex
CREATE INDEX "billing_periods_org_id_status_idx" ON "billing_periods"("org_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "billing_periods_org_id_period_month_key" ON "billing_periods"("org_id", "period_month");

-- CreateIndex
CREATE INDEX "bills_org_id_period_month_idx" ON "bills"("org_id", "period_month");

-- CreateIndex
CREATE INDEX "bills_customer_id_period_month_idx" ON "bills"("customer_id", "period_month");

-- CreateIndex
CREATE INDEX "bills_status_period_month_idx" ON "bills"("status", "period_month");

-- CreateIndex
CREATE UNIQUE INDEX "bills_org_id_bill_no_key" ON "bills"("org_id", "bill_no");

-- CreateIndex
CREATE UNIQUE INDEX "bills_org_id_contract_id_period_month_key" ON "bills"("org_id", "contract_id", "period_month");

-- CreateIndex
CREATE INDEX "bill_items_bill_id_idx" ON "bill_items"("bill_id");

-- CreateIndex
CREATE INDEX "bill_items_extra_charge_id_idx" ON "bill_items"("extra_charge_id");

-- CreateIndex
CREATE INDEX "bill_confirmations_bill_id_idx" ON "bill_confirmations"("bill_id");

-- CreateIndex
CREATE INDEX "bill_adjustments_bill_id_idx" ON "bill_adjustments"("bill_id");

-- CreateIndex
CREATE INDEX "bill_status_events_bill_id_created_at_idx" ON "bill_status_events"("bill_id", "created_at");

-- CreateIndex
CREATE INDEX "invoices_org_id_issue_date_idx" ON "invoices"("org_id", "issue_date");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_org_id_invoice_no_key" ON "invoices"("org_id", "invoice_no");

-- CreateIndex
CREATE INDEX "invoice_allocations_invoice_id_idx" ON "invoice_allocations"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_allocations_bill_id_idx" ON "invoice_allocations"("bill_id");

-- CreateIndex
CREATE INDEX "receipts_org_id_received_at_idx" ON "receipts"("org_id", "received_at");

-- CreateIndex
CREATE INDEX "receipts_status_idx" ON "receipts"("status");

-- CreateIndex
CREATE INDEX "receipt_allocations_receipt_id_idx" ON "receipt_allocations"("receipt_id");

-- CreateIndex
CREATE INDEX "receipt_allocations_bill_id_idx" ON "receipt_allocations"("bill_id");

-- CreateIndex
CREATE INDEX "cost_categories_org_id_is_active_idx" ON "cost_categories"("org_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "cost_categories_org_id_code_key" ON "cost_categories"("org_id", "code");

-- CreateIndex
CREATE INDEX "cost_entries_org_id_period_month_idx" ON "cost_entries"("org_id", "period_month");

-- CreateIndex
CREATE INDEX "cost_entries_customer_id_period_month_idx" ON "cost_entries"("customer_id", "period_month");

-- CreateIndex
CREATE INDEX "cost_entries_category_id_idx" ON "cost_entries"("category_id");

-- CreateIndex
CREATE INDEX "payables_org_id_period_month_idx" ON "payables"("org_id", "period_month");

-- CreateIndex
CREATE INDEX "payables_customer_id_period_month_idx" ON "payables"("customer_id", "period_month");

-- CreateIndex
CREATE INDEX "payables_status_idx" ON "payables"("status");

-- CreateIndex
CREATE INDEX "payment_requests_org_id_status_idx" ON "payment_requests"("org_id", "status");

-- CreateIndex
CREATE INDEX "payment_requests_customer_id_period_month_idx" ON "payment_requests"("customer_id", "period_month");

-- CreateIndex
CREATE UNIQUE INDEX "payment_requests_org_id_request_no_key" ON "payment_requests"("org_id", "request_no");

-- CreateIndex
CREATE INDEX "payment_request_items_request_id_idx" ON "payment_request_items"("request_id");

-- CreateIndex
CREATE INDEX "payment_request_items_payable_id_idx" ON "payment_request_items"("payable_id");

-- CreateIndex
CREATE INDEX "payment_approvals_request_id_created_at_idx" ON "payment_approvals"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "payments_org_id_paid_at_idx" ON "payments"("org_id", "paid_at");

-- CreateIndex
CREATE INDEX "payments_request_id_idx" ON "payments"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_org_id_payment_no_key" ON "payments"("org_id", "payment_no");

-- CreateIndex
CREATE INDEX "payment_allocations_payment_id_idx" ON "payment_allocations"("payment_id");

-- CreateIndex
CREATE INDEX "payment_allocations_payable_id_idx" ON "payment_allocations"("payable_id");

-- CreateIndex
CREATE INDEX "period_closings_org_id_period_month_created_at_idx" ON "period_closings"("org_id", "period_month", "created_at");

-- CreateIndex
CREATE INDEX "attachments_org_id_owner_type_owner_id_idx" ON "attachments"("org_id", "owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "monthly_customer_metrics_org_id_period_month_idx" ON "monthly_customer_metrics"("org_id", "period_month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_customer_metrics_org_id_customer_id_period_month_key" ON "monthly_customer_metrics"("org_id", "customer_id", "period_month");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_billing_profiles" ADD CONSTRAINT "customer_billing_profiles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_owners" ADD CONSTRAINT "customer_owners_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_owners" ADD CONSTRAINT "customer_owners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_charge_items" ADD CONSTRAINT "contract_charge_items_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_rule_templates" ADD CONSTRAINT "charge_rule_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extra_charge_categories" ADD CONSTRAINT "extra_charge_categories_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extra_charges" ADD CONSTRAINT "extra_charges_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extra_charges" ADD CONSTRAINT "extra_charges_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extra_charges" ADD CONSTRAINT "extra_charges_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "extra_charge_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_periods" ADD CONSTRAINT "billing_periods_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_contract_charge_item_id_fkey" FOREIGN KEY ("contract_charge_item_id") REFERENCES "contract_charge_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_extra_charge_id_fkey" FOREIGN KEY ("extra_charge_id") REFERENCES "extra_charges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_confirmations" ADD CONSTRAINT "bill_confirmations_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_adjustments" ADD CONSTRAINT "bill_adjustments_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_status_events" ADD CONSTRAINT "bill_status_events_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_allocations" ADD CONSTRAINT "invoice_allocations_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_allocations" ADD CONSTRAINT "invoice_allocations_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_allocations" ADD CONSTRAINT "receipt_allocations_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_allocations" ADD CONSTRAINT "receipt_allocations_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_categories" ADD CONSTRAINT "cost_categories_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "cost_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_cost_entry_id_fkey" FOREIGN KEY ("cost_entry_id") REFERENCES "cost_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "cost_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "cost_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_request_items" ADD CONSTRAINT "payment_request_items_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "payment_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_request_items" ADD CONSTRAINT "payment_request_items_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "payables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_request_items" ADD CONSTRAINT "payment_request_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "cost_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_approvals" ADD CONSTRAINT "payment_approvals_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "payment_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "payment_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "payables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_closings" ADD CONSTRAINT "period_closings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_customer_metrics" ADD CONSTRAINT "monthly_customer_metrics_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_customer_metrics" ADD CONSTRAINT "monthly_customer_metrics_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

