from pathlib import Path
from time import time

from agno.db.base import BaseDb, SessionType
from agno.db.postgres import PostgresDb
from agno.db.sqlite import SqliteDb

from .config import Settings

ALLOWED_AGENT_IDS = {"lingmian", "felica", "marina"}
RETENTION_SECONDS = 30 * 24 * 60 * 60


def normalize_postgres_url(database_url: str) -> str:
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+psycopg://", 1)
    return database_url


def build_database(settings: Settings) -> BaseDb | None:
    if not settings.configured:
        return None

    if settings.database_url:
        return PostgresDb(db_url=normalize_postgres_url(settings.database_url))

    Path(settings.db_file).parent.mkdir(parents=True, exist_ok=True)
    return SqliteDb(db_file=settings.db_file)


def delete_anonymous_session(
    db: BaseDb | None,
    *,
    agent_id: str,
    visitor_id: str,
    session_id: str,
) -> bool:
    if db is None or agent_id not in ALLOWED_AGENT_IDS:
        return False

    user_id = f"anonymous:{visitor_id}"
    stored_session_id = f"{agent_id}-{session_id}"
    session = db.get_session(
        stored_session_id,
        session_type=SessionType.AGENT,
        user_id=user_id,
        deserialize=False,
    )
    if not isinstance(session, dict) or session.get("agent_id") != agent_id:
        return False

    return db.delete_session(stored_session_id, user_id=user_id)


def cleanup_inactive_sessions(
    db: BaseDb | None,
    *,
    now: int | None = None,
) -> int:
    if db is None:
        return 0

    current_time = int(time()) if now is None else now
    cutoff = current_time - RETENTION_SECONDS
    result = db.get_sessions(
        session_type=SessionType.AGENT,
        deserialize=False,
    )
    records = result[0] if isinstance(result, tuple) else result
    expired_ids = [
        record["session_id"]
        for record in records
        if isinstance(record, dict)
        and record.get("agent_id") in ALLOWED_AGENT_IDS
        and int(record.get("updated_at") or record.get("created_at") or 0) < cutoff
    ]

    if expired_ids:
        db.delete_sessions(expired_ids)
    return len(expired_ids)
