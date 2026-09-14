"""Exercise the real SDK envelope without provider credentials or network calls."""

import asyncio
import json
import httpx
import pytest
from openai import AsyncOpenAI
from experiment_agents.works.ai_solution_lab import workflow
from test_workflow import BASE, SETTINGS, request


@pytest.mark.parametrize(
    "stage,key",
    [("analyze", "brief"), ("diagnose", "diagnosis"), ("plan", "prototype")],
)
def test_sdk_envelope_and_repair(monkeypatch, stage, key):
    calls = []

    def respond(req):
        body = json.loads(req.content)
        calls.append(body)
        assert req.headers["authorization"] == "Bearer fake-test-key"
        assert body["model"] == "test-model" and body["max_tokens"] == 4500
        assert "JSON Schema" in body["messages"][0]["content"]
        return httpx.Response(
            200,
            json={
                "id": "test",
                "object": "chat.completion",
                "created": 0,
                "model": "test-model",
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": "stop",
                        "message": {
                            "role": "assistant",
                            "content": "invalid"
                            if len(calls) == 1
                            else json.dumps(BASE[key]),
                        },
                    }
                ],
            },
        )

    monkeypatch.setattr(
        workflow,
        "AsyncOpenAI",
        lambda **kwargs: AsyncOpenAI(
            **kwargs,
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(respond)),
        ),
    )
    result = asyncio.run(workflow.run_stage(request(stage), SETTINGS))
    assert result["mode"] == "live" and len(calls) == 2
    assert "上次输出" in calls[1]["messages"][0]["content"]


@pytest.mark.parametrize("status,expected", [(429, 429), (401, 502), (500, 502)])
def test_sdk_http_failures_without_implicit_retries(monkeypatch, status, expected):
    calls = []

    def respond(req):
        calls.append(1)
        return httpx.Response(
            status, json={"error": {"message": "private provider detail"}}
        )

    monkeypatch.setattr(
        workflow,
        "AsyncOpenAI",
        lambda **kwargs: AsyncOpenAI(
            **kwargs,
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(respond)),
        ),
    )
    with pytest.raises(workflow.WorkflowError) as error:
        asyncio.run(workflow.run_stage(request("analyze"), SETTINGS))
    assert error.value.status == expected and len(calls) == 1
    assert "private" not in error.value.code
