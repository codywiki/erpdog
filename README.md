# erpdog

erpdog 是面向长期服务型业务的小型 ERP 系统，聚焦从客户建档、我方签约主体、合同规则、客户月账单、客户确认、发票、回款、成本、应付、付款审批到月结利润统计的正式业务闭环。

当前版本已经从纯预览 demo 进入可连接真实后端和数据库的正式系统形态，适合部署为内部业务工具使用。线上示例地址：

```text
http://47.92.160.116
```

## 核心能力

- 客户管理：客户编码按 `KH001` 顺序自动生成，支持客户简称、客户全称、负责人、联系人和开票资料维护，并在新增时校验历史客户重复。
- 签约主体管理：主体编号按 `ZT001` 顺序自动生成，支持主体简称、主体全称、法人姓名和纳税人类型维护。
- 合同管理：合同编号按 `HT + 年份 + 3 位序号` 自动生成，例如 `HT26001`；合同关联客户和我方签约主体，支持合同周期、PDF 合同附件、基础费用、激励单价、服务费比例和阶梯规则说明。
- 账单中心：业务负责人按客户、账期、合作内容和数量生成客户月账单，账单关联合同规则，并支持发送客户确认、上传盖章结算单、关联发票、上传银行回单和确认回款到账。
- 应收结算：发票、收款独立建档，并按金额分摊到账单，防止超额开票和超额收款。
- 成本付款：支持成本记录、应付生成、付款申请、审批、付款登记和应付余额更新。
- 结账报表：支持账期关闭和解锁，提供客户利润、负责人排行和 Excel 导出。
- 权限与审计：支持内部用户、角色权限、客户级数据权限、审计日志和 30 天登录态；后端会在每次请求时回查用户启用状态和最新权限。
- 附件能力：支持 S3 兼容对象存储预签名上传/下载；合同附件限制为 PDF 且单个文件小于 20 MB。
- 工程质量：内置 CI、业务 e2e、依赖审计和代码审查门禁。

## 技术栈

- Web：Next.js + React + TypeScript
- API：NestJS + TypeScript
- Worker：BullMQ + Redis
- Database：PostgreSQL + Prisma
- File Storage：S3 兼容对象存储
- Local / Production Infra：Docker Compose、GHCR、GitHub Actions

## 本地启动

```bash
corepack pnpm install
cp .env.example .env
corepack pnpm infra:up
corepack pnpm db:generate
corepack pnpm db:migrate
corepack pnpm db:seed
corepack pnpm dev
```

本地需要可用的 PostgreSQL、Redis 和对象存储。`pnpm infra:up` 会通过 Docker Compose 启动本地依赖。

## 正式部署

完整部署至少包含：

- Web 静态页面或 Web 容器
- API 服务
- Worker 服务
- PostgreSQL
- Redis
- S3 兼容对象存储
- 反向代理，例如 Caddy 或 Nginx

生产环境需要设置 `.env.production`，并确保：

- `JWT_SECRET` 已替换为强随机值。
- `ADMIN_PASSWORD` 已替换为强密码。
- `NEXT_PUBLIC_API_URL` 指向生产 API，例如 `http://47.92.160.116/api/v1`。
- S3/MinIO 配置完整，合同和结算附件可以上传。

更多部署说明见 `docs/deployment/github-ghcr.md`。

## GitHub 工作流

- `CI`：在 `main` 推送和 PR 时执行 Prisma Client 生成、类型检查、构建、数据库迁移和业务 e2e。
- `Code Review Gate`：PR 代码审查门禁，额外执行格式检查、空白检查、业务 e2e 和依赖审计。
- `Pages Preview`：构建 Web 静态页面并发布到 `gh-pages`，用于连接已配置 API 的 Web 入口。
- `Publish Images`：构建并推送 API、Worker、Web 镜像到 GitHub Container Registry。

## 代码审查

提交 PR 前建议执行：

```bash
corepack pnpm db:generate
DATABASE_URL="postgresql://user:pass@localhost:5432/erpdog" corepack pnpm exec prisma validate --schema prisma/schema.prisma
corepack pnpm format:check
corepack pnpm -r typecheck
corepack pnpm -r build
corepack pnpm audit --audit-level moderate
```

涉及后端业务流时，在本地 PostgreSQL 可用后额外执行：

```bash
corepack pnpm exec prisma migrate deploy --schema prisma/schema.prisma
corepack pnpm test:e2e
```

代码审查流程和清单见 `docs/process/code-review.md`。

## 文档

- `docs/plans/2026-04-29-internal-erp-prd.md`：内部小型 ERP 系统 PRD 初稿。
- `docs/architecture/2026-04-29-erpdog-technical-architecture.md`：技术架构方案。
- `docs/adr/`：关键技术决策记录。
- `docs/process/code-review.md`：代码审查流程、质量门禁和合并策略。
- `docs/process/formal-operations.md`：正式部署启用、月度业务流程和角色分工。
- `docs/deployment/github-ghcr.md`：GitHub Actions、GHCR 和服务器部署说明。

## 开源协议

本项目采用 GNU Affero General Public License v3.0 only（GNU AGPLv3，SPDX：`AGPL-3.0-only`）开源协议。详见仓库根目录 `LICENSE` 以及 GNU 官方协议文本：

```text
https://www.gnu.org/licenses/agpl-3.0.html
```
