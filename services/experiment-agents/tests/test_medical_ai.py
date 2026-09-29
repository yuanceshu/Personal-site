import asyncio
import json

import httpx
import pytest
from fastapi.testclient import TestClient
from openai import AsyncOpenAI

from experiment_agents.app import create_app
from experiment_agents.config import Settings
from experiment_agents.works.medical_ai import workflow
from experiment_agents.works.medical_ai.schemas import ChatRequest


SETTINGS = Settings("test-token", "http://127.0.0.1:9/v1", "fake-key", "test-model")
PAYLOAD = {
    "message": "我现在应该去哪？",
    "context": {"visit_context": {"current_stage": "REGISTERED", "next_action": "前往门诊楼3楼普外科签到"}, "debug": {"route": "VISIT_CONTEXT"}, "tool_calls": []},
    "history": [],
    "deterministic_answer": "你已经完成挂号，接下来请前往门诊楼3楼普外科签到。",
}


def test_auth_and_unconfigured_service():
    client = TestClient(create_app(SETTINGS))
    assert client.post("/works/medical-ai/chat", json=PAYLOAD).status_code == 401
    client = TestClient(create_app(Settings("test-token", "", "", "")))
    response = client.post("/works/medical-ai/chat", json=PAYLOAD, headers={"Authorization": "Bearer test-token"})
    assert response.status_code == 503 and response.json() == {"error": "unavailable"}


def test_sdk_envelope_and_grounded_context(monkeypatch):
    calls = []

    def respond(req):
        body = json.loads(req.content)
        calls.append(body)
        assert body["model"] == "test-model" and body["max_tokens"] == 1000
        assert "deterministic_answer" in body["messages"][1]["content"]
        return httpx.Response(200, json={"id": "x", "object": "chat.completion", "created": 0, "model": "test-model", "choices": [{"index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": json.dumps({"answer": "请前往门诊楼3楼普外科签到。"}, ensure_ascii=False)}}]})

    monkeypatch.setattr(workflow, "AsyncOpenAI", lambda **kwargs: AsyncOpenAI(**kwargs, http_client=httpx.AsyncClient(transport=httpx.MockTransport(respond))))
    result = asyncio.run(workflow.explain(ChatRequest(**PAYLOAD), SETTINGS))
    assert result.mode == "live" and "签到" in result.answer and len(calls) == 1


@pytest.mark.parametrize("raw", ["{}", '{"answer": 1}', '{"answer": ""}'])
def test_invalid_model_output_fails(raw, monkeypatch):
    def respond(_req):
        return httpx.Response(200, json={"id": "x", "object": "chat.completion", "created": 0, "model": "test-model", "choices": [{"index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": raw}}]})

    monkeypatch.setattr(workflow, "AsyncOpenAI", lambda **kwargs: AsyncOpenAI(**kwargs, http_client=httpx.AsyncClient(transport=httpx.MockTransport(respond))))
    with pytest.raises(workflow.MedicalError) as error:
        asyncio.run(workflow.explain(ChatRequest(**PAYLOAD), SETTINGS))
    assert error.value.status == 502
