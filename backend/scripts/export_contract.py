"""从真实应用路由导出 OpenAPI 和前端运行时 Schema，检查模式拒绝过期产物。"""

import argparse
import json
import sys
from pathlib import Path

from app.factory import create_app

ROOT = Path(__file__).resolve().parents[2]


def main() -> int:
    """生成协议产物或核对仓库版本，不启动生命周期或访问业务数据。"""
    parser = argparse.ArgumentParser(description="生成或检查接口契约")
    parser.add_argument("--check", action="store_true")
    arguments = parser.parse_args()
    document = create_app().openapi()
    schemas = json.loads(
        json.dumps(document["components"]["schemas"]).replace("#/components/schemas/", "#/$defs/")
    )
    artifacts = {
        ROOT / "backend/openapi.json": document,
        ROOT / "frontend/src/api/contract.json": {
            "$id": "urn:business-issue:contract",
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "$defs": schemas,
        },
    }
    for path, value in artifacts.items():
        text = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
        if arguments.check:
            if not path.is_file() or path.read_text(encoding="utf-8") != text:
                print(
                    f"接口契约已过期，请执行 npm run contract:generate，产物为 {path.relative_to(ROOT)}"
                )
                return 1
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
