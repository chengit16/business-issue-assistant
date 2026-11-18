"""读写团队模型设置，先授权再测试，版本和测试凭证共同约束配置发布。"""

import hashlib
import hmac
import json

from cryptography.fernet import InvalidToken
from pydantic import BaseModel, StrictBool
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import settings
from ..contracts.inputs import ModelCatalogInput, ModelConnectionInput, ModelSettingsInput
from ..contracts.responses import ModelCatalogRead, ModelSettingsRead, ModelTestRead
from ..domain.errors import BusinessError
from ..domain.policies import require_role
from ..domain.types import Actor, AnalysisMode
from ..model_connection import ModelConnection, managed_endpoint
from ..model_secrets import model_cipher
from ..models import ModelSettings, timestamp
from ..provider import list_model_ids, model_json
from .identity import refresh_actor


def _project(row: ModelSettings | None) -> ModelSettingsRead:
    if row is None:
        return ModelSettingsRead(
            mode="model" if settings.model_enabled else "local_rules",
            address=settings.model_base_url,
            model=settings.model_name,
            has_api_key=bool(settings.model_api_key),
            version=0,
        )
    return ModelSettingsRead(
        mode=row.mode,
        address=row.address,
        model=row.model,
        has_api_key=bool(row.encrypted_key),
        version=row.version,
    )


def runtime_mode(db: Session) -> AnalysisMode:
    """读取真正生效的运行模式，不解密密钥。"""
    return _project(db.get(ModelSettings, 1)).mode


def _key(row: ModelSettings | None) -> str:
    if row is None:
        return settings.model_api_key
    try:
        return model_cipher().decrypt(row.encrypted_key.encode()).decode()
    except (InvalidToken, UnicodeError):
        raise BusinessError(
            "MODEL_KEY_UNAVAILABLE", "已存密钥无法读取，请重新填写密钥", 500
        ) from None


def active_connection(db: Session) -> ModelConnection | None:
    """每个用例读取一次连接快照，后续配置变更不会改变请求对应的模型名称。"""
    row = db.get(ModelSettings, 1)
    value = _project(row)
    if value.mode == "local_rules":
        return None
    return ModelConnection(value.address, value.model, _key(row), managed=row is not None)


def read_settings(db: Session, actor: Actor) -> ModelSettingsRead:
    """仅知识维护人可读取连接元信息，响应永远不回传密钥。"""
    require_role(actor, "maintainer")
    return _project(db.get(ModelSettings, 1))


def _credentials(data: ModelCatalogInput, row: ModelSettings | None) -> tuple[str, str]:
    current = _project(row)
    if current.version != data.version:
        raise _conflict()
    address = str(managed_endpoint(data.address)).rstrip("/")
    key = data.api_key.get_secret_value().strip() if data.api_key else ""
    # 地址改变时必须主动提交密钥，避免将已有凭证转发给其他服务。
    if not key and current.has_api_key and address == current.address.rstrip("/"):
        key = _key(row)
    if not key:
        raise BusinessError("MODEL_FIELDS_REQUIRED", "请填写 API 密钥", 422)
    if not key.isascii() or any(char.isspace() or not char.isprintable() for char in key):
        raise BusinessError("MODEL_KEY_INVALID", "API 密钥中包含不支持的字符", 422)
    return address, key


def _candidate(data: ModelConnectionInput, row: ModelSettings | None) -> ModelConnection:
    address, key = _credentials(data, row)
    if not data.model:
        raise BusinessError("MODEL_FIELDS_REQUIRED", "请选择模型", 422)
    return ModelConnection(address, data.model, key)


def fetch_catalog(db: Session, actor: Actor, data: ModelCatalogInput) -> ModelCatalogRead:
    """使用待配置的供应商凭证列出模型，只读远端目录，不改变团队配置。"""
    require_role(actor, "maintainer")
    address, key = _credentials(data, db.get(ModelSettings, 1))
    models = list_model_ids(address, key)
    require_role(refresh_actor(db, actor), "maintainer")
    return ModelCatalogRead(models=models)


def _proof(actor: Actor, version: int, connection: ModelConnection) -> bytes:
    payload = json.dumps(
        [actor.id, version, connection.address, connection.model, connection.api_key]
    )
    return b"model-test:" + hashlib.sha256(payload.encode()).digest()


class _Probe(BaseModel):
    ok: StrictBool


def test_connection(db: Session, actor: Actor, data: ModelConnectionInput) -> ModelTestRead:
    """仅发送固定测试内容，无业务资料。通过后签发有效期十分钟的配置凭证。"""
    require_role(actor, "maintainer")
    connection = _candidate(data, db.get(ModelSettings, 1))
    cipher = model_cipher(create=True)
    response = model_json('返回 JSON 对象 {"ok": true}，用于连接测试。', {}, _Probe, connection)
    if not response.ok:
        raise BusinessError("MODEL_TEST_FAILED", "模型返回格式与连接测试要求不符", 502)
    require_role(refresh_actor(db, actor), "maintainer")
    return ModelTestRead(
        test_token=cipher.encrypt(_proof(actor, data.version, connection)).decode()
    )


def _conflict() -> BusinessError:
    return BusinessError("MODEL_SETTINGS_CONFLICT", "配置已被其他维护人更新，请重新加载", 409)


def save_settings(db: Session, actor: Actor, data: ModelSettingsInput) -> ModelSettingsRead:
    """保存前复核权限和测试凭证，原子更新配置，不覆盖其他维护人的修改。"""
    # 1. 检查当前版本。切换到本地规则时保留已保存连接，以便之后恢复。
    require_role(actor, "maintainer")
    row = db.get(ModelSettings, 1)
    current = _project(row)
    if data.version != current.version:
        raise _conflict()
    address, model = current.address, current.model
    encrypted = row.encrypted_key if row else ""
    # 2. 模型模式只允许发布曾成功测试的同一组参数，服务端独立验证有效期。
    if data.mode == "model":
        connection = _candidate(data, row)
        if not data.test_token or not data.test_token.get_secret_value():
            raise BusinessError("MODEL_TEST_REQUIRED", "请先测试当前连接后再保存", 422)
        cipher = model_cipher()
        try:
            token = data.test_token.get_secret_value()
            valid = hmac.compare_digest(
                cipher.decrypt(token.encode(), ttl=600), _proof(actor, data.version, connection)
            )
        except InvalidToken:
            valid = False
        if not valid:
            raise BusinessError("MODEL_TEST_REQUIRED", "请重新测试当前连接后再保存", 422)
        address, model = connection.address, connection.model
        encrypted = cipher.encrypt(connection.api_key.encode()).decode()
    elif row is None and settings.model_api_key:
        encrypted = model_cipher(create=True).encrypt(settings.model_api_key.encode()).decode()
    # 3. 预期版本写入数据库；并发首次保存依靠唯一主键拒绝重复创建。
    values = {
        "version": data.version + 1,
        "mode": data.mode,
        "address": address,
        "model": model,
        "encrypted_key": encrypted,
        "updated_by": actor.id,
        "updated_at": timestamp(),
    }
    if row is None:
        db.add(ModelSettings(id=1, **values))
    else:
        updated = db.scalar(
            update(ModelSettings)
            .where(ModelSettings.id == 1, ModelSettings.version == data.version)
            .values(**values)
            .returning(ModelSettings.id)
        )
        if updated is None:
            raise _conflict()
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise _conflict() from None
    return ModelSettingsRead(
        mode=data.mode,
        address=address,
        model=model,
        has_api_key=bool(encrypted),
        version=data.version + 1,
    )
