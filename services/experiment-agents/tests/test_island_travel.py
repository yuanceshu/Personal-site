import asyncio
import json
import httpx
import pytest
from fastapi.testclient import TestClient
from openai import AsyncOpenAI
from pydantic import ValidationError
from experiment_agents.app import create_app
from experiment_agents.config import Settings
from experiment_agents.works.island_travel import workflow
from experiment_agents.works.island_travel.schemas import ChatRequest, ChatResponse

SETTINGS = Settings("test-token", "https://model.test/v1", "test-key", "test-model", 1)
PAYLOAD = {"message": "明天上午从海口去三亚", "conditions": {}, "history": []}
RESULT = {"intent": "search_trips", "conditions": {"origin": "海口", "destination": "三亚", "date": "2026-09-15", "quantity": 1}, "reply": "", "faq": None, "selection": None}


@pytest.mark.parametrize("bad", [
    {"message": "138 0000 0000"}, {"message": "110101199001010000"},
    {"message": "hi", "conditions": {"date": "2026-02-30"}},
    {"message": "hi", "conditions": {"quantity": 6}},
    {"message": "从公共地点出发", "conditions": {"origin": "某某小区"}},
    {"message": "我家在某某小区"},
    {"message": "hi", "passenger": {}},
    {"message": "hi", "history": [{"role": "user", "content": "x"}] * 17},
])
def test_input_contract(bad):
    with pytest.raises(ValidationError):
        ChatRequest.model_validate(bad)


def test_date_text_allowed_but_phone_still_rejected():
    assert ChatRequest(message="2026-09-15从海口去三亚").message
    with pytest.raises(ValidationError):
        ChatRequest(message="2026-09-15 手机138-0000-0000")


@pytest.mark.parametrize("intent", ["request_refund", "request_reschedule", "request_invoice", "request_product", "request_door_plan", "request_support", "request_reminder"])
def test_after_sales_intents_accept_no_transaction_fields(intent):
    assert ChatResponse(**{**RESULT, "intent": intent}).intent == intent
    with pytest.raises(ValidationError):
        ChatResponse(**{**RESULT, "intent": intent, "amount": 1})


def test_api_auth_validation_and_fixed_response():
    async def fake(payload, settings):
        assert payload.message == PAYLOAD["message"]
        return ChatResponse(**RESULT)

    client = TestClient(create_app(SETTINGS, travel_runner=fake))
    path = "/works/island-travel/chat"
    headers = {"Authorization": "Bearer test-token"}
    assert client.post(path, json=PAYLOAD).status_code == 401
    assert client.post(path, json={"message": "13800000000"}, headers=headers).status_code == 422
    assert client.post(path, content=b"x" * 32769, headers=headers).status_code == 413
    response = client.post(path, json=PAYLOAD, headers=headers)
    assert response.status_code == 200 and response.json()["mode"] == "live"
    assert "no-store" in response.headers["cache-control"]
    assert client.get("/docs").status_code == 404


@pytest.mark.parametrize("raw,expected", [(json.dumps(RESULT), 200), ("bad JSON", 502), (json.dumps({**RESULT, "price": 100}), 502)])
def test_real_sdk_contract_without_network(monkeypatch, raw, expected):
    def respond(req):
        body = json.loads(req.content)
        assert body["max_tokens"] == 1800
        context = json.loads(body["messages"][1]["content"])
        assert "today" in context and "passenger" not in context
        return httpx.Response(200, json={"id": "x", "object": "chat.completion", "created": 0, "model": "test-model", "choices": [{"index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": raw}}]})

    monkeypatch.setattr(workflow, "AsyncOpenAI", lambda **kw: AsyncOpenAI(**kw, http_client=httpx.AsyncClient(transport=httpx.MockTransport(respond))))
    if expected == 200:
        result = asyncio.run(workflow.interpret(ChatRequest(**PAYLOAD), SETTINGS))
        assert result.conditions.origin == "海口"
    else:
        with pytest.raises(workflow.TravelError) as error:
            asyncio.run(workflow.interpret(ChatRequest(**PAYLOAD), SETTINGS))
        assert error.value.status == expected


def test_missing_config_and_timeout():
    with pytest.raises(workflow.TravelError) as error:
        asyncio.run(workflow.interpret(ChatRequest(**PAYLOAD), Settings("", "", "", "")))
    assert error.value.status == 503

    async def failing(payload, settings):
        raise workflow.TravelError(504, "timeout")

    client = TestClient(create_app(SETTINGS, travel_runner=failing))
    response = client.post("/works/island-travel/chat", json=PAYLOAD, headers={"Authorization": "Bearer test-token"})
    assert response.status_code == 504 and response.json() == {"error": "timeout"}


def test_sdk_read_timeout_is_504(monkeypatch):
    def timeout(request):
        raise httpx.ReadTimeout("private provider detail", request=request)

    monkeypatch.setattr(workflow, "AsyncOpenAI", lambda **kw: AsyncOpenAI(**kw, http_client=httpx.AsyncClient(transport=httpx.MockTransport(timeout))))
    with pytest.raises(workflow.TravelError) as error:
        asyncio.run(workflow.interpret(ChatRequest(**PAYLOAD), SETTINGS))
    assert error.value.status == 504 and error.value.code == "timeout"
