import os
import subprocess
import sys
from sqlalchemy import create_engine, text


def test_additive_profile_migration_preserves_existing_company(tmp_path):
    url = "sqlite:///" + (tmp_path / "migration.db").as_posix()
    env = {**os.environ, "DATABASE_URL": url}
    def upgrade(revision):
        subprocess.run([sys.executable, "-m", "alembic", "upgrade", revision], env=env, check=True, capture_output=True)
    upgrade("eb339db4a415")
    engine = create_engine(url)
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO companies (id, created_at, name, inn) VALUES ('existing-company', 1, 'Existing company', '1234567890')"))
    engine.dispose()
    upgrade("head")
    engine = create_engine(url)
    with engine.connect() as connection:
        row = connection.execute(text("SELECT name, inn, profile_revision, contact_email FROM companies WHERE id='existing-company'")).one()
        assert tuple(row) == ("Existing company", "1234567890", 0, None)
    engine.dispose()
