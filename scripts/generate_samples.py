"""Generate clearly marked mock statements; no real bank data."""

import argparse
import json
from pathlib import Path
from app.demo import make_statement


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", default="sample_data")
    args = parser.parse_args()
    folder = Path(args.output)
    folder.mkdir(parents=True, exist_ok=True)
    companies = [
        ("Лесной эспрессо", "0000000010", 4000),
        ("Утро на площади", "0000000001", 3500),
        ("Белый фильтр", "0000000002", 2500),
    ]
    manifest = []
    for index, (name, inn, quantity) in enumerate(companies, 1):
        filename = f"DEMO-{index}-1c.txt"
        (folder / filename).write_bytes(make_statement(name, inn, quantity, args.seed))
        manifest.append({"name": name, "inn": inn, "quantity": quantity, "file": filename})
    (folder / "manifest.json").write_text(
        json.dumps({"synthetic": True, "seed": args.seed, "companies": manifest}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Generated 3 synthetic statements in {folder}")


if __name__ == "__main__":
    main()
