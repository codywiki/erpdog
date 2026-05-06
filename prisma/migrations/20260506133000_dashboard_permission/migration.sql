INSERT INTO "permissions" ("id", "code", "name", "description")
VALUES (
  'perm-dashboard-view',
  'dashboard.view',
  '经营总览',
  '查看经营总览菜单和页面内容'
)
ON CONFLICT ("code") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description";

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" AS r
JOIN "organizations" AS o ON o."id" = r."org_id"
JOIN "permissions" AS p ON p."code" = 'dashboard.view'
WHERE o."is_platform" = false
  AND r."code" IN ('admin', 'owner', 'finance', 'business_owner')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
