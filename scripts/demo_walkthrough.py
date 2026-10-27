"""Exercise the running API with synthetic data and local file-based email."""

import argparse
from datetime import datetime, timedelta
from email import policy
from email.parser import BytesParser
import json
import os
from pathlib import Path
import re
from uuid import uuid4
from zoneinfo import ZoneInfo
import httpx


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--mail-dir", default="var/mail")
    parser.add_argument("--output", default="var/demo-result.json")
    args = parser.parse_args()
    email = f"demo-owner-{uuid4().hex[:10]}@example.com"
    password = os.environ.get("DEMO_PASSWORD", "LocalDemo-" + uuid4().hex)
    with httpx.Client(base_url=args.base_url, timeout=30) as client:

        def call(method, path, **kwargs):
            response = client.request(method, "/api/v1" + path, **kwargs)
            if response.status_code >= 400:
                raise RuntimeError(f"{method} {path}: {response.status_code} {response.text}")
            return response

        challenge = call(
            "POST",
            "/auth/register",
            json={"email": email, "password": password, "company_name": "Лесной эспрессо", "inn": "0000000010"},
        )
        verification = None
        for path in Path(args.mail_dir).glob("*.eml"):
            message = BytesParser(policy=policy.default).parsebytes(path.read_bytes())
            if str(message["To"]) == email:
                verification = re.search(r"\b(\d{6})\b", message.get_body(preferencelist=("plain",)).get_content()).group(1)
        if not verification:
            raise RuntimeError("No local verification email; check MAIL_MODE=file and --mail-dir.")
        token = call("POST", "/auth/verify-code", json={"email": email, "challenge_id": challenge.json()["challenge_id"], "code": verification}).json()["access_token"]
        owner = {"Authorization": "Bearer " + token}
        call("POST", "/consents", headers=owner, json={"version": "2026-10-26-v1", "accepted": True})
        demo = call("POST", "/demo/generate", headers=owner, json={"seed": 42}).json()
        actors = [owner] + [{"Authorization": "Bearer " + c["access_token"]} for c in demo["companies"][1:]]
        for actor in actors:
            data = call("GET", "/demo/statement", headers=actor).content
            call("POST", "/statement-imports", headers=actor, files={"file": ("DEMO.txt", data)})
        contract_id = call("POST", "/opportunities/discover", headers=owner).json()["items"][0]["contract_id"]
        start = (datetime.now(ZoneInfo("Europe/Moscow")) + timedelta(days=10)).replace(
            hour=9, minute=0, second=0, microsecond=0
        )
        for actor, company in zip(actors, demo["companies"]):
            question = call("GET", "/questions", headers=actor).json()["items"][0]
            call(
                "POST",
                f"/questions/{question['id']}/answers",
                headers=actor,
                json={
                    "product_id": demo["offer_id"],
                    "quantity": company["quantity"],
                    "confirmed": True,
                    "delivery_address": "Москва, Лесная улица, тестовая точка " + company["name"],
                    "delivery_window": {"start": start.isoformat(), "end": (start + timedelta(hours=3)).isoformat()},
                },
            )
        version = call("GET", f"/contracts/{contract_id}", headers=owner).json()["proposed_version"]
        for actor in actors:
            task = call("GET", "/signature-tasks", headers=actor).json()["items"][0]
            call(
                "POST",
                f"/signature-tasks/{task['id']}/sign",
                headers=actor,
                json={"version_id": version["id"], "document_hash": version["document_hash"], "accepted": True},
            )
        call(
            "POST",
            f"/demo/contracts/{contract_id}/supplier-confirmation",
            headers=owner,
            json={"version_id": version["id"], "confirmed": True},
        )
        result = call("GET", f"/contracts/{contract_id}", headers=owner).json()
        assert result["status"] == "active"
        assert result["active_version"]["payload"]["totals"]["net_savings_minor"] == 1164000
        target = Path(args.output)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(
            json.dumps(
                {
                    "owner_email": email,
                    "owner_password": password,
                    "owner_access_token": token,
                    "demo": demo,
                    "contract": result,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        document = call("GET", f"/documents/{version['id']}/download", headers=owner).content
        (target.parent / "DEMO-contract.md").write_bytes(document)
        print(f"Demo OK: active contract; net saving 11640 RUB. Local credentials: {target}")


if __name__ == "__main__":
    main()
