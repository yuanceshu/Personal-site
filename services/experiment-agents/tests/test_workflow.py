import asyncio
import json
from copy import deepcopy
import pytest
from fastapi.testclient import TestClient
from experiment_agents.app import create_app, run_connected
from experiment_agents.config import Settings
from experiment_agents.works.ai_solution_lab.schemas import request_adapter
from experiment_agents.works.ai_solution_lab.workflow import run_stage, WorkflowError
from test_contracts import CASES

SETTINGS = Settings(
    "unit-test-token", "http://127.0.0.1:9/v1", "fake-test-key", "test-model"
)
BASE = CASES[0]["value"]


def request(stage="plan"):
    if stage == "analyze":
        return request_adapter.validate_python(
            {"stage": stage, "input": "医院希望查看每日经营指标并分析变化"}
        )
    payload = {"stage": stage, "brief": BASE["brief"]}
    payload.update(
        {"diagnosis": BASE["diagnosis"]}
        if stage == "plan"
        else {"selectedCapabilities": []}
    )
    return request_adapter.validate_python(payload)


def run(coro):
    return asyncio.run(coro)


@pytest.mark.parametrize(
    "stage,key",
    [("analyze", "brief"), ("diagnose", "diagnosis"), ("plan", "prototype")],
)
def test_live_and_one_repair(stage, key):
    calls = []

    async def fake(*args):
        calls.append(args)
        return "not json" if len(calls) == 1 else json.dumps(BASE[key])

    result = run(run_stage(request(stage), SETTINGS, fake))
    assert result["mode"] == "live"
    assert len(calls) == 2 and calls[-1][-1] is True


@pytest.mark.parametrize("failure", ["invalid", "semantic", "timeout", "disconnect"])
def test_plan_fallback(failure):
    calls = []

    async def fake(*args):
        calls.append(args)
        if failure == "timeout":
            raise TimeoutError()
        if failure == "disconnect":
            raise OSError()
        if failure == "invalid":
            return "{"
        v = deepcopy(BASE["prototype"])
        v["pages"][0]["sections"][0]["components"][0]["dataRef"] = "retail_metrics"
        return json.dumps(v)

    result = run(run_stage(request(), SETTINGS, fake))
    assert result["mode"] == "fallback"
    assert len(calls) == (1 if failure in ("timeout", "disconnect") else 2)


@pytest.mark.parametrize("stage", ["analyze", "diagnose"])
def test_failure_no_invented_result(stage):
    calls = []

    async def fake(*args):
        calls.append(args)
        return "{}"

    with pytest.raises(WorkflowError) as error:
        run(run_stage(request(stage), SETTINGS, fake))
    assert error.value.status == 502 and len(calls) == 2


def test_selected_capabilities_checked():
    payload = request("diagnose").model_dump()
    payload["selectedCapabilities"] = ["monitoring_dashboard"]

    async def fake(*_):
        return json.dumps(BASE["diagnosis"])

    with pytest.raises(WorkflowError):
        run(run_stage(request_adapter.validate_python(payload), SETTINGS, fake))


def test_no_ai_checked():
    payload = request("diagnose").model_dump()
    payload["brief"]["aiPreference"] = "none"

    async def fake(*_):
        return json.dumps(BASE["diagnosis"])

    with pytest.raises(WorkflowError):
        run(run_stage(request_adapter.validate_python(payload), SETTINGS, fake))


def test_cancel_no_repair_or_fallback():
    async def check():
        calls = []
        started = asyncio.Event()
        cancelled = asyncio.Event()

        async def fake(*_):
            calls.append(1)
            started.set()
            try:
                await asyncio.sleep(10)
            finally:
                cancelled.set()

        task = asyncio.create_task(run_stage(request(), SETTINGS, fake))
        await started.wait()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert cancelled.is_set() and calls == [1]

    run(check())


def test_http_disconnect_cancels_work():
    async def check():
        cancelled = asyncio.Event()

        class Disconnected:
            async def receive(self):
                return {"type": "http.disconnect"}

        async def work():
            try:
                await asyncio.sleep(10)
            finally:
                cancelled.set()

        with pytest.raises(WorkflowError) as error:
            await run_connected(Disconnected(), work())
        assert error.value.status == 499 and cancelled.is_set()

    run(check())


def test_auth_validation_and_no_leaked_payload():
    client = TestClient(create_app(SETTINGS))
    assert client.get("/healthz").json() == {"status": "ok"}
    endpoint = "/works/ai-solution-lab/generate"
    assert client.post(endpoint, json={}).status_code == 401
    headers = {"Authorization": "Bearer unit-test-token"}
    response = client.post(
        endpoint, headers=headers, json={"stage": "analyze", "input": "private"}
    )
    assert response.status_code == 422 and "private" not in response.text
    assert client.get("/docs", headers=headers).status_code == 404
    assert (
        client.post(endpoint, headers=headers, content="x" * 32769).status_code == 413
    )


def test_unconfigured_service():
    client = TestClient(create_app(Settings("test-token", "", "", "")))
    response = client.post(
        "/works/ai-solution-lab/generate",
        headers={"Authorization": "Bearer test-token"},
        json=request("analyze").model_dump(),
    )
    assert response.status_code == 503


def test_service_success_and_no_cache():
    async def fake(payload, _settings):
        return {"stage": payload.stage, "mode": "live", "data": BASE["brief"]}

    client = TestClient(create_app(SETTINGS, runner=fake))
    response = client.post(
        "/works/ai-solution-lab/generate",
        headers={"Authorization": "Bearer unit-test-token"},
        json=request("analyze").model_dump(),
    )
    assert response.status_code == 200 and response.json()["stage"] == "analyze"
    assert response.headers["cache-control"] == "no-store"
