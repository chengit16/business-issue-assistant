# 项目规范采用说明

更新日期：2026 年 11 月 16 日。显式采用配置见 [project.json](project.json)，本轮整改及验收见 [规范执行记录](../docs/规范执行记录.md)。

## 选定技术栈

- [FastAPI 后端规范](standards/backend/fastapi.md)：`backend`。
- [React 前端规范](standards/frontend/react-vite.md)：`frontend`。
- 两端共同执行 [通用工程规范](standards/common/engineering.md) 与 [中文注释规范](standards/common/comments.md)。

## 项目差异与当前采用状态

- 采用仓库内 2026-11-16 提取的通用工程、中文注释、React 与 FastAPI 规范；本轮执行记录见 docs/规范执行记录.md。规范正文与 manifest.json 的原始来源指纹保持不变，PROJECT.md 和 project.json 是项目维护的采用配置。
- 保留 npm workspaces 与 package-lock.json，区别于前端规范默认 pnpm。packageManager 固定 npm@11.17.0，.node-version 记录 Node.js 24.19.0；engines 要求 Node.js >=22.12、npm >=11。
- 按用户要求落实 Zustand、UnoCSS、React Router 和 Axios。HashRouter 适配现有同源静态部署，路由装配放在 app/；跨页面客户端状态与服务端数据分离，账号切换清理业务选择和复用输入，不持久化认证秘密。
- 保留现有页面视觉与受控 styles.css，UnoCSS 已承担核心布局、面板与常规间距。Ant Design 使用 ConfigProvider Token，历史局部 .ant-* 选择器仍有保留；后续修改对应界面时继续收敛到公开语义接口，不为本轮整改整体重设计。
- 前端按页面、业务 Hook、私有交互、领域 Service 与 Store 拆分。案例列表入口约 165 行，保留同一筛选视图的装配职责；生成契约不受手写文件规模预警约束。
- FastAPI 已采用应用工厂、独立 Router、application 与 domain。共享输入和响应模型集中于 contracts/；SQLAlchemy Session、ORM 和模型适配按当前规模保留明确模块，未建立空 infrastructure/、Repository 或 UoW 包装。业务写入与幂等记录共享事务。
- 本机开发保留 SQLite，团队部署使用 PostgreSQL；两种数据库均运行完整业务测试，旧库代表性数据升级另在隔离 SQLite 验证。尚未启用 Celery/Redis、对象存储、SSE、向量检索或 OCR，按真实需求引入。
- 已配置前端格式、Lint、严格类型、Vitest、构建和契约漂移检查，后端配置 Ruff、mypy strict、pytest 与 Alembic 检查。浏览器场景为本轮实际验收，尚未纳入持久化端到端自动化门禁；真实模型供应商与正式部署验收仍待配置。

## 检查清单

在仓库根目录执行；结果及未验收环境记录在本轮执行记录中。

```bash
npm ci
npm run check
npm run check:postgres
```

`check` 包含实际契约漂移、Prettier、ESLint、TypeScript、Vitest、生产构建、Ruff 静态及格式检查、mypy strict、pytest 和 Alembic 模型漂移。前后端测试均使用合成数据；后端默认隔离 SQLite，PostgreSQL 脚本只管理本次创建的临时容器。Docker 不可用时须如实标记 PostgreSQL 未运行。

接口变更后执行 `npm run contract:generate` 同步 OpenAPI、运行时 Schema 与 TypeScript；不要直接编辑生成类型。依赖变更同步锁文件，契约漂移检查不能替代业务或浏览器验收。

## 提交策略

验证通过后只提交本任务改动；默认不推送。用户明确的提交、推送或保留工作区指令优先于默认策略；不重写既有历史。

## 来源与副本

规范及入口模板内容集合 SHA-256：`1729d3fba3709f79f376dc15d4073f7070d75bd84538df8287903af5a8692f9c`。

规范工具包来源及初始化文件指纹见 [manifest.json](manifest.json)。本轮只更新项目采用说明与配置，未改写规范正文，也未把项目更新伪装成新的上游版本；原始指纹用于追溯，项目配置的手工更新会被后续工具识别为本地差异。参考项目提交仅用于追溯规范提取依据。
