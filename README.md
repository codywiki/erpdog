# erpdog

erpdog 是内部使用的小型 ERP 系统，第一阶段聚焦长期服务型业务的客户、合同、账单、发票、收款、成本、应付、付款审批、锁账和利润统计闭环。

## 目录约定

所有与 erpdog 相关的产品文档、设计文档、代码、配置、脚本和测试文件都应放在本目录下。

## 技术栈

- Web：Next.js + React + TypeScript
- API：NestJS + TypeScript
- Worker：BullMQ + Redis
- Database：PostgreSQL + Prisma
- File Storage：S3 兼容对象存储
- Local Infra：Docker Compose

## 本地启动

```powershell
pnpm.cmd install
Copy-Item .env.example .env
pnpm.cmd infra:up
pnpm.cmd db:generate
pnpm.cmd db:migrate
pnpm.cmd db:seed
pnpm.cmd db:seed:demo
pnpm.cmd dev
```

## 线上预览

推送到 `main` 后，`.github/workflows/pages-preview.yml` 会构建 Web 静态预览并发布到 `gh-pages` 分支。预览页内置“进入演示”模式，可以在没有数据库和 API 的情况下查看 2026-04 的客户、合同、账单、收款、付款申请和利润数据。

若仓库没有自动启用 Pages，在 Settings → Pages 中将 Source 设为 **Deploy from a branch**，Branch 选择 `gh-pages` / `/root`。部署完成后的地址通常是：

```text
https://codywiki.github.io/erpdog/
```

如果仓库名不是 `erpdog`，同步调整 `.github/workflows/pages-preview.yml` 里的 `NEXT_BASE_PATH`。

当前已有文档：

- `docs/plans/2026-04-29-internal-erp-prd.md`：内部小型 ERP 系统 PRD 初稿。
- `docs/architecture/2026-04-29-erpdog-technical-architecture.md`：erpdog 技术架构方案。
- `docs/adr/`：关键技术决策记录。
- `docs/plans/2026-04-30-phase-0-implementation.md`：Phase 0 实施清单。
- `docs/plans/2026-04-30-business-core-implementation.md`：业务核心闭环实现记录。
- `docs/process/code-review.md`：代码审查流程、质量门禁和合并策略。
- `docs/process/formal-operations.md`：正式部署启用、月度业务流程和角色分工。

## 当前业务能力

- 客户、联系人、开票资料、负责人绑定和客户级数据权限。
- 客户/合同 Excel 模板、Excel 导入、合同收费项批量导入。
- 增值服务、代垫费用、月度账单生成、账单状态流、客户确认、调整和作废。
- 发票/收款独立对象和到账单的金额分摊。
- 成本、应付、付款申请、审批、付款登记和应付余额更新。
- S3 兼容附件预签名上传/下载、附件权限校验、附件元数据。
- 月度结账/解锁、审计日志、客户利润和负责人排行报表及 Excel 导出。
- Worker 支持账单生成队列和 Outbox 处理占位，后续可接飞书适配器。

## 代码审查

提交 PR 前建议执行：

```bash
pnpm db:generate
pnpm exec prisma validate --schema prisma/schema.prisma
pnpm format:check
pnpm -r typecheck
pnpm -r build
pnpm audit --audit-level moderate
```

涉及后端业务流时，在本地 PostgreSQL 可用后额外执行：

```bash
pnpm exec prisma migrate deploy --schema prisma/schema.prisma
pnpm test:e2e
```

PR 会自动触发 `Code Review Gate` 工作流，并使用 `.github/pull_request_template.md` 中的业务、权限、金额、锁账和用户体验清单完成审查。该工作流也会启动 PostgreSQL、应用迁移并跑完整业务 e2e。

## 正式使用

GitHub Pages 预览只用于查看界面和演示数据。实际业务使用需要部署完整 Web、API、Worker、PostgreSQL、Redis 和对象存储，并把 Web 的 `NEXT_PUBLIC_API_URL` 指向生产 API。上线后按 `docs/process/formal-operations.md` 的步骤完成初始化、客户合同导入、月度账单、开票收款、成本付款和锁账流程。

## 预览数据

本地或预览环境执行 `pnpm db:seed:demo` 会写入一组 2026-04 演示业务数据，包含示例客户、合同、账单、收款、成本、应付和付款申请。管理员账号仍由 `pnpm db:seed` 根据 `.env` 里的 `ADMIN_EMAIL` / `ADMIN_PASSWORD` 创建。
