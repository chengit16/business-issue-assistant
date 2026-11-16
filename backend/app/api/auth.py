"""提供登录、退出和账号创建协议，凭证摘要及会话写入交给身份用例。"""

from fastapi import APIRouter, Request, Response

from ..application import identity
from ..config import settings
from ..contracts.inputs import LoginInput, UserInput
from ..contracts.responses import UserRead
from .dependencies import DB, CurrentActor

router = APIRouter(tags=["账号与会话"])


@router.post("/auth/login", response_model=UserRead, operation_id="login")
def login(data: LoginInput, response: Response, db: DB) -> UserRead:
    """认证后设置同源 HttpOnly Cookie，失败不创建有效会话。"""
    user, token = identity.authenticate(db, data.email, data.password)
    response.set_cookie(
        "assistant_session",
        token,
        httponly=True,
        samesite="strict",
        secure=settings.cookie_secure,
        max_age=86400 * 7,
        path="/",
    )
    return user


@router.post("/auth/logout", status_code=204, operation_id="logout")
def logout(request: Request, response: Response, db: DB) -> None:
    """撤销当前会话并删除浏览器 Cookie，重复退出保持幂等。"""
    identity.revoke_session(db, request.cookies.get("assistant_session", ""))
    response.delete_cookie("assistant_session", path="/")


@router.get("/auth/me", response_model=UserRead, operation_id="currentUser")
def me(actor: CurrentActor) -> UserRead:
    """返回经服务端认证的公开身份，不包含认证秘密。"""
    return UserRead(
        id=actor.id,
        email=actor.email,
        name=actor.name,
        role=actor.role,
        businesses=list(actor.businesses),
    )


@router.post("/users", status_code=201, response_model=UserRead, operation_id="createUser")
def create_user(data: UserInput, actor: CurrentActor, db: DB) -> UserRead:
    """由维护人创建业务范围内账号，邮箱冲突返回稳定错误码。"""
    return identity.create_user(db, actor, data)
