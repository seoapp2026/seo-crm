"""Tests for scripts/backup.sh — run against a temp dir, never the real repo DBs."""

import os
import subprocess
import tarfile
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "scripts" / "backup.sh"


@pytest.fixture()
def db_dir(tmp_path):
    d = tmp_path / "db"
    d.mkdir()
    (d / "seo_crm.db").write_bytes(b"fake sqlite content")
    (d / "seo_crm_test_manual.db").write_bytes(b"fake sqlite content 2")
    return d


def _run(db_dir, backup_dir, extra_env=None):
    env = {**os.environ, "DB_DIR": str(db_dir), "BACKUP_DIR": str(backup_dir)}
    if extra_env:
        env.update(extra_env)
    return subprocess.run(
        ["bash", str(SCRIPT)],
        env=env,
        capture_output=True,
        text=True,
    )


def test_backup_creates_archive_containing_db_files(db_dir, tmp_path):
    backup_dir = tmp_path / "backups"
    result = _run(db_dir, backup_dir)
    assert result.returncode == 0, result.stderr

    archives = list(backup_dir.glob("seo-crm-backup-*.tar.gz"))
    assert len(archives) == 1
    with tarfile.open(archives[0]) as tar:
        names = tar.getnames()
    assert "seo_crm.db" in names
    assert "seo_crm_test_manual.db" in names
    # Archived content matches the source bytes.
    with tarfile.open(archives[0]) as tar:
        assert tar.extractfile("seo_crm.db").read() == b"fake sqlite content"


def test_backup_db_dir_via_first_argument(db_dir, tmp_path):
    backup_dir = tmp_path / "backups"
    result = subprocess.run(
        ["bash", str(SCRIPT), str(db_dir), str(backup_dir)],
        env=os.environ.copy(),
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    archives = list(backup_dir.glob("seo-crm-backup-*.tar.gz"))
    assert len(archives) == 1
    with tarfile.open(archives[0]) as tar:
        assert "seo_crm.db" in tar.getnames()


def test_backup_fails_when_no_db_files(tmp_path):
    empty = tmp_path / "empty"
    empty.mkdir()
    result = _run(empty, tmp_path / "backups")
    assert result.returncode != 0
    assert "no .db files" in result.stderr
