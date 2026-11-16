"""编排账号与会话，令牌只返回协议边界，口令摘要和令牌摘要留在存储层。"""

import hashlib
import secrets
import time

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth import hash_password, verify_password
from ..config import settings
from ..contracts.inputs import UserInput
from ..contracts.responses import UserRead
from ..db import SessionLocal
from ..domain.errors import BusinessError
from ..domain.policies import allow_business, require_role
from ..domain.types import BUSINESSES, Actor
from ..models import LoginSession, User


def public_user(user: User) -> UserRead:
    """投影可公开账号字段，响应不携带认证秘密。"""
    return UserRead.model_validate(user)


def bootstrap_admin() -> None:
    """初始化缺失的管理员，唯一约束保护并发启动，不覆盖已有账号。"""
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == settings.admin_email)):
            return
        db.add(
            User(
                email=settings.admin_email,
                name=settings.admin_name,
                role="maintainer",
                businesses=list(BUSINESSES),
                password_hash=hash_password(settings.admin_password),
            )
        )
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            if not db.scalar(select(User.id).where(User.email == settings.admin_email)):
                raise


def authenticate(db: Session, email: str, password: str) -> tuple[UserRead, str]:
    """验证口令并提交七天会话，原始令牌仅交给 Cookie 协议层。"""
    user = db.scalar(select(User).where(User.email == email))
    if not user or not verify_password(password, user.password_hash):
        raise BusinessError("INVALID_CREDENTIALS", "邮箱或密码不正确", 401)
    token = secrets.token_urlsafe(32)
    db.add(
        LoginSession(
            token_hash=hashlib.sha256(token.encode()).hexdigest(),
            user_id=user.id,
            expires_at=time.time() + 86400 * 7,
        )
    )
    db.commit()
    return public_user(user), token


def resolve_actor(db: Session, token: str) -> Actor:
    """从有效服务端会话恢复可信主体，过期、被撤销或损坏身份默认拒绝。"""
    session = db.get(LoginSession, hashlib.sha256(token.encode()).hexdigest())
    if not session or session.expires_at < time.time():
        raise BusinessError("AUTH_REQUIRED", "请先登录", 401)
    user = db.get(User, session.user_id)
    if not user:
        raise BusinessError("AUTH_REQUIRED", "账号已不可用", 401)
    return _actor(user)


def _actor(user: User) -> Actor:
    value = public_user(user)
    return Actor(
        id=value.id,
        email=value.email,
        name=value.name,
        role=value.role,
        businesses=tuple(value.businesses),
    )


def refresh_actor(db: Session, actor: Actor) -> Actor:
    """外部调用后重新读取账号权限，不能用调用前快照继续写入或泄露旧结果。"""
    user = db.scalar(
        select(User).where(User.id == actor.id).execution_options(populate_existing=True)
    )
    if not user:
        raise BusinessError("AUTH_REQUIRED", "账号已不可用", 401)
    return _actor(user)


def revoke_session(db: Session, token: str) -> None:
    """撤销当前会话，重复退出不产生额外失败。"""
    session = db.get(LoginSession, hashlib.sha256(token.encode()).hexdigest())
    if session:
        db.delete(session)
        db.commit()


def create_user(db: Session, actor: Actor, data: UserInput) -> UserRead:
    """验证维护人授予范围并提交账号，邮箱冲突稳定返回业务错误。"""
    require_role(actor, "maintainer")
    for business in data.businesses:
        allow_business(actor, business)
    user = User(
        email=data.email,
        name=data.name,
        role=data.role,
        businesses=data.businesses,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise BusinessError("EMAIL_EXISTS", "邮箱已存在", 409) from None
    return public_user(user)
