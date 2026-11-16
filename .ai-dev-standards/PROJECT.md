# 项目规范采用说明

本文件由初始化工具生成。显式采用配置见 [project.json](project.json)，来源内容指纹与受管文件见 [manifest.json](manifest.json)。

## 选定技术栈

- [fastapi](standards/backend/fastapi.md)：backend
- [react-vite](standards/frontend/react-vite.md)：frontend

## 项目差异

- 现状依据为 package.json、frontend/package.json、frontend/tsconfig.json、backend/pyproject.toml、package-lock.json、backend/uv.lock 和当前代表性代码。README.md 记录已实现工程，docs/项目决策记录.md 的部分技术建议仍处于规划口径，实际运行与检查入口以配置和代码为准。接入时既有 README 修改及未跟踪工程文件属于此前工作，规范提交只包含 AGENTS.md 与 .ai-dev-standards/。
- 前端现状为 React 19、TypeScript 5.9、Vite 7、Ant Design 6，后端为 Python \>=3.12、FastAPI、Pydantic 2、SQLAlchemy 2、Alembic 和 uv。前端已通过 ConfigProvider 集中配置中文和主题，TypeScript 已启用 strict、noUnusedLocals 和 noUnusedParameters；这些配置继续有效。
- 相对 standards/frontend/react-vite.md 的固定选型，项目按根 package.json 使用 npm workspaces 和 package-lock.json，当前 npm 11、Node.js 24 可运行，README 要求 Node.js \>=22.12。沿用 npm；packageManager 与 Node.js/npm 版本固定尚未配置，待按团队运行环境补齐。
- 前端以 src/styles.css 和 :root 变量维护样式，现有 TS/TSX 使用单引号及无分号风格，尚未配置 UnoCSS、ESLint 或 Prettier。沿用现有风格；styles.css 存在直接覆盖 .ant-\* 的选择器，待实际修改相关组件时评估公开 Token、语义样式接口及作用域收敛。
- 前端导航沿用 App.tsx 的 location.hash、hashchange 与组件局部状态，未引入 React Router 或 Zustand。当前尚无统一 URL 路由参数及领域 Store；后续深链、筛选恢复或共享状态需求形成时再采用相应方案，并保护既有导航和账号切换行为。
- HTTP 继续统一经过 frontend/src/api.ts 的 fetch Client，页面和 useLoad.ts 目前直接调用该 Client，尚未拆分领域 Service，也未使用 Axios。Client 采用同源 Cookie 和后端 detail 错误结构；通用泛型返回缺少响应运行时校验、统一超时与 AbortSignal 约束。后续按实际接口改动补领域 Service、解码和取消边界，useLoad 当前通过 active 标记隔离旧响应。
- 前端当前采用 src 下的扁平页面结构，App.tsx 350 行、Assistant.tsx 超过 500 行，部分文件包含多个导出组件；相对通用规模预警与页面职责要求存在拆分欠账。后续按登录壳、业务交互和页面 Hook 的真实职责渐进整理；已有按页面 lazy 加载。当前构建主包约 738 kB，Vite 提示超过 500 kB，待结合依赖体积评估进一步拆包。
- 前端 tsconfig 尚未启用 noFallthroughCasesInSwitch；现有入口含非空断言。TypeScript 类型检查与生产构建具备真实入口，前端格式检查、Lint、单元测试及浏览器自动化测试均未配置，不能用类型检查或后端测试替代这些验收。后续先实现并验证入口，再列为必跑项。
- 相对 standards/backend/fastapi.md 的严格类型要求，backend/pyproject.toml 尚未声明 mypy 或配置后端类型检查，部分公开函数缺少完整类型标注。当前仅登记可用的 Ruff 与 pytest，后端 mypy 检查和独立打包构建入口作为待整改项；前端 typecheck 不代表后端类型已通过。
- 后端使用 app/main.py 的模块级 FastAPI 实例集中声明路由，app/services.py 编排业务并直接使用 SQLAlchemy Session，尚未形成应用工厂、独立 Router 及按需的 api/application/domain/infrastructure 边界。main.py 超过 Router 规模预警上限；按资源和用例逐步拆分，并显式维护授权、幂等及事务归属。
- 后端请求 Schema 已限制 extra 字段，现有接口多直接返回字典与 ORM 投影，未完整声明 response\_model、稳定 operation\_id、统一业务错误 code 和请求 ID。前端手写 types.ts 与后端 Schema 并行维护，尚未从 OpenAPI 同步类型。沿用已有 detail 契约，后续修改接口时同步前后端并补充契约测试。
- 本地数据库沿用 SQLite，README 与 compose.yaml 提供 PostgreSQL 方案；结构变更已采用 Alembic。当前 pytest 使用隔离临时 SQLite 并执行迁移，外部模型调用使用可控替身。PostgreSQL 真实约束、代表性旧数据升级和真实模型供应商验收仍待完成；尚未启用 Celery/Redis、对象存储或 SSE，按实际需求接入。
- 后端 Ruff 已配置 100 列，当前静态与格式检查命令均可运行；未扩展 Ruff 的类型、文档或注释语义规则。依赖同时声明 httpx 与 httpx2，应用及测试代码当前导入 httpx，待依赖整理时核对 httpx2 的保留必要性。
- 现有 TS/TSX 尚缺规范要求的中文 @description 文件头及公开声明 JSDoc，部分 Python 模块和公开函数缺少中文 docstring、字段说明及复杂流程阶段注释。按 common/comments.md 和对应技术栈规范，在后续实际修改职责、行为或契约的范围渐进补齐；本次只建立规范记录。

## 检查清单

命令由采用配置提供，仅表示已登记；初始化没有执行它们。按改动确定适用项，运行后记录真实结果。

- 前端 TypeScript 类型检查；工作目录：.

    参数数组：\["npm", "run", "typecheck"\]

- 前端生产构建；工作目录：.

    参数数组：\["npm", "run", "build"\]

- 后端 Ruff 静态检查；工作目录：backend

    参数数组：\["uv", "run", "ruff", "check", "app", "tests", "alembic"\]

- 后端 Ruff 格式检查；工作目录：backend

    参数数组：\["uv", "run", "ruff", "format", "--check", "app", "tests", "alembic"\]

- 后端 pytest 测试；工作目录：backend

    参数数组：\["uv", "run", "pytest", "-q"\]


## 提交策略

验证通过后只提交本任务改动；默认不推送。
当前明确指令优先于规范中的默认策略。

## 来源与副本

规范及入口模板内容集合 SHA-256：1729d3fba3709f79f376dc15d4073f7070d75bd84538df8287903af5a8692f9c
规范正文中的参考项目提交用于追溯提取依据；工具包来源信息见 manifest.json。
随附规范可能包含为保持相对链接有效而带入的文档；只有上述选定技术栈默认适用。
项目内容全部使用仓库内相对引用。工具包更新不自动改写本项目；手工修改后再次执行会检测差异并停止覆盖。
