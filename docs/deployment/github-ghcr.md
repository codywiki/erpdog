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
```

For a single-server start, put Caddy or Nginx in front of:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- MinIO console: `http://localhost:9001`
