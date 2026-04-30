# Phase 0 实施清单

日期：2026-04-30  
状态：执行中  
对应技术方案：`docs/architecture/2026-04-29-erpdog-technical-architecture.md`

## 范围

本阶段只实现项目脚手架与基础设施，不进入客户、合同、账单、发票、收款、成本、付款等业务闭环开发。

## 清单

- [x] 创建 pnpm monorepo。
- [x] 创建 `apps/web` Next.js 应用骨架。
- [x] 创建 `apps/api` NestJS API 骨架。
- [x] 创建 `apps/worker` BullMQ Worker 骨架。
- [x] 创建共享配置包 `@erpdog/config`。
- [x] 创建共享契约包 `@erpdog/contracts`。
- [x] 创建共享 TypeScript 配置包 `@erpdog/tsconfig`。
- [x] 创建 Prisma schema。
- [x] 创建管理员种子脚本。
- [x] 创建 PostgreSQL、Redis、MinIO Docker Compose。
- [x] 创建环境变量模板。
- [x] 安装依赖。
- [x] 生成 Prisma Client。
- [x] 创建初始数据库迁移 SQL。
- [x] 校验 Prisma schema。
- [x] 运行类型检查。
- [x] 构建基础应用。
- [ ] 启动本地 Docker 基础设施。

## 当前边界

已实现：

- 组织、用户、角色、权限、刷新令牌、审计日志、领域事件、Outbox 事件等基础数据模型。
- API 健康检查。
- API 登录接口。
- 全局 JWT 鉴权守卫。
- Worker Outbox 队列占位处理器。
- Web 财务业务工作台静态外壳。
- 初始迁移文件：`prisma/migrations/20260430030000_init/migration.sql`。

未实现：

- 客户资料业务。
- 合同与收费规则业务。
- 账单生成业务。
- 发票、收款、成本、付款审批业务。
- 月结锁账业务。
- 飞书集成。

## 验证记录

- `pnpm.cmd --dir E:\Codex\Cody\erpdog install`：通过。
- `pnpm.cmd --dir E:\Codex\Cody\erpdog db:generate`：通过。
- `prisma validate --schema prisma/schema.prisma`：通过。
- `pnpm.cmd --dir E:\Codex\Cody\erpdog typecheck`：通过。
- `pnpm.cmd --dir E:\Codex\Cody\erpdog build`：通过。
- `docker compose -f docker-compose.yml config`：通过，Docker 配置语法有效。
- `pnpm.cmd --dir E:\Codex\Cody\erpdog infra:up`：未通过；当前机器 Docker Desktop/daemon 未运行或不可访问，错误为 `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`。
