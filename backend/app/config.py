"""集中读取数据库、文件与模型配置，并在启动时拒绝不完整的部署参数。"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """启动配置，模型参数需同时提供，开发默认口令仅用于本地。"""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./data/assistant.db"
    upload_dir: Path = Path("data/uploads")
    admin_email: str = "admin@example.com"
    admin_name: str = "知识维护人"
    admin_password: str = "local-dev-2026"
    cookie_secure: bool = False
    app_env: str = "development"
    model_base_url: str = ""
    model_api_key: str = ""
    model_name: str = ""

    @property
    def model_enabled(self) -> bool:
        return bool(self.model_base_url and self.model_api_key and self.model_name)


settings = Settings()
# 演示口令仅供本地运行，部署时必须显式配置管理员凭证。
if settings.app_env != "development" and settings.admin_password == "local-dev-2026":
    raise RuntimeError("部署环境必须设置 ADMIN_PASSWORD")
settings.upload_dir.mkdir(parents=True, exist_ok=True)

if (
    any((settings.model_base_url, settings.model_api_key, settings.model_name))
    and not settings.model_enabled
):
    raise RuntimeError("模型服务需要同时配置 MODEL_BASE_URL、MODEL_API_KEY、MODEL_NAME")
