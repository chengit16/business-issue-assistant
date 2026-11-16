"""维护口令摘要计算，身份恢复及授权分别由应用用例与领域规则负责。"""

import hashlib
import hmac
import secrets


def hash_password(password: str) -> str:
    """使用独立随机盐与 PBKDF2 保存摘要，原始口令不入库。"""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 600000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    """常量时间核验摘要，损坏的历史摘要默认拒绝，避免暴露解析错误。"""
    try:
        salt, digest = stored.split("$", maxsplit=1)
    except ValueError:
        return False
    actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 600000).hex()
    return hmac.compare_digest(actual, digest)
