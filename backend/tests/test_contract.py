"""验证公开协议、稳定错误码和请求编号，以及旧快照字段的兼容投影。"""

from uuid import UUID

from fastapi.testclient import TestClient

from app.factory import create_app


def test_factories_have_unique_stable_operations() -> None:
    """重复创建应用不重复注册路由，公开 JSON 接口都有具名响应模型。"""
    first = create_app().openapi()
    second = create_app().openapi()
    assert first == second
    operations = [
        operation
        for path in first["paths"].values()
        for method, operation in path.items()
        if method in ("get", "post", "put")
    ]
    identifiers = [operation["operationId"] for operation in operations]
    assert len(identifiers) == len(set(identifiers))
    for operation in operations:
        for status, response in operation["responses"].items():
            if status in ("200", "201") and "application/json" in response.get("content", {}):
                assert "$ref" in response["content"]["application/json"]["schema"]


def test_errors_have_codes_and_matching_request_ids() -> None:
    """输入、身份和跨源拒绝共享可展示错误契约，不包含原始敏感输入。"""
    with TestClient(create_app()) as client:
        response = client.get("/api/auth/me")
        assert response.status_code == 401
        assert response.json()["code"] == "AUTH_REQUIRED"
        assert response.json()["request_id"] == response.headers["X-Request-ID"]
        UUID(response.headers["X-Request-ID"])
        response = client.post(
            "/api/auth/login",
            json={"email": "only-one-field"},
            headers={"X-Request-ID": "invalid-id"},
        )
        assert response.status_code == 422
        assert response.json()["code"] == "VALIDATION_ERROR"
        assert "only-one-field" not in response.text
        UUID(response.headers["X-Request-ID"])
        response = client.post("/api/auth/logout", headers={"Origin": "https://other.invalid"})
        assert response.status_code == 403
        assert response.json()["code"] == "FORBIDDEN"
