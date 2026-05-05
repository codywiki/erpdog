ALTER TYPE "BillStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
ALTER TYPE "BillStatus" ADD VALUE IF NOT EXISTS 'PENDING_SETTLEMENT';
ALTER TYPE "BillStatus" ADD VALUE IF NOT EXISTS 'INVOICED';
ALTER TYPE "BillStatus" ADD VALUE IF NOT EXISTS 'RECEIVED';

ALTER TABLE "bills"
  ADD COLUMN "approval_requested_at" TIMESTAMP(3),
  ADD COLUMN "approved_at" TIMESTAMP(3),
  ADD COLUMN "approved_by_id" TEXT,
  ADD COLUMN "evidence_attachment_ids" JSONB,
  ADD COLUMN "invoice_attachment_ids" JSONB,
  ADD COLUMN "receipt_attachment_ids" JSONB;

CREATE TABLE "bill_settlements" (
  "id" TEXT NOT NULL,
  "bill_id" TEXT NOT NULL,
  "title" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "bill_settlements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bill_settlement_items" (
  "id" TEXT NOT NULL,
  "settlement_id" TEXT NOT NULL,
  "customer_contact_name" TEXT NOT NULL,
  "project_name" TEXT NOT NULL,
  "period_month" TEXT NOT NULL,
  "cooperation_modes" JSONB NOT NULL,
  "other_mode_note" TEXT,
  "cooperation_fee" DECIMAL(18, 2) NOT NULL,
  "service_fee" DECIMAL(18, 2) NOT NULL,
  "total_fee" DECIMAL(18, 2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "bill_settlement_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bill_settlements_bill_id_sort_order_idx"
  ON "bill_settlements"("bill_id", "sort_order");

CREATE INDEX "bill_settlement_items_settlement_id_idx"
  ON "bill_settlement_items"("settlement_id");

CREATE INDEX "bill_settlement_items_period_month_idx"
  ON "bill_settlement_items"("period_month");

ALTER TABLE "bill_settlements"
  ADD CONSTRAINT "bill_settlements_bill_id_fkey"
  FOREIGN KEY ("bill_id") REFERENCES "bills"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bill_settlement_items"
  ADD CONSTRAINT "bill_settlement_items_settlement_id_fkey"
  FOREIGN KEY ("settlement_id") REFERENCES "bill_settlements"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payables"
  ADD COLUMN "bill_id" TEXT;

CREATE INDEX "payables_bill_id_idx" ON "payables"("bill_id");

ALTER TABLE "payables"
  ADD CONSTRAINT "payables_bill_id_fkey"
  FOREIGN KEY ("bill_id") REFERENCES "bills"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "roles"
SET "name" = '总负责人'
WHERE "code" = 'owner';

DO $$
DECLARE
  legacy RECORD;
  target_id TEXT;
BEGIN
  FOR legacy IN
    SELECT "id", "org_id"
    FROM "roles"
    WHERE "code" = 'customer_manager'
  LOOP
    SELECT "id" INTO target_id
    FROM "roles"
    WHERE "org_id" = legacy."org_id" AND "code" = 'business_owner'
    LIMIT 1;

    IF target_id IS NULL THEN
      UPDATE "roles"
      SET "code" = 'business_owner', "name" = '业务负责人'
      WHERE "id" = legacy."id";
    ELSE
      INSERT INTO "user_roles" ("user_id", "role_id", "created_at")
      SELECT "user_id", target_id, CURRENT_TIMESTAMP
      FROM "user_roles"
      WHERE "role_id" = legacy."id"
      ON CONFLICT DO NOTHING;

      INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
      SELECT target_id, "permission_id", CURRENT_TIMESTAMP
      FROM "role_permissions"
      WHERE "role_id" = legacy."id"
      ON CONFLICT DO NOTHING;

      DELETE FROM "roles"
      WHERE "id" = legacy."id";
    END IF;
  END LOOP;
END $$;
