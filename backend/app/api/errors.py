"""统一映射公开错误，保留旧 detail 字段并携带稳定错误码和请求编号。"""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from ..contracts.responses import ErrorRead
from ..domain.errors import BusinessError

logger = logging.getLogger(__name__)


def failure(request: Request, code: str, message: str, status: int) -> JSONResponse:
    """构造无秘密的错误响应，request_id 与同次请求响应头保持一致。"""
    value = ErrorRead(
        code=code,
        message=message,
        detail=message,
        request_id=str(getattr(request.state, "request_id", "")),
    )
    return JSONResponse(
        value.model_dump(),
        status_code=status,
        headers={
            "X-Request-ID": value.request_id,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


def install_error_handlers(app: FastAPI) -> None:
    """集中注册业务、输入与未知错误映射，避免 Router 各自包装错误。"""

    async def business_error(request: Request, error: Exception) -> JSONResponse:
        if not isinstance(error, BusinessError):
            raise error
        return failure(request, error.code, error.message, error.status)

    async def validation_error(request: Request, error: Exception) -> JSONResponse:
        return failure(request, "VALIDATION_ERROR", "请检查输入内容后重试", 422)

    async def http_error(request: Request, error: Exception) -> JSONResponse:
        if not isinstance(error, HTTPException):
            raise error
        return failure(
            request,
            "NOT_FOUND" if error.status_code == 404 else "HTTP_ERROR",
            "请求的资源不存在" if error.status_code == 404 else "请求无法完成",
            error.status_code,
        )

    async def unexpected_error(request: Request, error: Exception) -> JSONResponse:
        # 异常正文可能包含 SQL 参数和材料内容，只记录排查标识与错误类型。
        logger.error(
            "请求失败 request_id=%s error_type=%s",
            getattr(request.state, "request_id", ""),
            type(error).__name__,
        )
        return failure(request, "INTERNAL_ERROR", "服务暂时不可用，请稍后重试", 500)

    app.add_exception_handler(BusinessError, business_error)
    app.add_exception_handler(RequestValidationError, validation_error)
    app.add_exception_handler(HTTPException, http_error)
    app.add_exception_handler(Exception, unexpected_error)
