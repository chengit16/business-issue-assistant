"""装配 HTTP 接口、会话与文件访问，统一执行同源写入限制并维护请求级事务边界。"""

import hashlib
import secrets
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, Form, Header, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .auth import (
    allow_business,
    current_user,
    hash_password,
    public_user,
    require_role,
    verify_password,
)
from .config import settings
from .db import SessionLocal, get_db
from .models import (
    AnalysisRun,
    Case,
    CaseRevision,
    Feedback,
    LoginSession,
    Question,
    Source,
    User,
    identifier,
)
from .provider import model_json
from .schemas import (
    AnalysisInput,
    Business,
    CaseUpdate,
    DraftContent,
    DraftInput,
    FeedbackInput,
    LoginInput,
    UserInput,
)
from .services import (
    INTAKE_RULE,
    INTAKE_VERSION,
    analyze,
    once,
    owned_case,
    owned_source,
    present_analysis,
    record_dict,
    revise_case,
    search_cases,
)


def bootstrap_admin():
    """仅在账号缺失时创建配置中的管理员，不覆盖已有账号或口令。"""
    with SessionLocal() as db:
        if not db.scalar(select(User).where(User.email == settings.admin_email)):
            db.add(
                User(
                    email=settings.admin_email,
                    name=settings.admin_name,
                    role="maintainer",
                    businesses=["订单售后", "营销活动", "系统支持"],
                    password_hash=hash_password(settings.admin_password),
                )
            )
            db.commit()


@asynccontextmanager
async def lifespan(_app):
    # 结构变更由 Alembic 管理，启动只初始化管理员，避免运行时偷偷改表。
    """启动时初始化管理员，数据库结构需预先通过迁移建立。"""
    bootstrap_admin()
    yield


app = FastAPI(
    title="业务问题助手",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)
DB = Annotated[Session, Depends(get_db)]
Actor = Annotated[User, Depends(current_user)]
RequestKey = Annotated[str, Header(alias="Idempotency-Key", min_length=8, max_length=80)]


@app.middleware("http")
async def same_origin_writes(request: Request, call_next):
    # Cookie 登录的写操作仅允许同源网页，命令行客户端可不携带 Origin。
    """拒绝跨源网页写请求，命令行调用仍由接口登录权限保护。"""
    origin = request.headers.get("origin")
    if request.method not in ("GET", "HEAD", "OPTIONS") and origin:
        from urllib.parse import urlparse

        if urlparse(origin).netloc != request.headers.get("host"):
            return JSONResponse({"detail": "请从同一站点提交操作"}, status_code=403)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/api/health")
def health(db: DB):
    """确认数据库可连接并返回当前分析模式。"""
    db.execute(select(1))
    return {"status": "ok", "analysis_mode": "model" if settings.model_enabled else "local_rules"}


@app.post("/api/auth/login")
def login(data: LoginInput, response: Response, db: DB):
    """验证口令后创建七天会话，仅在 HttpOnly Cookie 中返回原始令牌。"""
    user = db.scalar(select(User).where(User.email == data.email))
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "邮箱或密码不正确")
    token = secrets.token_urlsafe(32)
    db.add(
        LoginSession(
            token_hash=hashlib.sha256(token.encode()).hexdigest(),
            user_id=user.id,
            expires_at=time.time() + 86400 * 7,
        )
    )
    db.commit()
    response.set_cookie(
        "assistant_session",
        token,
        httponly=True,
        samesite="strict",
        secure=settings.cookie_secure,
        max_age=86400 * 7,
        path="/",
    )
    return public_user(user)


@app.post("/api/auth/logout", status_code=204)
def logout(request: Request, response: Response, db: DB):
    """撤销当前服务端会话并清除浏览器 Cookie，重复退出保持可用。"""
    token = request.cookies.get("assistant_session", "")
    session = db.get(LoginSession, hashlib.sha256(token.encode()).hexdigest())
    if session:
        db.delete(session)
        db.commit()
    response.delete_cookie("assistant_session", path="/")


@app.get("/api/auth/me")
def me(user: Actor):
    """返回当前会话的公开身份及业务范围。"""
    return public_user(user)


@app.post("/api/users", status_code=201)
def create_user(data: UserInput, user: Actor, db: DB):
    """维护人仅能在自身业务范围内创建账号，邮箱冲突返回 409。"""
    require_role(user, "maintainer")
    for business in data.businesses:
        allow_business(user, business)
    item = User(**data.model_dump(exclude={"password"}), password_hash=hash_password(data.password))
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "邮箱已存在") from None
    return public_user(item)


@app.get("/api/overview")
def overview(user: Actor, db: DB):
    """统计当前用户可访问的案例和个人提问，不计入不可见的他人草稿。"""
    items = list(db.scalars(select(Case).where(Case.business.in_(user.businesses))))
    if user.role == "member":
        items = [
            item for item in items if item.publication == "published" or item.owner_id == user.id
        ]
    return {
        "analysis_mode": "model" if settings.model_enabled else "local_rules",
        "published": sum(item.publication == "published" for item in items),
        "verified": sum(
            item.publication == "published" and item.validity == "verified" for item in items
        ),
        "pending": sum(item.publication == "pending" for item in items),
        "questions": len(list(db.scalars(select(Question.id).where(Question.owner_id == user.id)))),
    }


@app.post("/api/sources", status_code=201)
async def create_source(
    user: Actor,
    db: DB,
    business: Annotated[Business, Form()],
    text: Annotated[str, Form(min_length=1, max_length=20000)],
    file: UploadFile | None = None,
):
    """校验业务与图片后持久化不可变材料，数据库失败时清理本次文件。"""
    # 1. 校验材料归属与图片边界，拒绝超限或伪装的附件。
    allow_business(user, business)
    if not text.strip():
        raise HTTPException(422, "请填写原始材料或截图背景说明")
    path = None
    media_type = None
    if file:
        content = await file.read(5 * 1024 * 1024 + 1)
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(413, "图片不能超过 5 MB")
        # 只接受有已知签名的图片，避免把任意上传内容当成可执行网页展示。
        if content.startswith(b"\x89PNG\r\n\x1a\n"):
            media_type = "image/png"
        elif content.startswith(b"\xff\xd8\xff"):
            media_type = "image/jpeg"
        elif content[:4] == b"RIFF" and content[8:12] == b"WEBP":
            media_type = "image/webp"
        else:
            raise HTTPException(422, "请上传 PNG、JPEG 或 WebP 图片")
        path = settings.upload_dir / identifier()
        path.write_bytes(content)
    # 2. 文件写入成功后登记材料，数据库失败时补偿清理本次文件。
    item = Source(
        business=business,
        text=text.strip(),
        owner_id=user.id,
        attachment_name=Path(file.filename or "截图").name[:255] if file else None,
        attachment_path=str(path) if path else None,
        attachment_type=media_type,
    )
    db.add(item)
    try:
        db.commit()
    except Exception:
        if path:
            path.unlink(missing_ok=True)
        raise
    return source_view(item)


def source_view(item: Source):
    """公开材料内容与附件名称，隐藏服务器文件路径。"""
    return {key: value for key, value in record_dict(item).items() if key != "attachment_path"}


@app.get("/api/sources/{source_id}")
def source_detail(source_id: str, user: Actor, db: DB):
    """读取当前用户有权访问的材料，未发布原文受所有者和角色限制。"""
    return source_view(owned_source(db, user, source_id))


@app.get("/api/sources/{source_id}/attachment")
def source_attachment(source_id: str, user: Actor, db: DB):
    """复核材料权限后返回已校验图片，不暴露上传目录。"""
    item = owned_source(db, user, source_id)
    if not item.attachment_path or not Path(item.attachment_path).is_file():
        raise HTTPException(404, "附件不存在")
    return FileResponse(item.attachment_path, media_type=item.attachment_type)


@app.get("/api/cases")
def cases(user: Actor, db: DB, business: Business, q: str = ""):
    """按业务范围和关键词返回可访问案例，待确认材料保持角色限制。"""
    return [record_dict(item) for item in search_cases(db, user, business, q)]


@app.post("/api/drafts/preview")
def preview_draft(data: AnalysisInput, user: Actor, db: DB):
    """生成可校正的草稿预览，不写入案例，也不自动赋予验证状态。"""
    allow_business(user, data.business)
    content = DraftContent(title=" ".join(data.text.split())[:80], symptom=data.text)
    if settings.model_enabled:
        content = model_json(
            INTAKE_RULE,
            {"text": data.text, "business": data.business},
            DraftContent,
        )
    return {
        **content.model_dump(),
        "rule_version": INTAKE_VERSION,
        "mode": "model" if settings.model_enabled else "local_rules",
        "similar": [
            record_dict(item) for item in search_cases(db, user, data.business, data.text)[:3]
        ],
    }


@app.post("/api/drafts", status_code=201)
def create_draft(data: DraftInput, user: Actor, db: DB, key: RequestKey):
    """使用本人材料创建待确认、未验证草稿，业务数据与幂等记录共同提交。"""
    source = owned_source(db, user, data.source_id)
    if source.owner_id != user.id:
        raise HTTPException(403, "只能使用自己提交的原始材料创建草稿")

    def create():
        item = Case(
            **data.model_dump(),
            business=source.business,
            owner_id=user.id,
            rule_version=INTAKE_VERSION,
            publication="pending",
            validity="unverified",
        )
        db.add(item)
        db.flush()
        snapshot = record_dict(item)
        db.add(CaseRevision(case_id=item.id, version=1, snapshot=snapshot, editor_id=user.id))
        return snapshot

    return once(db, user, key, "draft", data.model_dump(), create)


@app.get("/api/cases/{case_id}")
def case_detail(case_id: str, user: Actor, db: DB):
    """读取授权范围内的案例，草稿需属于本人或具备处理权限。"""
    return record_dict(owned_case(db, user, case_id))


@app.put("/api/cases/{case_id}")
def update_case(case_id: str, data: CaseUpdate, user: Actor, db: DB):
    """将人工确认交给版本化写用例，冲突返回 409 并保留已有版本。"""
    return revise_case(db, user, owned_case(db, user, case_id), data)


@app.get("/api/cases/{case_id}/revisions")
def revisions(case_id: str, user: Actor, db: DB):
    """复核案例访问权后返回版本快照，用于核对历史依据。"""
    owned_case(db, user, case_id)
    return [
        record_dict(item)
        for item in db.scalars(
            select(CaseRevision)
            .where(CaseRevision.case_id == case_id)
            .order_by(CaseRevision.version.desc())
        )
    ]


@app.post("/api/analyses", status_code=201)
def create_analysis(data: AnalysisInput, user: Actor, db: DB, key: RequestKey):
    """以幂等键保存提问与运行记录，返回前重新核对引用有效性。"""
    allow_business(user, data.business)
    value = once(db, user, key, "analysis", data.model_dump(), lambda: analyze(db, user, data))
    return present_analysis(db, user, value)


@app.get("/api/questions")
def questions(user: Actor, db: DB):
    """仅返回当前账号的提问，不以维护人角色扩大个人记录范围。"""
    return [
        record_dict(item)
        for item in db.scalars(
            select(Question)
            .where(Question.owner_id == user.id)
            .order_by(Question.created_at.desc())
        )
    ]


def my_question(db: Session, user: User, question_id: str):
    """限制提问所有者与业务范围，不向其他账号暴露提问存在性。"""
    item = db.get(Question, question_id)
    if not item or item.owner_id != user.id:
        raise HTTPException(404, "提问记录不存在")
    allow_business(user, item.business)
    return item


@app.get("/api/questions/{question_id}")
def question_detail(question_id: str, user: Actor, db: DB):
    """读取本人历史运行并按当前引用状态调整可展示建议。"""
    question = my_question(db, user, question_id)
    run = db.scalar(select(AnalysisRun).where(AnalysisRun.question_id == question_id))
    value = present_analysis(db, user, {"question": record_dict(question), "run": record_dict(run)})
    return {
        **value,
        "feedback": [
            record_dict(item)
            for item in db.scalars(
                select(Feedback)
                .where(Feedback.question_id == question_id)
                .order_by(Feedback.created_at)
            )
        ],
    }


@app.post("/api/questions/{question_id}/feedback", status_code=201)
def feedback(question_id: str, data: FeedbackInput, user: Actor, db: DB, key: RequestKey):
    """幂等保存实际处理结果，反馈不会自动验证或废弃历史案例。"""
    question = my_question(db, user, question_id)

    def create():
        item = Feedback(question_id=question_id, author_id=user.id, **data.model_dump())
        question.progress = "resolved" if data.outcome == "resolved" else "reopened"
        db.add(item)
        db.flush()
        return record_dict(item)

    return once(db, user, key, f"feedback-{question_id}", data.model_dump(), create)


# 构建后由同一服务提供网页，开发时通过 Vite 代理保持 Cookie 和接口同源。
frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
