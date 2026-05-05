ALTER TYPE "PayableStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentRecipientPlatform') THEN
    CREATE TYPE "PaymentRecipientPlatform" AS ENUM ('PRIVATE_BANK', 'CORPORATE_BANK', 'WECHAT', 'ALIPAY');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "payment_recipients" (
  "id" TEXT NOT NULL,
  "org_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "platform" "PaymentRecipientPlatform" NOT NULL,
  "account_name" TEXT NOT NULL,
  "account_no" TEXT NOT NULL,
  "bank_branch" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payment_recipients_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payment_recipients_org_id_is_active_idx"
  ON "payment_recipients"("org_id", "is_active");
CREATE INDEX IF NOT EXISTS "payment_recipients_name_idx"
  ON "payment_recipients"("name");
CREATE INDEX IF NOT EXISTS "payment_recipients_account_name_idx"
  ON "payment_recipients"("account_name");
CREATE INDEX IF NOT EXISTS "payment_recipients_account_no_idx"
  ON "payment_recipients"("account_no");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payment_recipients_org_id_fkey'
  ) THEN
    ALTER TABLE "payment_recipients"
      ADD CONSTRAINT "payment_recipients_org_id_fkey"
      FOREIGN KEY ("org_id") REFERENCES "organizations"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "payables"
  ADD COLUMN IF NOT EXISTS "payment_recipient_id" TEXT,
  ADD COLUMN IF NOT EXISTS "receipt_platform" "PaymentRecipientPlatform" DEFAULT 'PRIVATE_BANK',
  ADD COLUMN IF NOT EXISTS "receipt_account_name" TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS "receipt_account_no" TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS "receipt_bank_branch" TEXT;

UPDATE "payables"
SET
  "receipt_platform" = COALESCE("receipt_platform", 'PRIVATE_BANK'),
  "receipt_account_name" = COALESCE(NULLIF("receipt_account_name", ''), "vendor_name", ''),
  "receipt_account_no" = COALESCE("receipt_account_no", '')
WHERE "receipt_platform" IS NULL
   OR "receipt_account_name" IS NULL
   OR "receipt_account_no" IS NULL;

ALTER TABLE "payables"
  ALTER COLUMN "receipt_platform" SET NOT NULL,
  ALTER COLUMN "receipt_account_name" SET NOT NULL,
  ALTER COLUMN "receipt_account_no" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "payables_payment_recipient_id_idx"
  ON "payables"("payment_recipient_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payables_payment_recipient_id_fkey'
  ) THEN
    ALTER TABLE "payables"
      ADD CONSTRAINT "payables_payment_recipient_id_fkey"
      FOREIGN KEY ("payment_recipient_id") REFERENCES "payment_recipients"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
