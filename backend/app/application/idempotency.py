"""将业务结果与幂等记录共同提交，唯一键在多实例并发时保护重复写入。"""

import hashlib
import json
from collections.abc import Callable

from pydantic import BaseModel, JsonValue
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..contracts.responses import json_object
from ..domain.errors import BusinessError
from ..domain.types import Actor
from ..models import WriteRequest


def once[Result: BaseModel](
    db: Session,
    actor: Actor,
    key: str,
    operation: str,
    payload: dict[str, JsonValue],
    schema: type[Result],
    create: Callable[[], Result],
) -> Result:
    """相同主体、动作和键只提交一次，内容变化拒绝重放，失败先回滚再读取竞争结果。"""
    request_id = f"{actor.id}:{operation}:{key}"
    fingerprint = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()

    def replay(item: WriteRequest) -> Result:
        if item.fingerprint != fingerprint:
            raise BusinessError(
                "IDEMPOTENCY_CONFLICT", "同一个请求编号对应了不同内容，请重新提交", 409
            )
        return schema.model_validate(item.result)

    # 1. 已提交结果先比较内容，避免把复用键的新内容当成重试。
    existing = db.get(WriteRequest, request_id)
    if existing:
        return replay(existing)
    # 2. 业务变更与幂等结果共享提交，失败后释放事务再读取胜出的请求。
    try:
        result = create()
        db.add(WriteRequest(id=request_id, fingerprint=fingerprint, result=json_object(result)))
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.get(WriteRequest, request_id)
        if not existing:
            raise
        return replay(existing)
    return result
