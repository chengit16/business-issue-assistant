"""定义用户、原始材料、案例版本与分析运行的关系型存储，使用稳定编号保留追溯关系。"""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import JSON, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def identifier() -> str:
    """生成可跨材料、案例和运行引用的稳定随机编号。"""
    return str(uuid4())


def timestamp() -> str:
    """以带 UTC 时区的 ISO 8601 字符串记录业务时间。"""
    return datetime.now(UTC).isoformat()


class User(Base):
    """保存账号、角色和可访问业务，公开响应排除口令摘要。"""

    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    role: Mapped[str] = mapped_column(String(20), default="member")
    businesses: Mapped[list] = mapped_column(JSON, default=list)
    password_hash: Mapped[str] = mapped_column(Text)


class LoginSession(Base):
    """保存会话令牌摘要与到期时间，不保存可直接登录的原始令牌。"""

    __tablename__ = "login_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    expires_at: Mapped[float]


class Source(Base):
    """保留不可变原始文本及可选附件，材料读取继承业务授权。"""

    __tablename__ = "sources"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    business: Mapped[str] = mapped_column(String(80))
    text: Mapped[str] = mapped_column(Text)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    attachment_name: Mapped[str | None] = mapped_column(String(255))
    attachment_path: Mapped[str | None] = mapped_column(Text)
    attachment_type: Mapped[str | None] = mapped_column(String(40))
    created_at: Mapped[str] = mapped_column(String(40), default=timestamp)
    version: Mapped[int] = mapped_column(default=1)


class Case(Base):
    """独立保存发布和验证状态，人工编辑通过版本号检测并发冲突。"""

    __tablename__ = "cases"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    title: Mapped[str] = mapped_column(String(160))
    business: Mapped[str] = mapped_column(String(80))
    symptom: Mapped[str] = mapped_column(Text)
    conditions: Mapped[str] = mapped_column(Text, default="")
    investigation: Mapped[str] = mapped_column(Text, default="")
    cause: Mapped[str] = mapped_column(Text, default="")
    solution: Mapped[str] = mapped_column(Text, default="")
    verification: Mapped[str] = mapped_column(Text, default="")
    verified_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    publication: Mapped[str] = mapped_column(String(20), default="draft")
    validity: Mapped[str] = mapped_column(String(20), default="unverified")
    source_id: Mapped[str] = mapped_column(ForeignKey("sources.id"))
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    version: Mapped[int] = mapped_column(default=1)
    created_at: Mapped[str] = mapped_column(String(40), default=timestamp)
    updated_at: Mapped[str] = mapped_column(String(40), default=timestamp)
    rule_version: Mapped[str] = mapped_column(
        String(80), default="manual-v1", server_default="manual-v1"
    )
    is_demo: Mapped[bool] = mapped_column(default=False)


class CaseRevision(Base):
    """保存案例每个版本的完整快照与编辑主体，供历史追溯。"""

    __tablename__ = "case_revisions"
    __table_args__ = (UniqueConstraint("case_id", "version"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"))
    version: Mapped[int]
    snapshot: Mapped[dict] = mapped_column(JSON)
    editor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[str] = mapped_column(String(40), default=timestamp)


class Question(Base):
    """独立保存用户提问与处理进度，不因提问自动创建正式案例。"""

    __tablename__ = "questions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    text: Mapped[str] = mapped_column(Text)
    business: Mapped[str] = mapped_column(String(80))
    source_id: Mapped[str | None] = mapped_column(ForeignKey("sources.id"))
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    progress: Mapped[str] = mapped_column(String(20), default="processing")
    created_at: Mapped[str] = mapped_column(String(40), default=timestamp)


class AnalysisRun(Base):
    """保存本次规则、模型与引用快照，使回答能够定位到当时依据。"""

    __tablename__ = "analysis_runs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    question_id: Mapped[str] = mapped_column(ForeignKey("questions.id"))
    rule_version: Mapped[str] = mapped_column(String(80))
    model: Mapped[str] = mapped_column(String(80))
    result: Mapped[dict] = mapped_column(JSON)
    duration_ms: Mapped[int]
    created_at: Mapped[str] = mapped_column(String(40), default=timestamp)


class Feedback(Base):
    """保留处理反馈的追加记录，单次失败不自动改变案例有效性。"""

    __tablename__ = "feedback"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    question_id: Mapped[str] = mapped_column(ForeignKey("questions.id"))
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    outcome: Mapped[str] = mapped_column(String(20))
    note: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String(40), default=timestamp)


class WriteRequest(Base):
    """与业务事务共同保存幂等键及结果，拒绝相同键绑定不同内容。"""

    __tablename__ = "write_requests"
    id: Mapped[str] = mapped_column(String(180), primary_key=True)
    fingerprint: Mapped[str] = mapped_column(String(64))
    result: Mapped[dict] = mapped_column(JSON)
