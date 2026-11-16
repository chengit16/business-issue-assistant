"""保护权限撤销与模型等待期间的授权时序，只使用隔离数据库中的合成账号。"""

import json
import os
import secrets
from collections.abc import Generator
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, update

from app.config import settings
from app.db import SessionLocal
from app.main import app
from app.models import Case, Question, User


@pytest.fixture
def member() -> Generator[tuple[TestClient, str], None, None]:
    """每项测试使用独立成员，避免权限变更影响其他流程和管理员会话。"""
    password = secrets.token_urlsafe(18)
    email = f"authorization-{uuid4()}@example.com"
    with TestClient(app) as admin:
        login = admin.post(
            "/api/auth/login",
            json={"email": "admin@example.com", "password": os.environ["ADMIN_PASSWORD"]},
        )
        assert login.status_code == 200
        person = admin.post(
            "/api/users",
            json={
                "email": email,
                "password": password,
                "name": "授权时序测试成员",
                "businesses": ["订单售后", "营销活动"],
            },
        )
        assert person.status_code == 201
    with TestClient(app) as browser:
        response = browser.post("/api/auth/login", json={"email": email, "password": password})
        assert response.status_code == 200
        yield browser, person.json()["id"]


def revoke_orders(user_id: str) -> None:
    """通过独立事务模拟维护人在请求等待期间撤销订单业务权限。"""
    with SessionLocal() as db:
        db.execute(update(User).where(User.id == user_id).values(businesses=["营销活动"]))
        db.commit()


def test_draft_replay_rechecks_material_authorization(member: tuple[TestClient, str]) -> None:
    """已成功的幂等键不能绕过后续撤销的业务权限，也不能重复写入案例。"""
    browser, user_id = member
    material = browser.post(
        "/api/sources", data={"business": "订单售后", "text": "授权重放测试原文"}
    ).json()
    payload = {
        "source_id": material["id"],
        "title": "授权重放测试案例",
        "symptom": "合成问题现象",
    }
    key = {"Idempotency-Key": str(uuid4())}
    assert browser.post("/api/drafts", json=payload, headers=key).status_code == 201
    revoke_orders(user_id)
    replay = browser.post("/api/drafts", json=payload, headers=key)
    assert replay.status_code == 404
    assert replay.json()["code"] == "NOT_FOUND"
    with SessionLocal() as db:
        assert (
            db.scalar(select(func.count()).select_from(Case).where(Case.owner_id == user_id)) == 1
        )


@pytest.mark.parametrize("endpoint", ["/api/analyses", "/api/drafts/preview"])
def test_model_wait_rechecks_current_permissions(
    member: tuple[TestClient, str], monkeypatch: pytest.MonkeyPatch, endpoint: str
) -> None:
    """外部请求成功也不代表仍有授权；撤销后拒绝返回模型正文或保存提问。"""
    browser, user_id = member
    monkeypatch.setattr(settings, "model_base_url", "https://model.invalid/v1")
    monkeypatch.setattr(settings, "model_api_key", "synthetic-test-token")
    monkeypatch.setattr(settings, "model_name", "synthetic-test-model")

    def respond(url: str, **kwargs: object) -> httpx.Response:
        revoke_orders(user_id)
        content = (
            {"title": "不可返回的合成标题", "symptom": "不可返回的合成现象"}
            if endpoint.endswith("preview")
            else {
                "summary": "不可返回的合成摘要",
                "steps": ["合成排查步骤"],
                "missing": [],
                "reply": "合成回复",
            }
        )
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": json.dumps(content)}}]},
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(httpx, "post", respond)
    result = browser.post(
        endpoint,
        json={"business": "订单售后", "text": "模拟模型等待期间权限撤销"},
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert result.status_code == 403
    assert result.json()["code"] == "FORBIDDEN"
    assert "不可返回" not in result.text
    with SessionLocal() as db:
        assert (
            db.scalar(
                select(func.count()).select_from(Question).where(Question.owner_id == user_id)
            )
            == 0
        )
