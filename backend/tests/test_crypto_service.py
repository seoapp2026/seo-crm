"""Tests for credential encryption at rest (services/crypto_service.py)."""

import logging

import pytest
from cryptography.fernet import Fernet

from app.config import settings
from app.models import Project
from app.routers.projects import _apply_payload
from app.schemas import ProjectUpdate
from app.services import crypto_service
from app.services.crypto_service import decrypt_value, encrypt_value, read_secret, store_secret


@pytest.fixture()
def encryption_key(monkeypatch):
    key = Fernet.generate_key().decode()
    monkeypatch.setattr(settings, "app_encryption_key", key)
    crypto_service._warned_missing_key = False
    yield key
    crypto_service._warned_missing_key = False


@pytest.fixture()
def no_encryption_key(monkeypatch):
    monkeypatch.setattr(settings, "app_encryption_key", "")
    crypto_service._warned_missing_key = False
    yield
    crypto_service._warned_missing_key = False


class TestRoundtrip:
    def test_encrypt_decrypt_roundtrip(self, encryption_key):
        secret = "ya29.some-google-access-token"
        ciphertext = encrypt_value(secret)
        assert ciphertext != secret
        assert decrypt_value(ciphertext) == secret

    def test_store_read_secret_roundtrip(self, encryption_key):
        secret = "abcd efgh ijkl mnop"
        stored = store_secret(secret)
        assert stored != secret
        assert read_secret(stored) == secret

    def test_none_and_empty_pass_through(self, encryption_key):
        assert store_secret(None) is None
        assert store_secret("") == ""
        assert read_secret(None) is None
        assert read_secret("") == ""

    def test_ciphertext_is_valid_fernet(self, encryption_key):
        # Independently verify with the raw key — proves real encryption, not encoding.
        secret = "wp-app-password-123"
        token = encrypt_value(secret)
        assert Fernet(encryption_key.encode()).decrypt(token.encode()).decode() == secret


class TestNoKeyFallback:
    def test_store_secret_returns_plaintext(self, no_encryption_key):
        assert store_secret("plain-secret") == "plain-secret"

    def test_read_secret_returns_value_as_is(self, no_encryption_key):
        assert read_secret("anything-at-all") == "anything-at-all"
        assert decrypt_value("anything-at-all") == "anything-at-all"

    def test_warning_logged_once(self, no_encryption_key, caplog):
        with caplog.at_level(logging.WARNING, logger="app.services.crypto_service"):
            store_secret("x")
            store_secret("y")
        warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
        assert len(warnings) == 1
        assert "APP_ENCRYPTION_KEY" in warnings[0].getMessage()


class TestMigrateOnRead:
    def test_legacy_plaintext_returned_as_is(self, encryption_key):
        assert decrypt_value("legacy-plaintext-password") == "legacy-plaintext-password"
        assert read_secret("legacy-plaintext-password") == "legacy-plaintext-password"

    def test_value_encrypted_with_other_key_returned_as_is(self, encryption_key):
        other_ciphertext = Fernet(Fernet.generate_key()).encrypt(b"secret").decode()
        assert decrypt_value(other_ciphertext) == other_ciphertext


class TestProjectWriteWrapsPassword:
    def test_apply_payload_encrypts_wp_app_password(self, encryption_key):
        project = Project(name="Test")
        _apply_payload(project, ProjectUpdate(wp_app_password="my-wp-password"))
        assert project.wp_app_password != "my-wp-password"
        assert read_secret(project.wp_app_password) == "my-wp-password"

    def test_apply_payload_plaintext_when_no_key(self, no_encryption_key):
        project = Project(name="Test")
        _apply_payload(project, ProjectUpdate(wp_app_password="my-wp-password"))
        assert project.wp_app_password == "my-wp-password"
