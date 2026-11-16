"""启动临时 PostgreSQL 容器执行真实迁移与接口测试，结束后清理临时数据。"""

import os
import secrets
import subprocess
import sys
import time
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]


def docker(*arguments: str) -> str:
    """有界执行命令，失败不打印可能含凭证的完整参数。"""
    result = subprocess.run(["docker", *arguments], capture_output=True, text=True, timeout=180)
    if result.returncode:
        raise RuntimeError("Docker 命令未完成")
    return result.stdout.strip()


def main() -> int:
    """测试仅使用随机命名容器与回环端口，不访问既有数据库卷。"""
    name = "business-standards-" + secrets.token_hex(5)
    password = secrets.token_hex(20)
    started = False
    try:
        # 1. 独立容器、临时凭证和随机端口隔离既有开发数据。
        docker("info", "--format", "{{.ServerVersion}}")
        print("正在启动隔离 PostgreSQL 测试容器", flush=True)
        docker(
            "run",
            "--detach",
            "--rm",
            "--name",
            name,
            "-e",
            "POSTGRES_DB=standards_test",
            "-e",
            "POSTGRES_USER=assistant",
            "-e",
            f"POSTGRES_PASSWORD={password}",
            "-p",
            "127.0.0.1::5432",
            "postgres:17-alpine",
        )
        started = True
        for _ in range(60):
            probe = subprocess.run(
                [
                    "docker",
                    "exec",
                    name,
                    "pg_isready",
                    "-h",
                    "127.0.0.1",
                    "-U",
                    "assistant",
                    "-d",
                    "standards_test",
                ],
                capture_output=True,
            )
            if probe.returncode == 0:
                break
            time.sleep(1)
        else:
            raise RuntimeError("PostgreSQL 尚未就绪")
        port = docker("port", name, "5432/tcp").rsplit(":", 1)[1]
        # 2. 连接地址仅传给子进程，原有 .env 和默认数据库保持独立。
        environment = dict(os.environ)
        environment["TEST_DATABASE_URL"] = (
            f"postgresql+psycopg://assistant:{password}@127.0.0.1:{port}/standards_test"
        )
        print("正在对 PostgreSQL 执行迁移和业务测试", flush=True)
        return subprocess.run(
            [sys.executable, "-m", "pytest", "-q"], cwd=BACKEND, env=environment
        ).returncode
    except (RuntimeError, subprocess.TimeoutExpired, FileNotFoundError) as error:
        print(f"PostgreSQL 验证未完成，{type(error).__name__}", file=sys.stderr)
        return 1
    finally:
        # 3. 无论验证结果如何，只清理当前脚本创建的容器。
        if started:
            subprocess.run(["docker", "stop", name], capture_output=True, timeout=30)


if __name__ == "__main__":
    sys.exit(main())
