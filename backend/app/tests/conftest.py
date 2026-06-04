from __future__ import annotations

import atexit
import os
import tempfile
from pathlib import Path


TEST_DB_PATH = Path(tempfile.gettempdir()) / f"memolution_pytest_{os.getpid()}.db"


def cleanup_test_db() -> None:
    for suffix in ("", "-shm", "-wal"):
        TEST_DB_PATH.with_name(TEST_DB_PATH.name + suffix).unlink(missing_ok=True)


os.environ.setdefault("JWT_SECRET", "dev-test-secret-value-with-32-plus-chars")
os.environ.setdefault("ADMIN_LOGIN", "admin")
os.environ.setdefault("ADMIN_PASSWORD", "dev-admin-password")
os.environ.setdefault("DATABASE_URL", f"sqlite+aiosqlite:///{TEST_DB_PATH}")
atexit.register(cleanup_test_db)
