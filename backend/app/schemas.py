"""校验 HTTP 输入与模型结构化输出，未知字段默认拒绝，状态转换仍由业务用例校验。"""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

Business = Literal["订单售后", "营销活动", "系统支持"]


class Input(BaseModel):
    """收紧输入边界，去除业务文本首尾空白并拒绝额外字段。"""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class LoginInput(Input):
    """验证登录凭证的长度，口令保留原始空白语义。"""

    email: str = Field(min_length=3, max_length=255)
    password: Annotated[str, StringConstraints(strip_whitespace=False)] = Field(
        min_length=1, max_length=256
    )


class UserInput(Input):
    """验证管理员创建账号的角色与业务范围，实际授权另行核验。"""

    email: str = Field(min_length=3, max_length=255)
    name: str = Field(min_length=1, max_length=80)
    password: Annotated[str, StringConstraints(strip_whitespace=False)] = Field(
        min_length=10, max_length=256
    )
    role: Literal["member", "handler", "maintainer"] = "member"
    businesses: list[Business] = Field(min_length=1)


class DraftContent(Input):
    """规范草稿的业务字段，缺失事实留空，由处理人补充。"""

    title: str = Field(min_length=2, max_length=160)
    symptom: str = Field(min_length=2, max_length=10000)
    conditions: str = Field(default="", max_length=10000)
    investigation: str = Field(default="", max_length=10000)
    cause: str = Field(default="", max_length=10000)
    solution: str = Field(default="", max_length=10000)
    verification: str = Field(default="", max_length=10000)


class DraftInput(DraftContent):
    """将可编辑草稿绑定到已授权的原始材料。"""

    source_id: str


class Advice(Input):
    """限定模型可返回的建议字段，引用列表仍由服务端确定。"""

    summary: str = Field(min_length=1, max_length=5000)
    steps: list[str] = Field(min_length=1, max_length=12)
    missing: list[str] = Field(max_length=10)
    reply: str = Field(min_length=1, max_length=5000)


class CaseUpdate(Input):
    """要求预期版本及独立状态字段，服务层核验转换和验证证据。"""

    version: int = Field(ge=1)
    title: str = Field(min_length=2, max_length=160)
    symptom: str = Field(min_length=2, max_length=10000)
    conditions: str = Field(max_length=10000)
    investigation: str = Field(max_length=10000)
    cause: str = Field(max_length=10000)
    solution: str = Field(max_length=10000)
    verification: str = Field(max_length=10000)
    publication: Literal["draft", "pending", "published", "archived"]
    validity: Literal["unverified", "verified", "invalid"]


class AnalysisInput(Input):
    """接收所属业务、问题与可选材料编号，读取材料前复核归属。"""

    text: str = Field(min_length=4, max_length=10000)
    business: Business
    source_id: str | None = None


class FeedbackInput(Input):
    """要求实际处理结果及说明，状态含义独立于案例有效性。"""

    outcome: Literal["resolved", "unresolved", "not_applicable"]
    note: str = Field(min_length=2, max_length=5000)

    @field_validator("note")
    @classmethod
    def meaningful_note(cls, value):
        if len(value.strip()) < 2:
            raise ValueError("请补充实际操作和处理结果")
        return value
