import asyncio
import json

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from experiment_agents.app import create_app
from experiment_agents.config import Settings
from experiment_agents.works.restaurant_ai.data import POLICIES, table_slots
from experiment_agents.works.restaurant_ai.schemas import ChatRequest
from experiment_agents.works.restaurant_ai.workflow import Evidence, build_agent, stream_chat


SETTINGS = Settings("restaurant-test-token", "https://model.test/v1", "test-key", "test-model", 1)


def agent_for(role):
    evidence = Evidence()
    agent = build_agent(ChatRequest(role=role, message="演示任务"), SETTINGS, evidence)
    return {tool.__name__: tool for tool in agent.tools}, evidence


def test_role_tools_are_isolated_and_business_data_is_deterministic():
    customer, customer_evidence = agent_for("customer")
    operations, operations_evidence = agent_for("operations")
    finance, finance_evidence = agent_for("finance")
    assert set(customer) == {"search_policy", "search_menu", "check_table_slots", "stage_booking"}
    assert set(operations) == {"search_policy", "get_operations_snapshot", "stage_campaign"}
    assert set(finance) == {"search_policy", "get_finance_reconciliation", "stage_review"}

    assert "无法创建" in customer["stage_booking"](table_slots()[0]["id"], 2)
    customer["check_table_slots"](2)
    assert "无法创建" in customer["stage_booking"](table_slots()[0]["id"], 3)
    assert "待确认" in customer["stage_booking"](table_slots()[0]["id"], 2)
    assert customer_evidence.proposal.id.startswith("booking-")
    assert "无法创建" in operations["stage_campaign"]("复核库存")
    operations["get_operations_snapshot"]()
    operations["stage_campaign"]("虚构的库存结论，勿展示")
    assert operations_evidence.proposal.id.startswith("campaign-")
    assert "虚构的库存结论" not in operations_evidence.proposal.detail
    assert "无法创建" in finance["stage_review"]("逐笔复核")
    result = json.loads(finance["get_finance_reconciliation"]())
    assert result["difference_yuan"] == 50
    assert {"finance-ledger", "reconcile"} <= set(finance_evidence.sources)
    finance["stage_review"]("虚构的差额结论，勿展示")
    assert finance_evidence.cards["finance"].items[-1].value == "¥50"
    assert "虚构的差额结论" not in finance_evidence.proposal.detail


def test_policy_search_never_crosses_roles():
    customer, evidence = agent_for("customer")
    result = json.loads(customer["search_policy"]("停车免费多久"))
    assert any(item["id"] == "parking" for item in result)
    assert all(source.id in {item[0] for item in POLICIES["customer"]} for source in evidence.sources.values())


@pytest.mark.parametrize("bad", [
    {"role": "owner", "message": "hi"},
    {"role": "customer", "message": "hi", "history": [{"role": "user", "content": "x"}] * 17},
    {"role": "finance", "message": "hi", "accepted": ["not-an-id"]},
    {"role": "finance", "message": "hi", "privateToken": "x"},
])
def test_request_contract(bad):
    with pytest.raises(ValidationError):
        ChatRequest.model_validate(bad)


def test_route_auth_missing_model_and_size_limit():
    client = TestClient(create_app(Settings("restaurant-test-token", "", "", "")))
    path = "/works/restaurant-ai/chat"
    payload = {"role": "customer", "message": "停车吗？", "history": [], "accepted": []}
    assert client.post(path, json=payload).status_code == 401
    headers = {"Authorization": "Bearer restaurant-test-token"}
    assert client.get("/works/restaurant-ai/status").status_code == 401
    assert client.get("/works/restaurant-ai/status", headers=headers).json() == {"live": False}
    assert client.post(path, json=payload, headers=headers).status_code == 503
    assert client.post(path, content=b"x" * 32769, headers=headers).status_code == 413
    ready = TestClient(create_app(SETTINGS))
    assert ready.get("/works/restaurant-ai/status", headers=headers).json() == {"live": True}


def test_stream_reports_error_without_private_detail(monkeypatch):
    class FailingAgent:
        async def arun(self, *_args, **_kwargs):
            raise RuntimeError("private model detail")
            yield

    monkeypatch.setattr("experiment_agents.works.restaurant_ai.workflow.build_agent", lambda *_args: FailingAgent())

    async def collect():
        return [item async for item in stream_chat(ChatRequest(role="customer", message="停车吗？"), SETTINGS)]

    chunks = asyncio.run(collect())
    assert chunks[0].startswith("event: error")
    assert "private model detail" not in chunks[0]
