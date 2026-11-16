"""保存单次请求的追踪上下文，线程池通过 ContextVar 继承，不保存用户正文或凭证。"""

from contextvars import ContextVar

request_id: ContextVar[str] = ContextVar("request_id", default="")
traceparent: ContextVar[str] = ContextVar("traceparent", default="")
