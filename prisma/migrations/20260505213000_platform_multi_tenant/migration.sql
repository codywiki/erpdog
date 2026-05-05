-- Add platform-level multi-tenant fields.
ALTER TABLE "organizations" ADD COLUMN "is_platform" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "phone" TEXT;

-- Super administrators and tenant administrators use phone login, while legacy
-- email login remains supported for existing accounts.
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- Rename the original administrator role for tenant-scoped usage.
UPDATE "roles"
SET "name" = '租户管理员'
WHERE "code" = 'admin';

-- Platform permission must stay on the platform super-admin role only.
DELETE FROM "role_permissions" AS rp
USING "roles" AS r, "permissions" AS p
WHERE rp."role_id" = r."id"
  AND rp."permission_id" = p."id"
  AND p."code" = 'tenant.manage'
  AND r."code" <> 'super_admin';
