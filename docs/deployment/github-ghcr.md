# GitHub + GHCR Deployment

This project cannot run fully on GitHub Pages because it includes an API, worker,
PostgreSQL, Redis, and object storage. GitHub is used for source hosting, CI, and
publishing Docker images to GitHub Container Registry.

## One-time GitHub Setup

1. Create a GitHub repository, for example `your-name/erpdog`.
2. Push this project to the repository.
3. In repository settings, ensure Actions can read contents and write packages.
4. Set repository variable `NEXT_PUBLIC_API_URL` to the public API URL, for
   example `https://api.erp.example.com/api/v1`.

## CI

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`:

- install dependencies
- generate Prisma Client
- validate Prisma schema
- typecheck all workspaces
- build all apps

## GitHub Pages Preview

`.github/workflows/pages-preview.yml` builds a static export of the Web app and
publishes it to the `gh-pages` branch on every push to `main`. This preview is
meant for product walkthroughs: the Web app includes an in-browser demo mode
with seeded 2026-04 data, so it works even when no public API or database has
been deployed.

If GitHub Pages is not enabled automatically, open repository Settings -> Pages
and select "Deploy from a branch", then choose `gh-pages` and `/root`. The
expected preview URL for `codywiki/erpdog` is:

```text
https://codywiki.github.io/erpdog/
```

If a real API is available later, set repository variable `NEXT_PUBLIC_API_URL`
to the public API base URL before rebuilding the preview.

The workflow sets `NEXT_BASE_PATH=/erpdog` so Next.js asset URLs match the
repository Pages path. Change this value if the repository name or Pages path
changes.

## Image Publishing

`.github/workflows/publish-images.yml` publishes three images to GHCR:

- `erpdog-api`
- `erpdog-worker`
- `erpdog-web`

The workflow runs on pushes to `main`, version tags, or manual dispatch.

## Server Runtime

Copy `.env.production.example` to `.env.production` on the server and replace all
secrets. Then run:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production exec api corepack pnpm db:migrate
docker compose -f docker-compose.prod.yml --env-file .env.production exec api corepack pnpm db:seed
docker compose -f docker-compose.prod.yml --env-file .env.production exec api corepack pnpm db:seed:demo
```

For a single-server start, put Caddy or Nginx in front of:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- MinIO console: `http://localhost:9001`
