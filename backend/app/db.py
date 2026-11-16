"""配置关系型存储与请求级 Session，业务写入的提交及回滚由用例边界控制。"""

from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    """集中登记业务表的声明式元数据，供 Alembic 迁移使用。"""


if settings.database_url.startswith("sqlite:///"):
    Path(settings.database_url.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False, "timeout": 20}
    if settings.database_url.startswith("sqlite")
    else {},
)
if settings.database_url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")


SessionLocal = sessionmaker(engine, expire_on_commit=False)


def get_db():
    """为单次请求提供 Session，退出作用域时释放连接及未提交事务。"""
    with SessionLocal() as session:
        yield session
