from dataclasses import replace

import jingmiansen_agents.storage as storage_module
from jingmiansen_agents.config import Settings
from jingmiansen_agents.storage import (
    RETENTION_SECONDS,
    build_database,
    cleanup_inactive_sessions,
    delete_anonymous_session,
)


class FakeDb:
    def __init__(self, records=None) -> None:
        self.records = records or []
        self.deleted: list[str] = []

    def get_sessions(self, **_kwargs):
        return self.records, len(self.records)

    def delete_sessions(self, session_ids, user_id=None) -> None:
        assert user_id is None
        self.deleted.extend(session_ids)

    def get_session(self, session_id, **kwargs):
        user_id = kwargs.get("user_id")
        return next(
            (
                record
                for record in self.records
                if record["session_id"] == session_id
                and record["user_id"] == user_id
            ),
            None,
        )

    def delete_session(self, session_id, user_id=None) -> bool:
        record = self.get_session(session_id, user_id=user_id)
        if not record:
            return False
        self.deleted.append(session_id)
        return True


def make_settings(**changes) -> Settings:
    settings = Settings(
        api_key="test-only-key",
        base_url="https://api.minimaxi.com/v1",
        model="M2-her",
        host="127.0.0.1",
        port=7777,
        db_file="data/test.db",
    )
    return replace(settings, **changes)


def test_database_url_selects_postgres(monkeypatch) -> None:
    captured: list[str] = []
    sentinel = object()

    def make_postgres_db(db_url: str):
        captured.append(db_url)
        return sentinel

    monkeypatch.setattr(storage_module, "PostgresDb", make_postgres_db)

    db = build_database(make_settings(database_url="postgresql://example.invalid/db"))

    assert db is sentinel
    assert captured == ["postgresql+psycopg://example.invalid/db"]


def test_delete_session_checks_visitor_and_agent() -> None:
    db = FakeDb(
        [
            {
                "session_id": "lingmian-session-one",
                "user_id": "anonymous:visitor-one",
                "agent_id": "lingmian",
                "created_at": 100,
            }
        ]
    )

    assert not delete_anonymous_session(
        db,
        agent_id="felica",
        visitor_id="visitor-one",
        session_id="session-one",
    )
    assert delete_anonymous_session(
        db,
        agent_id="lingmian",
        visitor_id="visitor-one",
        session_id="session-one",
    )
    assert db.deleted == ["lingmian-session-one"]


def test_cleanup_removes_only_inactive_scoped_sessions() -> None:
    now = RETENTION_SECONDS + 1000
    db = FakeDb(
        [
            {
                "session_id": "expired-session",
                "user_id": "anonymous:visitor-one",
                "agent_id": "marina",
                "created_at": 10,
                "updated_at": 999,
            },
            {
                "session_id": "active-session",
                "user_id": "anonymous:visitor-two",
                "agent_id": "marina",
                "created_at": 10,
                "updated_at": 1001,
            },
            {
                "session_id": "other-service",
                "user_id": "anonymous:visitor-three",
                "agent_id": "unrelated",
                "created_at": 10,
                "updated_at": 1,
            },
        ]
    )

    deleted = cleanup_inactive_sessions(db, now=now)

    assert deleted == 1
    assert db.deleted == ["expired-session"]
