"""琴台票务（武汉门票场景）服务端契约与工具行为。

三条边界在这里被固定下来：
1. 工具只在**请求自带的投影**上工作——投影里没有的编号必须明说没有，不得编造；
2. 顾客侧与运营侧的工具集互不重叠（锁座草案 vs 变更草案）；
3. 所有写操作都只产出**待确认提案**，工具本身不改价、不锁座、不发布。
"""

import asyncio
import json
from types import SimpleNamespace

import pytest
from agno.agent import RunEvent
from fastapi.testclient import TestClient
from pydantic import ValidationError

from experiment_agents.app import create_app
from experiment_agents.config import Settings
from experiment_agents.works.qintai_ticketing.schemas import Card, ChatRequest
from experiment_agents.works.qintai_ticketing.workflow import (
    Evidence,
    build_agent,
    grounded_answer,
    stream_chat,
)

SETTINGS = Settings("qintai-test-token", "https://model.test/v1", "test-key", "test-model", 1)

LIMITS = {
    "hold_minutes": 8,
    "max_tickets_per_event": 8,
    "offer_claim_minutes": 10,
    "barcode_rotation_seconds": 60,
}

GUARDRAILS = {
    "max_price_delta_pct": 20.0,
    "max_promotion_discount_pct": 50.0,
    "max_restock_quantity": 500,
    "max_campaign_budget": 10000.0,
}

POLICIES = [
    {"policy_id": "hold", "title": "锁座与超时", "content": "锁座 8 分钟内不扣款，超时座位回到模拟库存。"},
    {
        "policy_id": "waitlist",
        "title": "候补与回流",
        "content": "售罄票档可加入候补；退票后按队列顺序发放回流票，领取窗口 10 分钟。",
    },
    {"policy_id": "transfer", "title": "转票与赠票", "content": "票夹里的电子票可以转赠，转赠需对方确认。"},
]


def show(
    product_id,
    title,
    price,
    remaining,
    *,
    tier=None,
    event_name=None,
    event_date="2026-10-16",
    venue="武汉琴台大剧院",
    category="tickets",
    value_score=None,
    vs_box_office=None,
):
    return {
        "product_id": product_id,
        "title": title,
        "price": price,
        "currency": "CNY",
        "category": category,
        "remaining": remaining,
        "sold_out": remaining == 0,
        "event_name": event_name,
        "event_date": event_date,
        "event_time": "19:30",
        "venue": venue,
        "tier": tier,
        "labels": [],
        "value_score": value_score,
        "vs_box_office": vs_box_office,
    }


def pacing_row(product_id, price, capacity, sold, remaining, sell_through, baseline, pace, *, tier=None, waitlist=0):
    return {
        "product_id": product_id,
        "tier": tier,
        "price": price,
        "capacity": capacity,
        "sold": sold,
        "remaining": remaining,
        "sell_through_pct": sell_through,
        "baseline_pct": baseline,
        "pace_vs_baseline_pts": pace,
        "waitlist_depth": waitlist,
    }


PIT = show("AT-TIX-101-PIT", "《如梦之梦》一楼池座", 1580.0, 6, tier="一楼池座", event_name="《如梦之梦》")
BAL = show("AT-TIX-101-BAL", "《如梦之梦》二楼池座", 880.0, 120, tier="二楼池座", event_name="《如梦之梦》")
GONE = show(
    "AT-TIX-105-BAL",
    "《津声楚韵》二楼看台",
    380.0,
    0,
    tier="二楼看台",
    event_name="《津声楚韵》",
    event_date="2026-10-23",
)

DISCLOSURE = {
    "title": "《如梦之梦》一楼池座 · 含全部费用",
    "product_id": "AT-TIX-101-PIT",
    "rows": [
        {"label": "含全部费用", "value": "¥1580.00"},
        {"label": "票面价", "value": "¥1450.00"},
        {"label": "服务费", "value": "¥80.00"},
        {"label": "场馆费", "value": "¥30.00"},
        {"label": "订单处理费", "value": "¥20.00"},
    ],
    "sources": ["venue"],
    "footnotes": ["票价与场馆信息来自公开演出资料，非官方售票渠道。"],
}

CUSTOMER_CONTEXT = {
    "page": "show",
    "store": "琴台票务",
    "limits": LIMITS,
    "results": [BAL, PIT, GONE],
    "selected": PIT,
    "disclosure": DISCLOSURE,
    "policies": POLICIES,
    "session": {
        "user_name": "演示观众",
        "holds": [{"product_id": "AT-TIX-101-PIT", "title": PIT["title"], "quantity": 2, "seconds_remaining": 320}],
        "waitlist": [{"product_id": "AT-TIX-105-BAL", "title": GONE["title"], "position": 3}],
        "offers": [],
        "tickets": [{"ticket_id": "AT-TKT-1", "title": "《如梦之梦》· 一楼池座", "seat": "A-12", "status": "valid"}],
        "pending_transfers": [],
    },
    "merchant": None,
}

MERCHANT_CONTEXT = {
    "page": "merchant",
    "store": "琴台票务",
    "limits": LIMITS,
    "results": [PIT, BAL],
    "selected": None,
    "disclosure": None,
    "policies": [],
    "session": None,
    "merchant": {
        "promoter": "琴台票务 — 武汉演出场馆组合",
        "current_period": "last_30_days",
        "totals": {
            "sales": 222750.94,
            "orders": 1148,
            "traffic": 34680,
            "conversion_rate": 3.31,
            "sales_change_pct": 4.2,
            "currency": "CNY",
        },
        "counts": {"low_stock": 2, "slow_movers": 4, "order_issues": 3, "pending_changes": 1},
        "events": [
            {
                "event_id": "AT-EVT-101",
                "event_name": "《如梦之梦》",
                "event_date": "2026-10-16",
                "days_to_event": 17,
                "sold_out": False,
            }
        ],
        "pacing": [
            pacing_row("AT-TIX-101-PIT", 1580.0, 350, 344, 6, 98.3, 72.6, 25.7, tier="一楼池座", waitlist=3),
            pacing_row("AT-TIX-101-BAL", 880.0, 260, 97, 163, 37.3, 72.6, -35.3, tier="二楼池座"),
        ],
        "alerts": [
            {"listing_id": "AT-TIX-101-PIT", "title": PIT["title"], "kind": "low_stock", "stock": 6, "threshold": 12},
            {
                "listing_id": "AT-TIX-101-BAL",
                "title": BAL["title"],
                "kind": "slow_mover",
                "stock": 163,
                "threshold": None,
            },
        ],
        "pending_changes": [
            {
                "change_id": "change-abc123",
                "kind": "price",
                "summary": "AT-TIX-101-BAL 改价",
                "item_count": 1,
            }
        ],
        "guardrails": GUARDRAILS,
    },
}


def payload_for(role, message="看看这场演出", **overrides):
    body = {
        "role": role,
        "message": message,
        "history": [],
        "accepted": [],
        "context": CUSTOMER_CONTEXT if role == "customer" else MERCHANT_CONTEXT,
    }
    body.update(overrides)
    return body


def agent_for(role, message="看看这场演出", **overrides):
    request = ChatRequest.model_validate(payload_for(role, message, **overrides))
    evidence = Evidence()
    agent = build_agent(request, SETTINGS, evidence)
    return request, {tool.__name__: tool for tool in agent.tools}, evidence


# ---------------------------------------------------------------------------
# 角色边界
# ---------------------------------------------------------------------------


def test_customer_and_merchant_tool_sets_do_not_overlap():
    _, customer, _ = agent_for("customer")
    _, merchant, _ = agent_for("merchant")
    shared = {"search_shows", "get_show_detail", "compare_tiers", "explain_fees", "search_policy"}
    assert set(customer) == shared | {"stage_hold"}
    assert set(merchant) == shared | {"list_pacing", "list_alerts", "list_pending_changes", "stage_change"}
    assert "stage_change" not in customer
    assert "stage_hold" not in merchant


# ---------------------------------------------------------------------------
# 只读工具：只在投影里工作
# ---------------------------------------------------------------------------


def test_search_and_detail_never_leave_the_projection():
    _, customer, evidence = agent_for("customer")

    found = json.loads(customer["search_shows"]("如梦之梦"))
    assert [row["product_id"] for row in found] == ["AT-TIX-101-BAL", "AT-TIX-101-PIT"]

    assert "本次投影里没有 AT-TIX-999" in customer["get_show_detail"]("AT-TIX-999")

    compared = json.loads(customer["compare_tiers"]("AT-TIX-101-PIT, AT-TIX-404"))
    assert [row["product_id"] for row in compared["rows"]] == ["AT-TIX-101-PIT"]
    assert compared["missing"] == ["AT-TIX-404"]

    assert "AT-TIX-101-PIT" in evidence.seen_products


def test_fee_explanation_requires_the_matching_disclosure():
    _, customer, evidence = agent_for("customer")

    detail = json.loads(customer["explain_fees"]("AT-TIX-101-PIT"))
    assert detail["product_id"] == "AT-TIX-101-PIT"
    assert [item.label for item in evidence.cards["fees"].items][:2] == ["含全部费用", "票面价"]
    assert "fees" in evidence.sources

    assert "不一致" in customer["explain_fees"]("AT-TIX-101-BAL")

    blank = ChatRequest.model_validate(
        {**payload_for("customer"), "context": {**CUSTOMER_CONTEXT, "disclosure": None, "selected": None}}
    )
    blank_evidence = Evidence()
    blank_agent = {tool.__name__: tool for tool in build_agent(blank, SETTINGS, blank_evidence).tools}
    assert "没有携带费用拆分" in blank_agent["explain_fees"]()
    assert "fees" not in blank_evidence.cards


def test_policy_search_uses_only_the_policies_in_the_projection():
    _, customer, evidence = agent_for("customer")
    found = json.loads(customer["search_policy"]("售罄了怎么候补"))
    assert [row["policy_id"] for row in found] == ["waitlist"]
    assert set(evidence.sources) == {"waitlist"}

    assert "没有相关规则条目" in customer["search_policy"]("停车免费多久")


def test_grounded_answer_speaks_only_from_the_projection():
    request = ChatRequest.model_validate(payload_for("customer"))
    answer = grounded_answer(request, Evidence())
    assert "¥1580.00" in answer
    assert "还剩 6 张" in answer
    assert "8 分钟" in answer

    listed = grounded_answer(
        ChatRequest.model_validate(
            {**payload_for("customer"), "context": {**CUSTOMER_CONTEXT, "selected": None, "disclosure": None}}
        ),
        Evidence(),
    )
    assert "《如梦之梦》" in listed

    merchant_answer = grounded_answer(ChatRequest.model_validate(payload_for("merchant")), Evidence())
    assert "222,751" in merchant_answer
    assert "1148 笔" in merchant_answer
    assert "改价单次上限 20%" in merchant_answer


# ---------------------------------------------------------------------------
# 锁座草案
# ---------------------------------------------------------------------------


def test_hold_draft_respects_limits_and_stock():
    _, customer, evidence = agent_for("customer")

    assert "最多 8 张" in customer["stage_hold"]("AT-TIX-101-PIT", 9)
    assert evidence.proposal is None

    assert "至少为 1" in customer["stage_hold"]("AT-TIX-101-PIT", 0)
    assert evidence.proposal is None

    assert "不在本次投影里" in customer["stage_hold"]("AT-TIX-999", 1)
    assert evidence.proposal is None

    assert "仅剩 6 张" in customer["stage_hold"]("AT-TIX-101-PIT", 7)
    assert evidence.proposal is None

    assert "已售罄" in customer["stage_hold"]("AT-TIX-105-BAL", 1)
    assert evidence.proposal is None

    assert "已生成待确认的锁座草案" in customer["stage_hold"]("AT-TIX-101-PIT", 2)
    assert evidence.proposal.id.startswith("hold-")
    assert evidence.proposal.action.kind == "hold"
    assert evidence.proposal.action.listing_id == "AT-TIX-101-PIT"
    assert evidence.proposal.action.quantity == 2
    assert evidence.proposal.action.value is None
    assert "¥3,160.00" in evidence.proposal.detail


# ---------------------------------------------------------------------------
# 运营变更草案
# ---------------------------------------------------------------------------


def test_merchant_read_tools_only_report_the_projection():
    _, merchant, evidence = agent_for("merchant")

    rows = json.loads(merchant["list_pacing"]())
    assert [row["product_id"] for row in rows] == ["AT-TIX-101-PIT", "AT-TIX-101-BAL"]
    assert "pacing" in evidence.sources
    assert evidence.cards["pacing"].items[0].label.startswith("AT-TIX-101-BAL")

    alerts = json.loads(merchant["list_alerts"]())
    assert {row["kind"] for row in alerts} == {"low_stock", "slow_mover"}
    assert evidence.cards["alerts"].items[0].label == PIT["title"]

    pending = json.loads(merchant["list_pending_changes"]())
    assert pending[0]["change_id"] == "change-abc123"

    blank = ChatRequest.model_validate(
        {**payload_for("merchant"), "context": {**MERCHANT_CONTEXT, "merchant": None}}
    )
    blank_agent = {tool.__name__: tool for tool in build_agent(blank, SETTINGS, Evidence()).tools}
    assert "没有携带运营数据" in blank_agent["list_pacing"]()
    assert "没有携带运营数据" in blank_agent["list_alerts"]()
    assert "没有携带运营数据" in blank_agent["list_pending_changes"]()
    assert "没有携带运营数据" in blank_agent["stage_change"]("price", "AT-TIX-101-PIT", 1600)


def test_change_draft_enforces_every_guardrail():
    _, merchant, evidence = agent_for("merchant")

    assert "不在本次运营投影里" in merchant["stage_change"]("price", "AT-TIX-999", 1600)
    assert evidence.proposal is None

    assert "必须为正数" in merchant["stage_change"]("price", "AT-TIX-101-PIT", 0)
    # 1580 → 1912 是 21% 的幅度，超出单次上限。
    assert "超出单次上限" in merchant["stage_change"]("price", "AT-TIX-101-PIT", 1912)
    assert evidence.proposal is None

    assert "超出活动上限" in merchant["stage_change"]("promotion", "AT-TIX-101-PIT", 60)
    assert evidence.proposal is None

    assert "需在 1 到 500 之间" in merchant["stage_change"]("restock", "AT-TIX-101-PIT", 0)
    assert "需在 1 到 500 之间" in merchant["stage_change"]("restock", "AT-TIX-101-PIT", 600)
    assert evidence.proposal is None

    assert "kind 只支持" in merchant["stage_change"]("refund", "AT-TIX-101-PIT", 100)
    assert evidence.proposal is None


def test_change_draft_shapes_each_action_kind():
    _, merchant, evidence = agent_for("merchant")

    assert "已生成待确认的运营变更草案" in merchant["stage_change"]("price", "AT-TIX-101-PIT", 1700, "排期提前")
    assert evidence.proposal.id.startswith("change-")
    assert evidence.proposal.action.kind == "price"
    assert evidence.proposal.action.value == 1700
    assert evidence.proposal.action.quantity is None
    assert evidence.proposal.action.note == "排期提前"
    assert "¥1,580.00 → ¥1,700.00" in evidence.proposal.detail

    merchant["stage_change"]("promotion", "AT-TIX-101-BAL", 30)
    assert evidence.proposal.action.kind == "promotion"
    assert evidence.proposal.action.value == 30
    assert evidence.proposal.action.quantity is None
    assert "活动价 ¥616.00" in evidence.proposal.detail

    merchant["stage_change"]("restock", "AT-TIX-101-BAL", 40, "释放保留座位")
    assert evidence.proposal.action.kind == "restock"
    assert evidence.proposal.action.quantity == 40
    assert evidence.proposal.action.value is None
    assert "释放 40 张" in evidence.proposal.detail


# ---------------------------------------------------------------------------
# 请求契约
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "bad",
    [
        {"role": "owner", "message": "hi"},
        {"role": "customer", "message": "hi", "history": [{"role": "user", "content": "x"}] * 17},
        {"role": "merchant", "message": "hi", "accepted": ["NOT-an-id"]},
        {"role": "merchant", "message": "hi", "privateToken": "x"},
        {"role": "customer", "message": ""},
    ],
)
def test_request_contract(bad):
    with pytest.raises(ValidationError):
        ChatRequest.model_validate({**payload_for("customer"), **bad})


def test_merchant_workspace_pages_are_part_of_the_contract():
    for page in ("merchant", "events", "holds"):
        request = ChatRequest.model_validate(
            {**payload_for("merchant"), "context": {**MERCHANT_CONTEXT, "page": page}}
        )
        assert request.context.page == page
    with pytest.raises(ValidationError):
        ChatRequest.model_validate(
            {**payload_for("merchant"), "context": {**MERCHANT_CONTEXT, "page": "backstage"}}
        )


# ---------------------------------------------------------------------------
# 路由边界
# ---------------------------------------------------------------------------


def test_route_requires_token_and_keeps_paths_separate():
    client = TestClient(create_app(Settings("qintai-test-token", "", "", "")))
    headers = {"Authorization": "Bearer qintai-test-token"}
    payload = payload_for("customer")

    assert client.post("/works/qintai-ticketing/chat", json=payload).status_code == 401
    assert client.get("/works/qintai-ticketing/status").status_code == 401
    assert client.get("/works/qintai-ticketing/status", headers=headers).json() == {"live": False}
    # 未配置模型时直接 503，不进入流式。
    assert client.post("/works/qintai-ticketing/chat", json=payload, headers=headers).status_code == 503
    assert client.post("/works/qintai-ticketing/chat", content=b"x" * 32769, headers=headers).status_code == 413
    assert client.post("/works/qintai-ticketing/other", json=payload, headers=headers).status_code == 404

    ready = TestClient(create_app(SETTINGS))
    assert ready.get("/works/qintai-ticketing/status", headers=headers).json() == {"live": True}
    # 角色与路径必须匹配，闸门在进流之前。
    assert ready.post("/works/qintai-ticketing/chat", json=payload_for("merchant"), headers=headers).status_code == 422
    assert (
        ready.post("/works/qintai-ticketing/merchant", json=payload_for("customer"), headers=headers).status_code
        == 422
    )


# ---------------------------------------------------------------------------
# 流式输出
# ---------------------------------------------------------------------------


class SilentAgent:
    async def arun(self, *_args, **_kwargs):
        for event in ():
            yield event


class StatusAgent:
    def __init__(self, tool_name):
        self.tool_name = tool_name

    async def arun(self, *_args, **_kwargs):
        yield SimpleNamespace(event=RunEvent.tool_call_started, tool=SimpleNamespace(tool_name=self.tool_name))


class ExplodingAgent:
    async def arun(self, *_args, **_kwargs):
        raise RuntimeError("private model detail")
        yield


class PrimedEvidence(Evidence):
    """已经拿到工具证据的现场：模型随后失败，也必须用投影确定性作答。"""

    def __init__(self):
        super().__init__()
        self.cards["seeded"] = Card(id="seeded", title="已核对", eyebrow="工具证据", items=[])


async def _drain(stream):
    return [chunk async for chunk in stream]


def collect(monkeypatch, agent, request):
    monkeypatch.setattr(
        "experiment_agents.works.qintai_ticketing.workflow.build_agent", lambda *_args: agent
    )
    return asyncio.run(_drain(stream_chat(request, SETTINGS)))


def collect_with(monkeypatch, agent, request, evidence_factory):
    monkeypatch.setattr(
        "experiment_agents.works.qintai_ticketing.workflow.build_agent", lambda *_args: agent
    )
    monkeypatch.setattr("experiment_agents.works.qintai_ticketing.workflow.Evidence", evidence_factory)
    return asyncio.run(_drain(stream_chat(request, SETTINGS)))


def test_stream_labels_known_tools_and_ignores_unknown_ones(monkeypatch):
    request = ChatRequest.model_validate(payload_for("customer"))

    chunks = collect(monkeypatch, StatusAgent("search_shows"), request)
    assert chunks[0].startswith("event: status")
    assert "检索本次页面的票档" in chunks[0]
    assert chunks[1].startswith("event: final")

    chunks = collect(monkeypatch, StatusAgent("explain_internals"), request)
    assert len(chunks) == 1
    assert chunks[0].startswith("event: final")


def test_stream_falls_back_to_projection_when_the_agent_is_silent(monkeypatch):
    request = ChatRequest.model_validate(payload_for("customer"))
    chunks = collect(monkeypatch, SilentAgent(), request)
    assert len(chunks) == 1
    final = json.loads(chunks[0].split("data: ", 1)[1])
    assert "¥1580.00" in final["answer"]
    assert final["proposal"] is None
    assert final["followups"]


def test_stream_reports_error_without_private_detail(monkeypatch):
    request = ChatRequest.model_validate(payload_for("customer"))
    chunks = collect(monkeypatch, ExplodingAgent(), request)
    assert chunks[0].startswith("event: error")
    assert "private model detail" not in chunks[0]


def test_stream_keeps_tool_evidence_when_the_model_breaks(monkeypatch):
    request = ChatRequest.model_validate(payload_for("customer"))
    chunks = collect_with(monkeypatch, ExplodingAgent(), request, PrimedEvidence)
    assert len(chunks) == 1
    assert chunks[0].startswith("event: final")
    final = json.loads(chunks[0].split("data: ", 1)[1])
    assert [card["id"] for card in final["cards"]] == ["seeded"]
    assert "¥1580.00" in final["answer"]
    assert "private model detail" not in chunks[0]
