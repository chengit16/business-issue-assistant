"""维护同源写入保护与请求上下文，响应和远端调用使用同一规范化请求编号。"""

import logging
import re
from urllib.parse import urlparse
from uuid import UUID, uuid4

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from ..context import request_id, traceparent
from .errors import failure

logger = logging.getLogger(__name__)


def _request_id(value: str | None) -> str:
    try:
        return str(UUID(value)) if value else str(uuid4())
    except ValueError:
        return str(uuid4())


def _traceparent(value: str) -> str:
    if not re.fullmatch(r"[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}", value):
        return ""
    version, trace, span, _ = value.split("-")
    return value if version != "ff" and trace != "0" * 32 and span != "0" * 16 else ""


def _same_origin(origin: str, host: str | None) -> bool:
    try:
        parsed = urlparse(origin)
        return parsed.scheme in ("http", "https") and parsed.netloc == host
    except ValueError:
        return False


class RequestMiddleware(BaseHTTPMiddleware):
    """拒绝跨源 Cookie 写操作，隔离并传播每次请求的追踪标识。"""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """请求开始时建立上下文，成功和失败均返回编号，结束后清理当前任务的值。"""
        # 1. 规范化外部标识，防止任意请求头内容进入日志或远端服务。
        request.state.request_id = _request_id(request.headers.get("x-request-id"))
        request_token = request_id.set(request.state.request_id)
        trace_token = traceparent.set(_traceparent(request.headers.get("traceparent", "")))
        try:
            # 2. 浏览器写入先校验同源，命令行客户端仍受会话与业务授权约束。
            origin = request.headers.get("origin")
            response: Response
            if (
                request.method not in ("GET", "HEAD", "OPTIONS")
                and origin
                and not _same_origin(origin, request.headers.get("host"))
            ):
                response = failure(request, "FORBIDDEN", "请从同一站点提交操作", 403)
            else:
                try:
                    response = await call_next(request)
                except Exception as error:
                    # 不将可能包含 SQL 参数、原文或模型内容的异常正文交给默认服务器日志。
                    logger.error(
                        "请求失败 request_id=%s error_type=%s",
                        request_id.get(),
                        type(error).__name__,
                    )
                    response = failure(request, "INTERNAL_ERROR", "服务暂时不可用，请稍后重试", 500)
            # 3. 所有响应共享安全头，上下文在当前等待结束后复位。
            response.headers["X-Request-ID"] = request.state.request_id
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["Cache-Control"] = "no-store"
            return response
        finally:
            request_id.reset(request_token)
            traceparent.reset(trace_token)
