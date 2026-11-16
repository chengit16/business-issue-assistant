"""验证配置在启动边界拒绝无效状态，错误及对象表示不回显秘密。"""

import pytest
from pydantic import ValidationError

from app.config import Settings


def test_partial_model_configuration_is_rejected() -> None:
    """缺少任一参数时不能悄悄切换为本地成功结果。"""
    with pytest.raises(ValidationError):
        Settings(model_name="test-model", model_base_url="", model_api_key="", _env_file=None)


def test_configuration_representation_hides_secrets() -> None:
    """配置对象及校验错误均不包含原始口令或连接秘密。"""
    settings = Settings(admin_password="{{SECRET_vw5xsqol}}", _env_file=None)
    assert "{{SECRET_vw5xsqol}}" not in repr(settings)
    with pytest.raises(ValidationError) as error:
        Settings(admin_password="tiny", _env_file=None)
    assert "input_value" not in str(error.value)
