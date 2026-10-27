"""Run periodically to reconcile expired tasks; actions also check expiry synchronously."""

import time
from sqlalchemy import select
from app.db import SessionLocal
from app.models import Contract, Version
from app.contracts import expire_if_needed


def main():
    with SessionLocal() as db:
        ids = list(
            db.scalars(
                select(Version.id).where(
                    Version.status == "awaiting_signatures", Version.expires_at <= int(time.time())
                )
            )
        )
    count = 0
    for version_id in ids:
        with SessionLocal() as db:
            version = db.get(Version, version_id)
            contract = db.scalar(select(Contract).where(Contract.id == version.contract_id).with_for_update())
            db.refresh(version)
            count += int(expire_if_needed(db, contract, version))
    print(f"Expired {count} versions")


if __name__ == "__main__":
    main()
