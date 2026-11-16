"""保留 Uvicorn 兼容入口，具体装配通过应用工厂维护。"""

from .factory import create_app

app = create_app()
