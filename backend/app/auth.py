"""验证服务端会话与业务访问范围，口令摘要及会话令牌不作为公开数据返回。"""

import hashlib
import hmac
import secrets
import time
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .db import get_db
from .models import LoginSession, User


def hash_password(password: str) -> str:
    """使用独立随机盐与 PBKDF2 保存口令摘要，原始口令不入库。"""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 600000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    """使用常量时间比较验证摘要，避免按匹配前缀泄露结果。"""
    salt, digest = stored.split("$")
    actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 600000).hex()
    return hmac.compare_digest(actual, digest)


def current_user(request: Request, db: Annotated[Session, Depends(get_db)]) -> User:
    """验证令牌摘要和有效期，拒绝不存在或已过期的服务端会话。"""
    token = request.cookies.get("assistant_session", "")
    session = db.get(LoginSession, hashlib.sha256(token.encode()).hexdigest())
    if not session or session.expires_at < time.time():
        raise HTTPException(401, "请先登录")
    user = db.get(User, session.user_id)
    if not user:
        raise HTTPException(401, "账号已不可用")
    return user


def allow_business(user: User, business: str):
    """统一拒绝用户业务范围以外的访问，覆盖案例、材料和分析。"""
    if business not in user.businesses:
        raise HTTPException(403, "无权访问此业务的材料")


def require_role(user: User, *roles: str):
    """在执行受限业务操作前检查当前可信身份的角色。"""
    if user.role not in roles:
        raise HTTPException(403, "当前角色没有执行此操作的权限")


def public_user(user: User):
    """只投影工作台需要的账号信息，不包含口令摘要。"""
    return {key: getattr(user, key) for key in ("id", "name", "email", "role", "businesses")}
