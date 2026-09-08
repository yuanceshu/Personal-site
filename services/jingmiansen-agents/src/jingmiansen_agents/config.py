import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    api_key: str
    base_url: str
    model: str
    host: str
    port: int
    db_file: str
    database_url: str = ""
    agent_token: str = ""
    cron_secret: str = ""
    is_vercel: bool = False
    max_completion_tokens: int = 1000
    request_timeout: float = 45.0
    max_retries: int = 1

    @property
    def configured(self) -> bool:
        return bool(self.api_key)


def load_settings() -> Settings:
    return Settings(
        api_key=os.getenv("MINIMAX_API_KEY", "").strip(),
        base_url=os.getenv("MINIMAX_BASE_URL", "https://api.minimaxi.com/v1").strip(),
        model=os.getenv("MINIMAX_MODEL", "M2-her").strip(),
        host=os.getenv("AGENT_OS_HOST", "127.0.0.1").strip(),
        port=int(os.getenv("AGENT_OS_PORT", "7777")),
        db_file=os.getenv("AGENT_DB_FILE", "data/jingmiansen.db").strip(),
        database_url=os.getenv("DATABASE_URL", "").strip(),
        agent_token=os.getenv("JINGMIANSEN_AGENT_TOKEN", "").strip(),
        cron_secret=os.getenv("CRON_SECRET", "").strip(),
        is_vercel=os.getenv("VERCEL", "").strip() == "1",
        max_completion_tokens=int(os.getenv("MINIMAX_MAX_COMPLETION_TOKENS", "1000")),
        request_timeout=float(os.getenv("MINIMAX_REQUEST_TIMEOUT", "45")),
        max_retries=int(os.getenv("MINIMAX_MAX_RETRIES", "1")),
    )


def validate_production_settings(settings: Settings) -> None:
    if not settings.is_vercel:
        return

    missing = [
        name
        for name, value in (
            ("MINIMAX_API_KEY", settings.api_key),
            ("DATABASE_URL", settings.database_url),
            ("JINGMIANSEN_AGENT_TOKEN", settings.agent_token),
            ("CRON_SECRET", settings.cron_secret),
        )
        if not value
    ]
    if missing:
        raise RuntimeError(
            "Vercel production configuration is incomplete: " + ", ".join(missing)
        )
