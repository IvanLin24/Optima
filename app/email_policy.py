from functools import lru_cache
from pathlib import Path
from app.errors import fail


@lru_cache
def disposable_domains():
    return frozenset(
        line.strip().lower()
        for line in (Path(__file__).parent / "data/disposable_domains.txt").read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    )


def allowed_email(email):
    normalized = str(email).strip().lower()
    domain = normalized.rsplit("@", 1)[-1].encode("idna").decode("ascii")
    parts = domain.split(".")
    if any(".".join(parts[index:]) in disposable_domains() for index in range(len(parts) - 1)):
        fail(422, "DISPOSABLE_EMAIL", "Одноразовая почта не подходит. Используйте постоянный адрес.")
    return normalized
