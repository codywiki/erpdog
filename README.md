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
pnpm.cmd dev
```

当前已有文档：

- `docs/plans/2026-04-29-internal-erp-prd.md`：内部小型 ERP 系统 PRD 初稿。
- `docs/architecture/2026-04-29-erpdog-technical-architecture.md`：erpdog 技术架构方案。
- `docs/adr/`：关键技术决策记录。
- `docs/plans/2026-04-30-phase-0-implementation.md`：Phase 0 实施清单。
- `docs/plans/2026-04-30-business-core-implementation.md`：业务核心闭环实现记录。

## 当前业务能力

- 客户、联系人、开票资料、负责人绑定和客户级数据权限。
- 合同、收费项、收费模板和合同导入。
- 增值服务、代垫费用、月度账单生成、账单状态流、客户确认、调整和作废。
- 发票/收款独立对象和到账单的金额分摊。
- 成本、应付、付款申请、审批、付款登记和应付余额更新。
- 月度结账/解锁、审计日志、附件元数据、客户利润和负责人排行报表。
- Worker 支持账单生成队列和 Outbox 处理占位，后续可接飞书适配器。
