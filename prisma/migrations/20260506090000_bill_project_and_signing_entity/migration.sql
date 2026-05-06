ALTER TABLE "bills" ADD COLUMN "signing_entity_id" TEXT;

UPDATE "bills" AS "b"
SET "signing_entity_id" = "c"."signing_entity_id"
FROM "contracts" AS "c"
WHERE "b"."contract_id" = "c"."id"
  AND "b"."signing_entity_id" IS NULL;

CREATE INDEX "bills_signing_entity_id_idx" ON "bills"("signing_entity_id");

ALTER TABLE "bills"
ADD CONSTRAINT "bills_signing_entity_id_fkey"
FOREIGN KEY ("signing_entity_id")
REFERENCES "signing_entities"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
