"""提供团队模型配置、目录读取和试连接口，权限与事务交给用例层。"""

from fastapi import APIRouter

from ..application import model_settings
from ..contracts.inputs import ModelCatalogInput, ModelConnectionInput, ModelSettingsInput
from ..contracts.responses import ModelCatalogRead, ModelSettingsRead, ModelTestRead
from .dependencies import DB, CurrentActor

router = APIRouter(prefix="/settings/model", tags=["模型配置"])


@router.get("", response_model=ModelSettingsRead, operation_id="readModelSettings")
def read(actor: CurrentActor, db: DB) -> ModelSettingsRead:
    """仅知识维护人可读取当前模式及凭证是否已配置。"""
    return model_settings.read_settings(db, actor)


@router.post("/models", response_model=ModelCatalogRead, operation_id="fetchModelCatalog")
def models(data: ModelCatalogInput, actor: CurrentActor, db: DB) -> ModelCatalogRead:
    """密钥通过请求体传递，读取该凭证可见的供应商模型。"""
    return model_settings.fetch_catalog(db, actor, data)


@router.post("/test", response_model=ModelTestRead, operation_id="testModelSettings")
def test(data: ModelConnectionInput, actor: CurrentActor, db: DB) -> ModelTestRead:
    """连接验证只发送合成内容，成功返回短期凭证。"""
    return model_settings.test_connection(db, actor, data)


@router.put("", response_model=ModelSettingsRead, operation_id="saveModelSettings")
def save(data: ModelSettingsInput, actor: CurrentActor, db: DB) -> ModelSettingsRead:
    """知识维护人保存通过验证的配置，成功后新请求立即使用。"""
    return model_settings.save_settings(db, actor, data)
