ALTER TABLE "customers" ADD COLUMN "full_name" TEXT;

UPDATE "customers"
SET "full_name" = "name"
WHERE "full_name" IS NULL;

CREATE INDEX "customers_full_name_idx" ON "customers"("full_name");
