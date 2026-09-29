import asyncio
import json
import httpx
import pytest
from fastapi.testclient import TestClient
from openai import AsyncOpenAI
from experiment_agents.app import create_app
from experiment_agents.config import Settings
from experiment_agents.works.linquan import workflow
from experiment_agents.works.linquan.schemas import ChatRequest

SETTINGS = Settings("test-token", "http://127.0.0.1:9/v1", "fake-key", "test-model")
PAYLOAD = {
    "message": "最近的厕所在哪里？",
    "context": {
        "currentSpotName": "晨雾入口", "currentSpotId": "dawn-gate",
        "profile": {"adults": 2, "children": 0, "elderly": 0, "fitness": "medium", "availableMinutes": 180, "interests": ["scenery"], "avoidStairs": False},
        "hasRoute": False, "routeSummary": None, "visitedSpotIds": ["dawn-gate"],
    },
    "history": [], "deterministicAnswer": "离你最近的是入口卫生间。", "tool": "get_service_info", "toolResult": {"distance": 3},
}


def test_auth_validation_and_fixed_contract():
    client = TestClient(create_app(SETTINGS))
    assert client.post("/works/linquan/chat", json=PAYLOAD).status_code == 401
    response = client.post("/works/linquan/chat", json=PAYLOAD, headers={"Authorization": "Bearer test-token"})
    assert response.status_code == 502
    assert response.headers["cache-control"] == "no-store"
    assert client.post("/works/linquan/chat", content=b"x" * 32769, headers={"Authorization": "Bearer test-token"}).status_code == 413


def test_unconfigured_service():
    client = TestClient(create_app(Settings("test-token", "", "", "")))
    response = client.post("/works/linquan/chat", json=PAYLOAD, headers={"Authorization": "Bearer test-token"})
    assert response.status_code == 503 and response.json() == {"error": "unavailable"}


def test_sdk_envelope_and_response_validation(monkeypatch):
    calls = []

    def respond(req):
        body = json.loads(req.content)
        calls.append(body)
        assert body["model"] == "test-model" and body["max_tokens"] == 1000
        return httpx.Response(200, json={"id": "x", "object": "chat.completion", "created": 0, "model": "test-model", "choices": [{"index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": json.dumps({"answer": "入口卫生间距离你约 3 分钟。"}, ensure_ascii=False)}}]})

    monkeypatch.setattr(workflow, "AsyncOpenAI", lambda **kwargs: AsyncOpenAI(**kwargs, http_client=httpx.AsyncClient(transport=httpx.MockTransport(respond))))
    result = asyncio.run(workflow.explain(ChatRequest(**PAYLOAD), SETTINGS))
    assert result.mode == "live" and "3 分钟" in result.answer and len(calls) == 1


@pytest.mark.parametrize("raw", ["{}", '{"answer": 1}', '{"answer": ""}'])
def test_invalid_model_output_fails(raw, monkeypatch):
    def respond(_req):
        return httpx.Response(200, json={"id": "x", "object": "chat.completion", "created": 0, "model": "test-model", "choices": [{"index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": raw}}]})

    monkeypatch.setattr(workflow, "AsyncOpenAI", lambda **kwargs: AsyncOpenAI(**kwargs, http_client=httpx.AsyncClient(transport=httpx.MockTransport(respond))))
    with pytest.raises(workflow.LinquanError) as error:
        asyncio.run(workflow.explain(ChatRequest(**PAYLOAD), SETTINGS))
    assert error.value.status == 502
