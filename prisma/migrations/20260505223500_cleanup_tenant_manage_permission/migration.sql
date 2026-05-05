-- Keep tenant-scoped roles out of platform management even if older seed data
-- granted tenant.manage before the platform role split existed.
DELETE FROM "role_permissions" AS rp
USING "roles" AS r, "permissions" AS p
WHERE rp."role_id" = r."id"
  AND rp."permission_id" = p."id"
  AND p."code" = 'tenant.manage'
  AND r."code" <> 'super_admin';
