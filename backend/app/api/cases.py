"""提供案例、草稿与版本协议，所有写入在应用用例中校验身份和预期版本。"""

from fastapi import APIRouter

from ..application import cases
from ..contracts.inputs import AnalysisInput, CaseUpdate, DraftInput
from ..contracts.responses import CaseList, CaseRead, DraftPreview, RevisionList
from ..domain.commands import CaseChanges, DraftContent
from ..domain.types import Business
from .dependencies import DB, CurrentActor, RequestKey

router = APIRouter(tags=["案例与草稿"])


@router.get("/cases", response_model=CaseList, operation_id="listCases")
def list_cases(actor: CurrentActor, db: DB, business: Business, q: str = "") -> CaseList:
    """按授权业务及关键词查询，数组响应保持现有客户端兼容。"""
    return CaseList(cases.search_cases(db, actor, business, q))


@router.post("/drafts/preview", response_model=DraftPreview, operation_id="previewDraft")
def preview_draft(data: AnalysisInput, actor: CurrentActor, db: DB) -> DraftPreview:
    """生成未持久化预览，模型提取不能自动将案例标记为已验证。"""
    return cases.preview_draft(db, actor, data.business, data.text)


@router.post("/drafts", status_code=201, response_model=CaseRead, operation_id="createDraft")
def create_draft(data: DraftInput, actor: CurrentActor, db: DB, key: RequestKey) -> CaseRead:
    """将本人材料绑定为待确认草稿，重复键与业务写入共同提交。"""
    content = DraftContent.model_validate(data.model_dump(exclude={"source_id"}))
    return cases.create_draft(db, actor, data.source_id, content, key)


@router.get("/cases/{case_id}", response_model=CaseRead, operation_id="readCase")
def case_detail(case_id: str, actor: CurrentActor, db: DB) -> CaseRead:
    """返回授权案例的安全投影，未公开草稿仍需所有者或处理角色。"""
    return CaseRead.model_validate(cases.owned_case(db, actor, case_id))


@router.put("/cases/{case_id}", response_model=CaseRead, operation_id="updateCase")
def update_case(case_id: str, data: CaseUpdate, actor: CurrentActor, db: DB) -> CaseRead:
    """转换编辑命令后执行人工确认，版本冲突返回 409 并保留服务端已有内容。"""
    changes = CaseChanges.model_validate(data.model_dump(exclude={"version"}))
    return cases.revise_case(db, actor, case_id, data.version, changes)


@router.get(
    "/cases/{case_id}/revisions", response_model=RevisionList, operation_id="listCaseRevisions"
)
def revisions(case_id: str, actor: CurrentActor, db: DB) -> RevisionList:
    """授权后返回案例的历史版本与确认记录。"""
    return RevisionList(cases.revisions(db, actor, case_id))
