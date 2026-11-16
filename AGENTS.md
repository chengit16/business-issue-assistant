<!-- AI-DEV-STANDARDS:BEGIN -->
## 项目开发规范入口

开始修改前，先阅读 [项目采用说明](.ai-dev-standards/PROJECT.md)，再按修改范围读取以下规范。这里的路径均相对仓库根目录。

- 所有修改必读 [通用工程规范](.ai-dev-standards/standards/common/engineering.md) 和 [中文注释规范](.ai-dev-standards/standards/common/comments.md)。
- 修改 backend 下的 fastapi 职责时，必读 [fastapi 规范](.ai-dev-standards/standards/backend/fastapi.md)。
- 修改 frontend 下的 react-vite 职责时，必读 [react-vite 规范](.ai-dev-standards/standards/frontend/react-vite.md)。

- 本区块以外的项目约定、适用子目录规则及当前用户指令一并执行；已确认的项目差异见采用说明，不能用默认选型覆盖已有有效约定。
- 跨端契约或流程修改同时读取相关前后端规范；注释必须包含共用要求和技术栈具体要求。
- 完成后按采用说明运行适用检查，如实报告通过、失败、未运行及待实际验收的场景；未配置的检查不能声称通过。
- 提交范围和策略遵循采用说明；工具生成文件不代表宿主已经加载，首次使用须在新会话核对读取情况。
<!-- AI-DEV-STANDARDS:END -->

## 本次接入验收补充

2026 年 11 月 16 日验收复核时，既有业务代码仍在并行更新。frontend/src 中的 TS/TSX 已补充中文 @description 文件头，backend/app 中的 Python 模块已补充中文模块 docstring。项目采用说明及 project.json 的差异记录保留初始化核对时点的状态，其中关于文件头、模块说明缺失及具体文件行数的描述需结合当前代码复核。

公开声明、字段语义、复杂流程阶段编号与完整类型标注仍按实际修改范围检查。页面和路由文件的规模、领域 Service、响应运行时校验、后端严格类型检查及真实 PostgreSQL 验收仍有待整改事项，详见项目采用说明。
