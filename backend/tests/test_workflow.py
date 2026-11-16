"""验证录入、确认、引用与反馈之间的业务约束。"""

import os
from collections.abc import Generator
from uuid import uuid4

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from pydantic import JsonValue, TypeAdapter

from alembic import command
from app.main import app


@pytest.fixture(scope="module")
def client() -> Generator[TestClient, None, None]:
    command.upgrade(Config("alembic.ini"), "head")
    with TestClient(app) as browser:
        result = browser.post(
            "/api/auth/login",
            json={"email": "admin@example.com", "password": os.environ["ADMIN_PASSWORD"]},
        )
        assert result.status_code == 200
        yield browser


def headers() -> dict[str, str]:
    """每次逻辑写入生成独立幂等键，重试测试显式复用返回值。"""
    return {"Idempotency-Key": str(uuid4())}


def draft(client: TestClient, text: str = "客户已经扣款但订单还是待支付") -> dict[str, JsonValue]:
    """创建合成原文和草稿，同时保护同键重放与异内容拒绝规则。"""
    source = client.post("/api/sources", data={"business": "订单售后", "text": text})
    assert source.status_code == 201, source.text
    payload = {
        "source_id": source.json()["id"],
        "title": "测试支付状态同步",
        "symptom": text,
        "conditions": "测试渠道甲",
        "solution": "由处理人核对支付流水",
        "verification": "测试处理人已核对恢复",
    }
    key = headers()
    response = client.post("/api/drafts", json=payload, headers=key)
    assert response.status_code == 201, response.text
    assert (
        client.post("/api/drafts", json=payload, headers=key).json()["id"] == response.json()["id"]
    )
    assert (
        client.post("/api/drafts", json={**payload, "title": "其他内容"}, headers=key).status_code
        == 409
    )
    return TypeAdapter(dict[str, JsonValue]).validate_python(response.json())


def update_payload(item: dict[str, JsonValue], **changes: JsonValue) -> dict[str, JsonValue]:
    """只提交公开可编辑字段，保留预期版本以验证并发覆盖保护。"""
    fields = (
        "title",
        "symptom",
        "conditions",
        "investigation",
        "cause",
        "solution",
        "verification",
        "publication",
        "validity",
        "version",
    )
    return {**{key: item[key] for key in fields}, **changes}


def test_full_workflow_and_version_conflict(client: TestClient) -> None:
    item = draft(client)
    assert item["publication"] == "pending"
    assert item["validity"] == "unverified"
    assert (
        client.put(
            f"/api/cases/{item['id']}",
            json=update_payload(item, validity="verified", verification=""),
        ).status_code
        == 422
    )
    payload = update_payload(item, publication="published", validity="verified")
    published = client.put(f"/api/cases/{item['id']}", json=payload)
    assert published.status_code == 200, published.text
    assert published.json()["version"] == 2
    assert client.put(f"/api/cases/{item['id']}", json=payload).status_code == 409
    assert len(client.get(f"/api/cases/{item['id']}/revisions").json()) == 2
    analysis_key = headers()
    question = {"text": item["symptom"], "business": "订单售后"}
    result = client.post("/api/analyses", json=question, headers=analysis_key)
    assert result.status_code == 201, result.text
    run = result.json()
    assert run["run"]["result"]["citations"][0]["id"] == item["id"]
    assert (
        client.post("/api/analyses", json=question, headers=analysis_key).json()["question"]["id"]
        == run["question"]["id"]
    )
    feedback_url = f"/api/questions/{run['question']['id']}/feedback"
    key = headers()
    feedback = {"outcome": "resolved", "note": "处理人核对后已恢复"}
    first = client.post(feedback_url, json=feedback, headers=key)
    assert first.status_code == 201
    assert client.post(feedback_url, json=feedback, headers=key).json()["id"] == first.json()["id"]
    stored = client.get(f"/api/questions/{run['question']['id']}").json()
    assert stored["question"]["progress"] == "resolved"
    assert len(stored["feedback"]) == 1
    assert client.get(f"/api/sources/{item['source_id']}").json()["text"] == item["symptom"]


def test_unpublished_and_invalid_cases_are_not_recommended(client: TestClient) -> None:
    item = draft(client, "专用检索文本灯塔标记")
    result = client.post(
        "/api/analyses", json={"text": "灯塔标记", "business": "订单售后"}, headers=headers()
    ).json()
    assert not any(
        citation["id"] == item["id"] for citation in result["run"]["result"]["citations"]
    )
    payload = update_payload(item, publication="published", validity="invalid")
    assert client.put(f"/api/cases/{item['id']}", json=payload).status_code == 200
    result = client.post(
        "/api/analyses", json={"text": "灯塔标记", "business": "订单售后"}, headers=headers()
    ).json()
    assert not result["run"]["result"]["citations"]


def test_permissions_cover_sources_and_publication(client: TestClient) -> None:
    item = draft(client)
    person = {
        "email": "member@example.com",
        "name": "测试同事",
        "password": "member-test-2026",
        "role": "member",
        "businesses": ["营销活动"],
    }
    assert client.post("/api/users", json=person).status_code == 201
    with TestClient(app) as member:
        assert member.get("/api/cases", params={"business": "订单售后"}).status_code == 401
        assert (
            member.post(
                "/api/auth/login", json={"email": person["email"], "password": person["password"]}
            ).status_code
            == 200
        )
        for path in (f"/api/cases/{item['id']}", f"/api/sources/{item['source_id']}"):
            hidden = member.get(path)
            assert hidden.status_code == 404
            assert hidden.json()["code"] == "NOT_FOUND"
        assert (
            member.post(
                "/api/analyses",
                json={"text": "订单问题测试", "business": "订单售后"},
                headers=headers(),
            ).status_code
            == 403
        )
        mine = member.post(
            "/api/sources", data={"business": "营销活动", "text": "营销活动测试资料"}
        ).json()
        case = member.post(
            "/api/drafts",
            json={
                "source_id": mine["id"],
                "title": "优惠券不可用",
                "symptom": "提示不符合活动要求",
            },
            headers=headers(),
        ).json()
        assert (
            member.put(
                f"/api/cases/{case['id']}", json=update_payload(case, publication="published")
            ).status_code
            == 403
        )
        assert member.post("/api/auth/logout").status_code == 204
        assert member.get("/api/auth/me").status_code == 401


def test_upload_signature_size_and_csrf(client: TestClient) -> None:
    response = client.post(
        "/api/sources",
        data={"business": "订单售后", "text": "测试图片"},
        files={"file": ("fake.png", b"<script>unsafe</script>", "image/png")},
    )
    assert response.status_code == 422
    response = client.post(
        "/api/sources",
        data={"business": "订单售后", "text": "测试图片"},
        files={"file": ("large.png", b"a" * (5 * 1024 * 1024 + 1), "image/png")},
    )
    assert response.status_code == 413
    assert (
        client.post("/api/auth/logout", headers={"Origin": "https://other.invalid"}).status_code
        == 403
    )


def test_model_adapter_and_retry_preserve_source(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    import json

    import httpx

    from app.config import settings

    monkeypatch.setattr(settings, "model_base_url", "https://model.invalid/v1")
    monkeypatch.setattr(settings, "model_api_key", "test-model-token")
    monkeypatch.setattr(settings, "model_name", "test-model")
    calls = []
    advice = {
        "summary": "需要继续核对支付状态",
        "steps": ["核对支付渠道和订单编号"],
        "missing": ["业务编号"],
        "reply": "请补充订单编号和渠道",
    }

    def respond(url: str, **kwargs: object) -> httpx.Response:
        calls.append(kwargs["json"])
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": json.dumps(advice)}}]},
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(httpx, "post", respond)
    material = client.post(
        "/api/sources", data={"business": "订单售后", "text": "原始背景独立编号 XYZ"}
    ).json()
    query = {"text": "客户扣款后订单仍待支付", "business": "订单售后", "source_id": material["id"]}
    result = client.post("/api/analyses", json=query, headers=headers())
    assert result.status_code == 201, result.text
    assert result.json()["run"]["result"]["mode"] == "model"
    assert json.loads(calls[0]["messages"][1]["content"])["source_text"] == "原始背景独立编号 XYZ"

    def malformed(url: str, **kwargs: object) -> httpx.Response:
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "{}"}}]},
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(httpx, "post", malformed)
    key = headers()
    assert client.post("/api/analyses", json=query, headers=key).status_code == 502
    monkeypatch.setattr(httpx, "post", respond)
    assert client.post("/api/analyses", json=query, headers=key).status_code == 201

    content = {"title": "支付状态问题", "symptom": "已扣款但订单待支付"}
    advice.clear()
    advice.update(content)
    preview = client.post(
        "/api/drafts/preview", json={"text": "已扣款订单待支付", "business": "订单售后"}
    )
    assert preview.status_code == 200, preview.text
    assert preview.json()["mode"] == "model"
    assert preview.json()["rule_version"].startswith("intake-v1-")


def test_single_character_first_line_preview(client: TestClient) -> None:
    response = client.post(
        "/api/drafts/preview", json={"text": "甲\n订单出现错误", "business": "订单售后"}
    )
    assert response.status_code == 200, response.text


def test_cached_analysis_rechecks_current_citations(client: TestClient) -> None:
    item = draft(client, "回放版本核对专用标记")
    published = client.put(
        f"/api/cases/{item['id']}",
        json=update_payload(item, publication="published", validity="verified"),
    ).json()
    key = headers()
    query = {"text": "回放版本核对专用标记", "business": "订单售后"}
    first = client.post("/api/analyses", json=query, headers=key).json()
    assert first["run"]["result"]["citations"][0]["currently_available"]
    assert (
        client.put(
            f"/api/cases/{item['id']}", json=update_payload(published, validity="invalid")
        ).status_code
        == 200
    )
    replay = client.post("/api/analyses", json=query, headers=key).json()
    assert replay["question"]["id"] == first["question"]["id"]
    assert not replay["run"]["result"]["citations"][0]["currently_available"]
    assert replay["run"]["result"]["summary"] == "引用案例已发生变化，请重新分析当前问题。"
    assert (
        client.get(f"/api/questions/{first['question']['id']}").json()["run"]["result"]
        == replay["run"]["result"]
    )
