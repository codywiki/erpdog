CREATE TYPE "TaxpayerType" AS ENUM ('SMALL_SCALE', 'GENERAL', 'OVERSEAS');

CREATE TABLE "signing_entities" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "short_name" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "legal_representative" TEXT NOT NULL,
    "taxpayer_type" "TaxpayerType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signing_entities_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "contracts"
  ADD COLUMN "signing_entity_id" TEXT;

CREATE UNIQUE INDEX "signing_entities_org_id_code_key" ON "signing_entities"("org_id", "code");
CREATE UNIQUE INDEX "signing_entities_org_id_full_name_key" ON "signing_entities"("org_id", "full_name");
CREATE INDEX "signing_entities_org_id_idx" ON "signing_entities"("org_id");
CREATE INDEX "signing_entities_short_name_idx" ON "signing_entities"("short_name");
CREATE INDEX "contracts_signing_entity_id_idx" ON "contracts"("signing_entity_id");

ALTER TABLE "signing_entities"
  ADD CONSTRAINT "signing_entities_org_id_fkey"
  FOREIGN KEY ("org_id")
  REFERENCES "organizations"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "contracts"
  ADD CONSTRAINT "contracts_signing_entity_id_fkey"
  FOREIGN KEY ("signing_entity_id")
  REFERENCES "signing_entities"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
