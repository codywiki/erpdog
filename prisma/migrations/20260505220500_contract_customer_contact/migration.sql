-- Store the customer's contract-facing contact text, for example name + phone.
ALTER TABLE "contracts" ADD COLUMN "customer_contact_text" TEXT NOT NULL DEFAULT '';
