"""编排案例查询、人工确认、幂等写入及分析记录，权限和版本条件在写入前核验。"""

import hashlib
import json
import re
from pathlib import Path
from time import perf_counter

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .auth import allow_business, require_role
from .config import settings
from .models import AnalysisRun, Case, CaseRevision, Question, Source, User, WriteRequest, timestamp
from .provider import model_json
from .schemas import Advice, AnalysisInput, CaseUpdate

RULE_DIR = Path(__file__).resolve().parent.parent / "rules"
ANALYSIS_RULE = (RULE_DIR / "analysis.md").read_text()
INTAKE_RULE = (RULE_DIR / "intake.md").read_text()
INTAKE_VERSION = "intake-v1-" + hashlib.sha256(INTAKE_RULE.encode()).hexdigest()[:10]
RULE_VERSION = "analysis-v1-" + hashlib.sha256(ANALYSIS_RULE.encode()).hexdigest()[:10]


def record_dict(record):
    """将已加载 ORM 列转为快照字典，调用方负责公开字段范围。"""
    return {column.name: getattr(record, column.name) for column in record.__table__.columns}


def owned_case(db: Session, user: User, case_id: str) -> Case:
    """先核对业务范围，再按所有者和角色限制草稿可见性。"""
    item = db.get(Case, case_id)
    if not item:
        raise HTTPException(404, "案例不存在")
    allow_business(user, item.business)
    if item.publication in ("draft", "pending") and item.owner_id != user.id:
        require_role(user, "maintainer", "handler")
    return item


def owned_source(db: Session, user: User, source_id: str) -> Source:
    """核对材料所属业务与发布关系，未发布原文不向普通他人开放。"""
    source = db.get(Source, source_id)
    if not source:
        raise HTTPException(404, "原始材料不存在")
    allow_business(user, source.business)
    if source.owner_id != user.id and user.role == "member":
        published = db.scalar(
            select(Case.id).where(Case.source_id == source_id, Case.publication == "published")
        )
        if not published:
            raise HTTPException(403, "原始材料尚未发布")
    return source


def once(db: Session, user: User, key: str, operation: str, payload: dict, create):
    """将业务变更与幂等结果共同提交，并发唯一键冲突时核对并返回已完成结果。"""
    request_id = f"{user.id}:{operation}:{key}"
    fingerprint = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()

    def replay(item):
        if item.fingerprint != fingerprint:
            raise HTTPException(409, "同一个请求编号对应了不同内容，请重新提交")
        return item.result

    # 1. 相同主体、操作和键先核对内容摘要，避免把其他提交误认为重试。
    existing = db.get(WriteRequest, request_id)
    if existing:
        return replay(existing)
    # 幂等记录与业务数据在同一事务提交，并发重试由唯一键保证只保留一次结果。
    # 2. 业务结果与幂等结果同事务持久化，竞争失败后读取已提交结果。
    result = create()
    db.add(WriteRequest(id=request_id, fingerprint=fingerprint, result=result))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.get(WriteRequest, request_id)
        if not existing:
            raise
        return replay(existing)
    return result


def terms(text: str) -> set[str]:
    # 中文按相邻双字匹配，字母及错误码保留完整词；首版仅提供可解释的关键词召回。
    """按中文相邻双字和完整字母词提取首版检索词，不表示语义匹配。"""
    output = set(re.findall(r"[a-z0-9_-]+", text.lower()))
    for part in re.findall(r"[\u4e00-\u9fff]+", text):
        output.update(part[index : index + 2] for index in range(len(part) - 1))
    return output


def search_cases(db: Session, user: User, business: str, query: str = "", valid_only=False):
    """先限制业务和发布范围，再进行关键词排序，分析仅使用已验证记录。"""
    allow_business(user, business)
    statement = select(Case).where(Case.business == business)
    if valid_only:
        statement = statement.where(Case.publication == "published", Case.validity == "verified")
    elif user.role == "member":
        statement = statement.where((Case.publication == "published") | (Case.owner_id == user.id))
    items = list(db.scalars(statement.order_by(Case.updated_at.desc())))
    if not query.strip():
        return items
    query_terms = terms(query)
    ranked = []
    for item in items:
        content = f"{item.title} {item.symptom} {item.conditions} {item.cause}"
        score = len(query_terms & terms(content))
        if query.lower() in content.lower():
            score += 10
        if score:
            ranked.append((score, item))
    return [item for _, item in sorted(ranked, key=lambda pair: pair[0], reverse=True)]


def revise_case(db: Session, user: User, item: Case, data: CaseUpdate):
    """校验角色和验证依据，以预期版本条件更新案例并保存新快照。"""
    if item.owner_id != user.id:
        require_role(user, "handler", "maintainer")
    if data.publication in ("published", "archived") or item.publication in (
        "published",
        "archived",
    ):
        require_role(user, "maintainer")
    if data.validity == "verified":
        require_role(user, "handler", "maintainer")
        if not data.solution or not data.verification or not data.conditions:
            raise HTTPException(422, "验证方案前请填写适用条件、处理步骤及实际验证结果")
    if data.validity == "invalid":
        require_role(user, "maintainer")
    values = data.model_dump(exclude={"version"})
    values.update(version=item.version + 1, updated_at=timestamp())
    values["verified_by"] = user.id if data.validity == "verified" else None
    # 已验证内容修改后必须由处理人重新确认，版本条件避免并发编辑覆盖他人修改。
    changed = db.execute(
        update(Case).where(Case.id == item.id, Case.version == data.version).values(**values),
        execution_options={"synchronize_session": False},
    )
    if changed.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "案例已被更新，请刷新后重新编辑")
    db.refresh(item)
    db.add(
        CaseRevision(
            case_id=item.id, version=item.version, snapshot=record_dict(item), editor_id=user.id
        )
    )
    db.commit()
    return record_dict(item)


def analyze(db: Session, user: User, data: AnalysisInput):
    """在业务范围内检索有效案例，保存输入及来源版本，模型失败时整体回滚。"""
    # 1. 先确认问题和原始材料的授权范围，再检索当前有效案例。
    start = perf_counter()
    allow_business(user, data.business)
    input_source = None
    if data.source_id:
        input_source = owned_source(db, user, data.source_id)
        if input_source.business != data.business:
            raise HTTPException(422, "材料与问题必须属于同一业务")
        if input_source.owner_id != user.id:
            raise HTTPException(403, "只能将自己的材料附加到问题")
    candidates = search_cases(db, user, data.business, data.text, valid_only=True)[:5]
    citations = []
    for item in candidates:
        case_source = db.get(Source, item.source_id)
        citations.append({**record_dict(item), "source_version": case_source.version})
    # 2. 固定来源快照并生成建议，引用编号始终来自服务端检索。
    result = {
        "summary": "已按问题描述检索团队已验证案例。"
        if candidates
        else "暂未找到适用的已验证案例，请补充背景后继续排查。",
        "steps": [
            "确认涉及的系统、业务渠道、版本及问题发生时间。",
            "记录已尝试的操作及实际结果，保留原始报错或截图。",
        ]
        + (
            ["逐条比较下方案例的适用条件，再由有权限的处理人核对。"]
            if candidates
            else ["将问题交由对应处理人跟进，解决后补充可复用的经验。"]
        ),
        "missing": ["具体业务编号和发生时间", "所用系统、渠道与版本", "已尝试的处理操作及结果"],
        "citations": citations,
        "reply": "已记录此问题。请补充业务编号、发生时间、系统或渠道及已尝试的操作，我们会结合团队历史经验进一步核对。",
        "mode": "local_rules",
        "notice": "本地规则分析 · 根据关键词检索，历史案例需核对适用条件。",
    }
    if settings.model_enabled:
        advice = model_json(
            ANALYSIS_RULE,
            {
                "question": data.text,
                "business": data.business,
                "cases": citations,
                "source_text": input_source.text if input_source else "",
            },
            Advice,
        )
        result.update(advice.model_dump())
        result["mode"] = "model"
        result["notice"] = "模型辅助分析 · 请核对历史案例的适用条件及原始依据。"
    # 3. 保存运行事实，由上层幂等用例共同提交问题与分析记录。
    # 网络调用结束后才开始业务写入，避免等待模型时占用数据库写锁。
    question = Question(
        text=data.text, business=data.business, source_id=data.source_id, owner_id=user.id
    )
    db.add(question)
    db.flush()
    run = AnalysisRun(
        question_id=question.id,
        rule_version=RULE_VERSION,
        model=settings.model_name if settings.model_enabled else "local-rules-v1",
        result=result,
        duration_ms=int((perf_counter() - start) * 1000),
    )
    db.add(run)
    db.flush()
    return {"question": record_dict(question), "run": record_dict(run)}


def present_analysis(db: Session, user: User, value: dict) -> dict:
    """历史快照可追溯，展示时重新核对引用的当前权限、版本及有效性。"""
    result = dict(value["run"]["result"])
    citations = []
    changed = False
    for snapshot in result["citations"]:
        current = db.get(Case, snapshot["id"])
        if not current or current.business not in user.businesses:
            changed = True
            continue
        available = (
            current.publication == "published"
            and current.validity == "verified"
            and current.version == snapshot["version"]
        )
        changed = changed or not available
        citations.append({**snapshot, "currently_available": available})
    result["citations"] = citations
    if changed:
        # 模型文字可能依赖旧方案，引用变化后一起撤回建议，避免只改标签仍展示旧操作。
        result.update(
            summary="引用案例已发生变化，请重新分析当前问题。",
            steps=[
                "核对当前问题的系统、渠道、时间和已尝试操作。",
                "重新提交分析，获取当前有效的案例。",
            ],
            reply="此问题的历史参考资料已更新，需要重新核对后给出处理建议。",
            notice="历史分析 · 引用版本已变化，原建议需重新核对。",
        )
    return {**value, "run": {**value["run"], "result": result}}
