import json
from pathlib import Path
from app.main import app


def main():
    target = Path("docs/openapi.json")
    target.parent.mkdir(exist_ok=True)
    schema = app.openapi()
    target.write_text(json.dumps(schema, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{target}: {len(schema['paths'])} paths")


if __name__ == "__main__":
    main()
