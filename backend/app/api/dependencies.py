"""从服务端 Cookie 恢复可信身份，统一请求 Session 与幂等键协议。"""

from typing import Annotated

from fastapi import Depends, Header, Request
from sqlalchemy.orm import Session

from ..application.identity import resolve_actor
from ..db import get_db
from ..domain.types import Actor

DB = Annotated[Session, Depends(get_db)]
RequestKey = Annotated[str, Header(alias="Idempotency-Key", min_length=8, max_length=80)]


def current_user(request: Request, db: DB) -> Actor:
    """验证 Cookie 对应的服务端会话，客户端不能自行指定角色或业务范围。"""
    return resolve_actor(db, request.cookies.get("assistant_session", ""))


CurrentActor = Annotated[Actor, Depends(current_user)]
