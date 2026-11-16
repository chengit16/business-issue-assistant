"""表达业务拒绝原因，HTTP 状态及公开响应统一由接口层映射。"""

from typing import Literal

ErrorCode = Literal[
    "AUTH_REQUIRED",
    "INVALID_CREDENTIALS",
    "FORBIDDEN",
    "NOT_FOUND",
    "EMAIL_EXISTS",
    "INVALID_INPUT",
    "VERIFICATION_REQUIRED",
    "VERSION_CONFLICT",
    "IDEMPOTENCY_CONFLICT",
    "MODEL_UNAVAILABLE",
    "DATA_INTEGRITY_ERROR",
    "UPLOAD_TOO_LARGE",
    "INVALID_IMAGE",
]


class BusinessError(Exception):
    """可公开的业务错误，消息不得包含存储路径、口令或第三方响应正文。"""

    def __init__(self, code: ErrorCode, message: str, status: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
