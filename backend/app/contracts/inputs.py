"""校验 HTTP 输入并显式转换业务命令，拒绝协议以外的字段。"""

from typing import Annotated

from pydantic import Field, SecretStr, StringConstraints

from ..domain.commands import AnalysisCommand, CaseChanges, Command, DraftContent, FeedbackCommand
from ..domain.types import AnalysisMode, Business, Role


class LoginInput(Command):
    """验证登录凭证长度，口令保留原始空白语义。"""

    email: str = Field(min_length=3, max_length=255, description="登录邮箱")
    password: Annotated[str, StringConstraints(strip_whitespace=False)] = Field(
        min_length=1, max_length=256, description="原始口令，只在认证时使用"
    )


class UserInput(Command):
    """维护人创建账号的协议输入，授予范围不得超出本人业务权限。"""

    email: str = Field(min_length=3, max_length=255, description="唯一登录邮箱")
    name: str = Field(min_length=1, max_length=80, description="工作台显示名称")
    password: Annotated[str, StringConstraints(strip_whitespace=False)] = Field(
        min_length=10, max_length=256, description="初始口令，仅保存摘要"
    )
    role: Role = Field(default="member", description="默认创建普通业务同事")
    businesses: list[Business] = Field(min_length=1, description="允许访问的业务列表")


class DraftInput(DraftContent):
    """将案例事实绑定到本人已提交的原始材料。"""

    source_id: str = Field(description="原始材料稳定编号")


class CaseUpdate(CaseChanges):
    """携带预期版本的完整编辑请求，旧版本不得覆盖并发修改。"""

    version: int = Field(ge=1, description="编辑开始时读取的案例版本")


class AnalysisInput(AnalysisCommand):
    """HTTP 分析输入，应用层仅接收转换后的业务命令。"""


class FeedbackInput(FeedbackCommand):
    """HTTP 反馈输入，实际结果不会自动改变案例验证状态。"""


class ModelConnectionInput(Command):
    """待测试的团队连接，仅在请求体内接收新密钥。"""

    address: str = Field(default="", max_length=2048, description="模型接口基础地址")
    model: str = Field(default="", max_length=200, description="供应商配置的模型名称")
    api_key: SecretStr | None = Field(
        default=None, max_length=4096, description="同地址留空复用已有密钥"
    )
    version: int = Field(ge=0, description="读取配置时的版本，环境变量初始版本为 0")


class ModelSettingsInput(ModelConnectionInput):
    """保存运行方式，模型模式要求提供同一组参数的有效测试凭证。"""

    mode: AnalysisMode
    test_token: SecretStr | None = Field(default=None, max_length=2048)
