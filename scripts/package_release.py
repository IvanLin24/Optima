"""Package an explicit allowlist; never include local DB, email, credentials or virtualenv."""

import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED


def main():
    root = Path(__file__).resolve().parents[1]
    files = []
    for folder in ("app", "scripts", "migrations", "docs", "tests", "sample_data", "deploy", "frontend"):
        for file in (root / folder).rglob("*"):
            if file.is_file() and "__pycache__" not in file.parts and 'node_modules' not in file.parts and file.suffix != ".pyc":
                files.append(file)
    for name in (
        "README.md",
        "AGENTS.md",
        "requirements.txt",
        "requirements-dev.txt",
        "pyproject.toml",
        ".env.example",
        ".gitignore",
        ".dockerignore",
        "Dockerfile",
        "compose.yaml",
        "alembic.ini",
    ):
        files.append(root / name)
    files = sorted(set(files))
    manifest = {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
    folder = root / "dist"
    folder.mkdir(exist_ok=True)
    target = folder / "procurement-backend-mvp.zip"
    with ZipFile(target, "w", ZIP_DEFLATED) as archive:
        for file in files:
            archive.write(file, file.relative_to(root).as_posix())
        archive.writestr("RELEASE_MANIFEST.json", json.dumps(manifest, indent=2))
    with ZipFile(target) as archive:
        assert archive.testzip() is None
        assert all(hashlib.sha256(archive.read(name)).hexdigest() == checksum for name, checksum in manifest.items())
        assert not any(
            name.endswith((".db", ".eml")) or name == ".env" or name.startswith("var/") for name in archive.namelist()
        )
    print(f"{target.name}: {len(files)} files, {target.stat().st_size} bytes, hashes verified")


if __name__ == "__main__":
    main()
