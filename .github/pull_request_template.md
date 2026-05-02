## Summary

-

## Scope

- [ ] API or worker behavior
- [ ] Web UI or user flow
- [ ] Database schema, seed data, or migrations
- [ ] Deployment, CI, or infrastructure
- [ ] Documentation only

## Review Checklist

- [ ] Requirements and acceptance criteria are clear.
- [ ] Permission, organization, and customer access boundaries are preserved.
- [ ] Money values, period locks, and state transitions are validated server-side.
- [ ] Migrations and seed changes are backward-safe for existing data.
- [ ] User-facing errors are understandable and do not leak sensitive details.
- [ ] Tests or manual verification cover the changed behavior.

## Verification

- [ ] `pnpm format:check`
- [ ] `pnpm -r typecheck`
- [ ] `pnpm -r build`
- [ ] `pnpm audit --audit-level moderate`

## Notes

-
