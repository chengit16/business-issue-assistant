"""映射原始材料上传与授权下载，使用同步工作线程执行文件和数据库 I/O。"""

from typing import Annotated

from fastapi import APIRouter, Form, UploadFile
from fastapi.responses import FileResponse

from ..application import materials
from ..contracts.responses import SourceRead
from ..domain.types import Business
from .dependencies import DB, CurrentActor

router = APIRouter(tags=["原始材料"])


@router.post("/sources", status_code=201, response_model=SourceRead, operation_id="createSource")
def create_source(
    actor: CurrentActor,
    db: DB,
    business: Annotated[Business, Form()],
    text: Annotated[str, Form(min_length=1, max_length=20000)],
    file: UploadFile | None = None,
) -> SourceRead:
    """接收有限大小的图片和文字，应用用例负责授权、校验与失败清理。"""
    content = file.file.read(materials.MAX_IMAGE_BYTES + 1) if file else None
    return materials.create_source(
        db, actor, business, text, file.filename if file else None, content
    )


@router.get("/sources/{source_id}", response_model=SourceRead, operation_id="readSource")
def source_detail(source_id: str, actor: CurrentActor, db: DB) -> SourceRead:
    """重新验证原文访问权，隐藏本地存储路径。"""
    return SourceRead.model_validate(materials.owned_source(db, actor, source_id))


@router.get(
    "/sources/{source_id}/attachment",
    operation_id="downloadSourceAttachment",
    response_class=FileResponse,
    responses={200: {"content": {"image/png": {}, "image/jpeg": {}, "image/webp": {}}}},
)
def source_attachment(source_id: str, actor: CurrentActor, db: DB) -> FileResponse:
    """鉴权后交付原始图片，不能通过文件路径直接绕过材料授权。"""
    path, media_type = materials.attachment(db, actor, source_id)
    return FileResponse(path, media_type=media_type)
