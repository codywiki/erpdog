FROM node:22-alpine AS web

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

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

RUN corepack pnpm --filter @erpdog/contracts build
RUN corepack pnpm --filter @erpdog/web build

EXPOSE 3000

CMD ["corepack", "pnpm", "--filter", "@erpdog/web", "start"]
