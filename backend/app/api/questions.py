"""提供个人提问、分析与反馈协议，写请求通过共用幂等事务保护。"""

from fastapi import APIRouter
from sqlalchemy import select

from ..application import analysis
from ..application.idempotency import once
from ..contracts.inputs import AnalysisInput, FeedbackInput
from ..contracts.responses import (
    AnalysisRead,
    FeedbackRead,
    QuestionList,
    QuestionRead,
    json_object,
)
from ..domain.commands import AnalysisCommand, FeedbackCommand
from ..domain.policies import allow_business
from ..models import Question
from .dependencies import DB, CurrentActor, RequestKey

router = APIRouter(tags=["提问与反馈"])


@router.post(
    "/analyses", status_code=201, response_model=AnalysisRead, operation_id="createAnalysis"
)
def create_analysis(
    data: AnalysisInput, actor: CurrentActor, db: DB, key: RequestKey
) -> AnalysisRead:
    """生成分析并持久化运行事实，返回幂等缓存前仍重查引用状态。"""
    allow_business(actor, data.business)
    command = AnalysisCommand.model_validate(data)
    value = once(
        db,
        actor,
        key,
        "analysis",
        json_object(data),
        AnalysisRead,
        lambda: analysis.analyze(db, actor, command),
    )
    return analysis.present_analysis(db, actor, value)


@router.get("/questions", response_model=QuestionList, operation_id="listQuestions")
def questions(actor: CurrentActor, db: DB) -> QuestionList:
    """仅返回本人当前仍有权访问的提问，排序同时使用时间与稳定编号。"""
    items = db.scalars(
        select(Question)
        .where(Question.owner_id == actor.id, Question.business.in_(actor.businesses))
        .order_by(Question.created_at.desc(), Question.id)
    )
    return QuestionList([QuestionRead.model_validate(item) for item in items])


@router.get("/questions/{question_id}", response_model=AnalysisRead, operation_id="readQuestion")
def question_detail(question_id: str, actor: CurrentActor, db: DB) -> AnalysisRead:
    """查看本人历史运行和实际反馈，引用权限和版本以当前状态复核。"""
    return analysis.question_detail(db, actor, question_id)


@router.post(
    "/questions/{question_id}/feedback",
    status_code=201,
    response_model=FeedbackRead,
    operation_id="saveFeedback",
)
def feedback(
    question_id: str, data: FeedbackInput, actor: CurrentActor, db: DB, key: RequestKey
) -> FeedbackRead:
    """幂等追加本人提问的处理反馈，失败不自动改变历史方案有效性。"""
    analysis.my_question(db, actor, question_id)
    command = FeedbackCommand.model_validate(data)
    return once(
        db,
        actor,
        key,
        f"feedback-{question_id}",
        json_object(data),
        FeedbackRead,
        lambda: analysis.save_feedback(db, actor, question_id, command),
    )
