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

## 项目执行与验收

2026 年 11 月 16 日已按项目规范完成一轮工程整改。当前前端使用 Zustand、UnoCSS、React Router 与 Axios；后端采用应用工厂、明确用例和领域规则，前后端契约由实际 OpenAPI 生成。

具体采用差异与命令以 [.ai-dev-standards/PROJECT.md](.ai-dev-standards/PROJECT.md) 为准；实际检查、数据库及页面验收结果见 [docs/规范执行记录.md](docs/规范执行记录.md)。新增或修改职责仍须补充中文文件头、公开接口、必要字段与复杂流程说明，不把一次验收当作后续免检。
