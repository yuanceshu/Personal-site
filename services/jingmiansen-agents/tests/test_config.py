from dataclasses import replace

import pytest

from jingmiansen_agents.config import Settings, validate_production_settings


def make_settings() -> Settings:
    return Settings(
        api_key="test-only-key",
        base_url="https://api.minimaxi.com/v1",
        model="M2-her",
        host="127.0.0.1",
        port=7777,
        db_file="data/test.db",
    )


def test_local_configuration_keeps_sqlite_fallback() -> None:
    validate_production_settings(make_settings())


def test_vercel_configuration_requires_all_server_secrets() -> None:
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        validate_production_settings(replace(make_settings(), is_vercel=True))


def test_complete_vercel_configuration_is_accepted() -> None:
    settings = replace(
        make_settings(),
        is_vercel=True,
        database_url="postgresql://example.invalid/db",
        agent_token="agent-token",
        cron_secret="cron-secret",
    )

    validate_production_settings(settings)
