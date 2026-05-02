# Code Review Process

Every production change should go through a pull request unless it is an emergency hotfix. The review goal is to catch business-rule drift, security regressions, and deployment risk before changes reach `main`.

## Required checks

Run these locally before requesting review:

```bash
pnpm db:generate
pnpm exec prisma validate --schema prisma/schema.prisma
pnpm format:check
pnpm -r typecheck
pnpm -r build
pnpm audit --audit-level moderate
```

For backend workflow changes, also run the full business e2e when PostgreSQL is available:

```bash
pnpm exec prisma migrate deploy --schema prisma/schema.prisma
pnpm test:e2e
```

The GitHub `Code Review Gate` workflow runs formatting, whitespace, typecheck, build, dependency audit, database migrations, and the business e2e flow on pull requests.

## Reviewer checklist

- Confirm the PR states the business requirement and changed user flow.
- Check organization, customer, role, and permission boundaries for every API change.
- Check money calculations use `Prisma.Decimal` helpers and reject impossible totals.
- Check bill, invoice, receipt, payable, and payment transitions respect locked periods.
- Check migrations preserve existing data and seed scripts still work.
- Check user-facing errors are actionable without exposing sensitive internals.
- Check preview or screenshots for user-facing UI changes.
- Check Excel import/export and attachment changes against the formal operations guide when those surfaces are touched.

## Merge policy

- At least one reviewer should approve before merging.
- `CI`, `Code Review Gate`, `Publish Images`, and `Pages Preview` should be green for `main`.
- If a hotfix must bypass review, create a follow-up PR that documents the incident, verifies the fix, and closes any skipped checklist items.
