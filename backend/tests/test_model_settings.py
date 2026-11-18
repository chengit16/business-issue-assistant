"""验证团队配置的角色边界、试连、加密保存和生效，供应商使用合成替身。"""

import json
import os
from collections.abc import Generator

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import JsonValue
from sqlalchemy import delete

from app import provider
from app.db import SessionLocal
from app.factory import create_app
from app.model_connection import ModelConnection
from app.models import ModelSettings

PATH = "/api/settings/model"


@pytest.fixture
def admin() -> Generator[TestClient, None, None]:
    """使用独立应用会话，结束时清除本用例保存的团队设置。"""
    with TestClient(create_app()) as client:
        response = client.post(
            "/api/auth/login",
            json={"email": os.environ["ADMIN_EMAIL"], "password": os.environ["ADMIN_PASSWORD"]},
        )
        assert response.status_code == 200
        try:
            yield client
        finally:
            with SessionLocal() as db:
                db.execute(delete(ModelSettings))
                db.commit()


def test_key_is_write_only_and_published_settings_are_used(
    admin: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """密钥不可由读取接口取回，测试与真实草稿使用正确的已验证连接。"""
    key = "synthetic-provider-token"
    config = {
        "address": "https://provider.example/v1",
        "model": "fixture-model",
        "api_key": key,
        "version": 0,
    }
    calls: list[dict[str, JsonValue]] = []

    def post(
        connection: ModelConnection, headers: dict[str, str], body: dict[str, JsonValue]
    ) -> httpx.Response:
        assert connection.address == config["address"]
        assert headers["Authorization"] == f"Bearer {key}"
        calls.append(body)
        result: dict[str, object] = (
            {"ok": True} if len(calls) != 2 else {"title": "测试草稿", "symptom": "测试现象"}
        )
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": json.dumps(result)}}]},
            request=httpx.Request("POST", connection.address),
        )

    monkeypatch.setattr(provider, "_post", post)
    untested = admin.put(PATH, json={**config, "mode": "model"})
    assert untested.status_code == 422
    tested = admin.post(f"{PATH}/test", json=config)
    assert tested.status_code == 200, tested.text
    proof = tested.json()["test_token"]
    assert key not in tested.text
    assert admin.get(PATH).json()["mode"] == "local_rules"
    assert calls[0]["messages"] is not None
    assert '"content": "{}"' in json.dumps(calls[0], ensure_ascii=False)
    mismatched = admin.put(
        PATH, json={**config, "mode": "model", "model": "other", "test_token": proof}
    )
    assert mismatched.status_code == 422
    saved = admin.put(PATH, json={**config, "mode": "model", "test_token": proof})
    assert saved.status_code == 200, saved.text
    assert saved.json().get("has_api_key") is True
    assert "api_key" not in saved.json() and key not in saved.text
    with SessionLocal() as db:
        row = db.get(ModelSettings, 1)
        assert row and key not in row.encrypted_key
    assert admin.get("/api/health").json()["analysis_mode"] == "model"
    draft = admin.post("/api/drafts/preview", json={"business": "订单售后", "text": "测试同步问题"})
    assert draft.status_code == 200, draft.text
    assert draft.json()["mode"] == "model"
    assert admin.put(PATH, json={"mode": "local_rules", "version": 0}).status_code == 409
    local = admin.put(PATH, json={"mode": "local_rules", "version": 1})
    assert local.status_code == 200
    assert local.json()["has_api_key"] is True
    assert admin.get("/api/health").json()["analysis_mode"] == "local_rules"
    reusing = {"address": config["address"], "model": config["model"], "version": 2}
    assert admin.post(f"{PATH}/test", json=reusing).status_code == 200
    foreign = admin.post(f"{PATH}/test", json={**reusing, "address": "https://other.example"})
    assert foreign.status_code == 422 and len(calls) == 3


def test_configuration_access_and_private_endpoint_rejection(admin: TestClient) -> None:
    """成员不能操作团队连接，网页拒绝向私有地址发送测试请求。"""
    private = {
        "address": "https://127.0.0.1",
        "model": "fixture-model",
        "api_key": "synthetic-secret",
        "version": 0,
    }
    denied = admin.post(f"{PATH}/test", json=private)
    assert denied.status_code == 422
    assert denied.json()["code"] == "MODEL_ADDRESS_INVALID"
    assert "synthetic-secret" not in denied.text
    member = {
        "email": "model-member@example.com",
        "name": "测试成员",
        "password": "synthetic-member-password",
        "businesses": ["订单售后"],
    }
    assert admin.post("/api/users", json=member).status_code == 201
    with TestClient(create_app()) as client:
        assert client.get(PATH).status_code == 401
        assert (
            client.post(
                "/api/auth/login", json={"email": member["email"], "password": member["password"]}
            ).status_code
            == 200
        )
        assert client.get(PATH).status_code == 403
        assert client.post(f"{PATH}/test", json=private).status_code == 403
        assert client.put(PATH, json={"mode": "local_rules", "version": 0}).status_code == 403
