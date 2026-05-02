ALTER TABLE "contracts"
  ADD COLUMN "base_fee" DECIMAL(18, 2),
  ADD COLUMN "incentive_unit_price" DECIMAL(18, 2),
  ADD COLUMN "service_fee_rate" DECIMAL(8, 4),
  ADD COLUMN "tier_mode" TEXT,
  ADD COLUMN "tier_rules" JSONB;

ALTER TABLE "attachments"
  ADD COLUMN "contract_id" TEXT;

CREATE INDEX "attachments_contract_id_idx" ON "attachments"("contract_id");

ALTER TABLE "attachments"
  ADD CONSTRAINT "attachments_contract_id_fkey"
  FOREIGN KEY ("contract_id")
  REFERENCES "contracts"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
