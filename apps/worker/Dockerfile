FROM node:22-alpine AS worker

WORKDIR /app

ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://erpdog:erpdog@postgres:5432/erpdog?schema=public

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json

RUN corepack pnpm install --frozen-lockfile

COPY . .

RUN corepack pnpm db:generate
RUN corepack pnpm --filter @erpdog/config build
RUN corepack pnpm --filter @erpdog/worker build

CMD ["node", "apps/worker/dist/main.js"]
