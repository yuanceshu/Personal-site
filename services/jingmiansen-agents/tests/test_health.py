from dataclasses import replace

from fastapi.testclient import TestClient

import jingmiansen_agents.app as app_module


def test_health_does_not_expose_secret() -> None:
    response = TestClient(app_module.app).get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_agent_os_routes_require_shared_token(monkeypatch) -> None:
    monkeypatch.setattr(
        app_module,
        "settings",
        replace(app_module.settings, agent_token="test-agent-token"),
    )
    client = TestClient(app_module.app)

    unauthorized = client.get("/health")
    authorized = client.get(
        "/health", headers={"Authorization": "Bearer test-agent-token"}
    )

    assert unauthorized.status_code == 401
    assert authorized.status_code != 401
