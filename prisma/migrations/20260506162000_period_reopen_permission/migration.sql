INSERT INTO "permissions" ("id", "code", "name", "description")
VALUES (
  'perm-period-reopen',
  'period.reopen',
  '打开账期',
  '手动打开已关闭账期，允许继续新增和调整业务记录'
)
ON CONFLICT ("code") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description";

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" AS r
JOIN "organizations" AS o ON o."id" = r."org_id"
JOIN "permissions" AS p ON p."code" = 'period.reopen'
WHERE o."is_platform" = false
  AND r."code" IN ('admin', 'owner')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

DELETE FROM "role_permissions" AS rp
USING "roles" AS r, "permissions" AS p
WHERE rp."role_id" = r."id"
  AND rp."permission_id" = p."id"
  AND p."code" = 'period.reopen'
  AND r."code" NOT IN ('admin', 'owner');
