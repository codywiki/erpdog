# erpdog

erpdog 是面向服务型业务的小型 ERP 项目。目标很明确：把客户、合同、账单、结算、成本、付款和利润放进一条可追踪、可复核、可沉淀的业务流程。

服务型公司早期靠 Excel、聊天记录和人工对账就能运转。客户变多、合同规则变复杂、结算周期变长后，问题会很快冒出来：客户归属不清、合同口径不稳、账单计算易错、发票回款难对齐、成本利润靠月底拼表。erpdog 先处理高频、具体、影响现金流的问题。

## 解决什么问题

宏观上，erpdog 管的是服务型业务的经营闭环。客户、合同、账单、结算、成本、付款、利润进入同一套数据和流程。

微观上，erpdog 减少日常操作里的高频错误：客户重复建档、合同规则记错、账单口径不一致、附件找不到、发票和回款对不上、权限边界不清。

适合场景：长期服务合同、按月结算、客户确认后开票收款、基础费用加激励/服务费、成本付款审批、月结复盘。

## 主要功能

- 客户与签约主体：管理客户档案、我方签约主体、联系人、开票信息和客户负责人。
- 合同与规则：沉淀合同周期、合同附件、基础费用、激励单价、服务费比例和阶梯规则。
- 月度账单：按客户、账期、合作内容和数量生成账单，关联合同规则进入结算流程。
- 客户确认与财务结算：支持盖章结算单、发票、银行回单和回款到账记录。
- 成本与付款：记录成本、生成应付、发起付款申请、审批和登记付款。
- 权限与审计：内部用户、角色权限、客户级数据权限、操作日志和登录态管理。
- 月结与报表：账期关闭/解锁，客户利润、负责人排行和 Excel 导出。
- 附件与导入导出：支持 S3 兼容对象存储、预签名上传下载、Excel 模板和批量导入。

## 技术架构

erpdog 采用 Web / API / Worker / Database 分层。技术选型优先考虑成熟、稳定、好部署、好接手。

- Web：Next.js + React + TypeScript
- API：NestJS + TypeScript
- Worker：BullMQ + Redis
- Database：PostgreSQL + Prisma
- File Storage：S3 兼容对象存储，例如 MinIO
- Infra：Docker Compose、GitHub Actions、GHCR

架构分工清晰：前端负责高频业务操作，API 负责权限、状态流和金额校验，Worker 承接异步任务，PostgreSQL 保存核心业务事实，对象存储保存合同和结算附件。系统可以先让几个人用起来，再逐步扩到团队长期使用。

## 扩展性

项目按业务模块拆分。客户、合同、账单、财务、权限、附件、报表都有清晰边界。后续可以继续扩展：

- 接入飞书、企业微信、邮件等通知和审批入口。
- 增加更细的合同计费模板、成本归集和利润分析维度。
- 接入第三方发票、银行流水或财务软件。
- 把 Worker 扩展为定时账单、异常提醒、Outbox 事件投递和数据同步中心。
- 逐步把业务规则从页面操作沉淀为可复用的领域服务和审计事件。

erpdog 可以先作为内部 ERP 落地使用，再跟随真实业务复杂度逐步增长，避免一开始被重型系统拖慢。

## AI 前景

erpdog 的 AI 方向很实际：基于真实业务数据、合同规则、账单状态和审计记录，提供能落地的业务辅助能力。

比较现实的 AI 演进方向包括：

- 合同理解：自动读取合同附件，提取周期、费用、结算规则和风险点。
- 账单辅助：根据合同和本月业务明细生成账单草稿，并解释计算依据。
- 对账检查：发现发票、回款、账单、成本之间的不一致。
- 经营问答：用自然语言查询“某个客户本季度利润如何”“哪些账单还没回款”。
- 风险提醒：识别超期未确认、超期未回款、异常毛利和重复客户。
- 流程助手：在创建客户、合同、账单、结账时给出下一步建议。

AI 能力需要扎实的数据结构、流程状态、权限和审计基础。erpdog 当前架构正在为长期演进打底。

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

完整部署至少包含 Web、API、Worker、PostgreSQL、Redis、S3 兼容对象存储和反向代理。生产环境需要替换 `JWT_SECRET`、管理员初始密码，并将 `NEXT_PUBLIC_API_URL` 指向生产 API。

更多部署说明见 `docs/deployment/github-ghcr.md`。

## 工程质量

项目内置 GitHub Actions、业务 e2e、依赖审计和代码审查门禁。提交前建议执行：

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
