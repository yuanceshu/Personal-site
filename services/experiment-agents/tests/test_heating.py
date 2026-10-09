import asyncio
import json
from types import SimpleNamespace

import httpx
import pytest
from agno.agent import RunEvent
from fastapi.testclient import TestClient
from pydantic import ValidationError

from experiment_agents.app import create_app
from experiment_agents.config import Settings
from experiment_agents.works.heating import workflow
from experiment_agents.works.heating.schemas import ChatRequest, Focus, Reply

SETTINGS = Settings("test-token", "https://model.example/v1", "test-key", "test-model", 1)


def collect(payload, monkeypatch, plan=(), mode="results", failure=None):
    calls = []
    async def execute(self, name, args, proposal=False):
        calls.append((name, args, proposal))
        result = {"houses": [{"id": "house-F"}, {"id": "house-F2"}], "applications": [{"id": "application-D", "status": "needs_more_materials"}]} if name == "query_records" else {"error": "materials_incomplete"} if name == "submit_application" else {"policyId": "demo", "answers": [{"answer": "工具政策原文"}]} if name == "query_policy" else {"id": args.get("applicationId"), "status": "needs_more_materials", "events": [{"to": "needs_more_materials", "reason": "工具指定补施工照片"}]} if name == "query_application" else {"requiresExplicitConfirmation": True}
        if name == "query_bill":
            result = {"house": {"address": "演示第二套"}, "bills": [{"year": "2026-2027", "kind": "heating", "amountCents": 190000, "status": "unpaid"}]}
        self.calls.append(workflow.Card(name=name, input=args, result=result))
        if result.get("requiresExplicitConfirmation"):
            self.proposal = result
        return json.dumps(result)
    monkeypatch.setattr(workflow.HeatingProxy, "execute", execute)
    class FakeAgent:
        async def arun(self, prompt, **kwargs):
            assert json.loads(prompt)["user_message"] == payload.message
            assert "demoState" not in json.loads(prompt)
            for name, args, proposal in plan:
                await self.proxy.execute(name, args, proposal)
                yield SimpleNamespace(event=RunEvent.tool_call_started)
            if failure:
                raise failure
            yield SimpleNamespace(event=RunEvent.run_completed, content=Reply(mode=mode))
    def build(settings, proxy):
        agent = FakeAgent(); agent.proxy = proxy; return agent
    monkeypatch.setattr(workflow, "build_agent", build)
    async def run():
        return [event async for event in workflow.stream_chat(payload, SETTINGS, "https://site/tool", "https://site/action", "signed-context")]
    events = asyncio.run(run())
    result = json.loads(events[-1].split("data: ")[1])
    return calls, result


@pytest.mark.parametrize("message,name,args,proposal,mode", [
    ("我想交今年的暖气费。", "create_payment", {"billId": "bill-house-A"}, True, "results"),
    ("我还没有绑定房子。", "list_houses", {}, False, "binding_details"),
    ("我的第二套房子今年多少钱？", "query_bill", {"houseId": "house-F2", "year": "2026-2027"}, False, "results"),
    ("今年房子没人住，想办断暖。", "create_draft", {"houseId": "house-A", "year": "2026-2027"}, True, "results"),
    ("申请断暖需要哪些材料？", "query_policy", {"question": "材料"}, False, "results"),
    ("资料齐了，帮我提交。", "submit_application", {"applicationId": "application-D"}, True, "materials"),
    ("我刚才那个申请审核到哪一步了？", "query_application", {"applicationId": "application-D"}, False, "results"),
    ("为什么我的申请被退回了？", "query_application", {"applicationId": "application-D"}, False, "results"),
    ("我已经补了照片，现在可以继续了吗？", "resubmit_application", {"applicationId": "application-D"}, True, "results"),
    ("审核通过了，我想缴费。", "create_disconnection_bill", {"applicationId": "application-D"}, True, "results"),
    ("刚刚支付成功了吗？发票在哪？", "query_records", {}, False, "results"),
    ("断暖为什么还需要缴费？", "query_policy", {"question": "费用"}, False, "results"),
])
def test_dialogue_contracts_and_grounding(message, name, args, proposal, mode, monkeypatch):
    # Deterministic orchestration test; genuine model intent recognition is tested by live.ts.
    calls, result = collect(ChatRequest(message=message), monkeypatch, [(name, args, proposal)], mode)
    assert calls[-1] == (name, args, proposal)
    assert result["degraded"] is False
    assert "模拟" in result["answer"]
    if name == "submit_application":
        assert "材料还不齐" in result["answer"]
        assert "已提交" not in result["answer"]


def test_context_is_not_authorization_and_no_client_identity():
    payload = ChatRequest(message="改为咨询政策", history=[{"role": "user", "content": "刚才那套房"}])
    assert payload.history[0].content == "刚才那套房"
    for extra in ({"userId": "E"}, {"actor": {}}, {"confirmationId": "forged"}):
        with pytest.raises(ValidationError):
            ChatRequest(message="越权", **extra)
    with pytest.raises(ValidationError):
        Reply(mode="results", answer="付款成功金额1元")


@pytest.mark.parametrize("failure", [TimeoutError(), RuntimeError("model failed")])
def test_model_failure_keeps_only_verified_facts(monkeypatch, failure):
    _, result = collect(ChatRequest(message="办断暖"), monkeypatch, [("query_policy", {"question": "材料"}, False)], failure=failure)
    assert result["degraded"] is True
    assert "工具政策原文" in result["answer"]
    assert "付款成功" not in result["answer"]


def test_proxy_headers_errors_duplicates_and_cancel(monkeypatch):
    requests = []
    original_client = httpx.AsyncClient
    def handler(request):
        requests.append(request)
        assert request.headers["Authorization"] == "Bearer test-token"
        assert request.headers["X-Heating-Context"] == "signed-context"
        assert request.headers["x-vercel-protection-bypass"] == "main-bypass-test"
        assert "main-bypass-test" not in request.content.decode()
        data = json.loads(request.content)
        return httpx.Response(403, json={"error": "record_not_found"}) if data["input"].get("billId") == "forbidden" else httpx.Response(200, json={"result": {"requiresExplicitConfirmation": True, "id": "stable-proposal"}, "demoState": "next-test-capsule"})
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original_client(transport=httpx.MockTransport(handler), **kw))
    async def run():
        proxy = workflow.HeatingProxy("https://site/tool", "https://site/action", "test-token", "signed-context", "main-bypass-test", "initial-page-state")
        first = await proxy.execute("create_payment", {"billId": "bill-A"}, True)
        assert first == await proxy.execute("create_payment", {"billId": "bill-A"}, True)
        assert "record_not_found" in await proxy.execute("create_payment", {"billId": "forbidden"}, True)
        assert requests[0].url.path == "/action"
        assert len(proxy.calls) == 3
        assert json.loads(requests[0].content)["demoState"] == "initial-page-state"
        assert json.loads(requests[1].content)["demoState"] == "next-test-capsule"
        assert all("demoState" not in c.result for c in proxy.calls)
    asyncio.run(run())


def test_real_agno_tool_definitions_forward_only_typescript_operations():
    proxy = workflow.HeatingProxy("https://site/tool", "https://site/action", "test-token", "signed-context")
    agent = workflow.build_agent(SETTINGS, proxy)
    names = {getattr(tool, "name", None) or tool.__name__ for tool in agent.tools}
    assert "prepare_payment" in names and "query_policy" in names
    assert not names & {"approve", "reset", "switch_identity", "confirm", "execute_payment"}
    assert agent.output_schema is None
    assert "respond" in names


def test_service_auth_configuration_and_schema():
    with TestClient(create_app(SETTINGS)) as client:
        path = "/works/heating/chat"
        assert client.post(path, json={"message": "你好"}).status_code == 401
        h = {"Authorization": "Bearer test-token"}
        assert client.post(path, headers=h, json={"message": "你好"}).status_code == 503
        assert client.post(path, headers=h, json={"message": "你好", "userId": "E"}).status_code == 422
    with TestClient(create_app(Settings("test-token", "", "", ""))) as client:
        assert client.post(path, headers=h, json={"message": "你好"}).json()["error"] == "model_unavailable"


def test_unavailable_initial_tool_never_runs_model(monkeypatch):
    async def broken(self, name, args, proposal=False):
        self.calls.append(workflow.Card(name=name, input=args, result={"error": "storage_unavailable"}))
        return '{}'
    monkeypatch.setattr(workflow.HeatingProxy, "execute", broken)
    monkeypatch.setattr(workflow, "build_agent", lambda *_: pytest.fail("must not run model without trusted records"))
    async def run():
        return [e async for e in workflow.stream_chat(ChatRequest(message="缴费"), SETTINGS, "tool", "action", "context")]
    assert "event: error" in asyncio.run(run())[0]


def test_cancellation_is_not_business_success(monkeypatch):
    with pytest.raises(asyncio.CancelledError):
        collect(ChatRequest(message="查询"), monkeypatch, failure=asyncio.CancelledError())


def test_untrusted_completion_text_is_discarded(monkeypatch):
    async def execute(self, name, args, proposal=False):
        self.calls.append(workflow.Card(name=name, input=args, result={"bills": [{"id": "bill-A", "year": "2026-2027", "amountCents": 215000, "status": "unpaid"}]}))
        return '{}'
    class Fake:
        async def arun(self, *_args, **_kwargs):
            yield SimpleNamespace(event=RunEvent.run_completed, content="已付款成功999元，发票INV-FAKE")
    monkeypatch.setattr(workflow.HeatingProxy, "execute", execute)
    monkeypatch.setattr(workflow, "build_agent", lambda *_: Fake())
    async def run():
        return [e async for e in workflow.stream_chat(ChatRequest(message="多少钱"), SETTINGS, "tool", "action", "context")]
    result = json.loads(asyncio.run(run())[-1].split("data: ")[1])
    assert "2150.00" not in result["answer"]  # bootstrap records must not spill into the reply
    assert result["focus"]["billIds"] == []
    assert "999" not in result["answer"] and "INV-FAKE" not in result["answer"]


def test_parallel_tools_serialize_page_state(monkeypatch):
    states = []
    original_client = httpx.AsyncClient
    async def handler(request):
        states.append(json.loads(request.content)["demoState"])
        await asyncio.sleep(0.01)
        return httpx.Response(200, json={"result": {"ok": True}, "demoState": f"state-{len(states)}"})
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original_client(transport=httpx.MockTransport(handler), **kw))
    async def run():
        proxy = workflow.HeatingProxy("https://site/tool", "https://site/action", "test-token", "signed-context", demo_state="state-0")
        await asyncio.gather(proxy.execute("query_records", {}), proxy.execute("list_houses", {}))
        assert states == ["state-0", "state-1"]
        assert proxy.demo_state == "state-2"
    asyncio.run(run())


def test_display_focus_ignores_bootstrap_and_targets_verified_calls():
    proxy = workflow.HeatingProxy("tool", "action", "token", "context")
    proxy.calls = [workflow.Card(name="query_records", input={}, result={
        "houses": [{"id": "house-A"}, {"id": "house-F"}],
        "bills": [{"id": "bill-A", "year": "2026-2027", "amountCents": 215000, "status": "unpaid"}],
        "applications": [{"id": "application-old", "status": "approved"}],
    })]
    assert workflow.display_focus(proxy, "results") == Focus()
    answer = workflow.grounded_answer(proxy, "results", False)
    assert "2150.00" not in answer and "审核通过" not in answer
    assert workflow.display_focus(proxy, "choose_house").houseIds == ["house-A", "house-F"]
    proxy.calls.append(workflow.Card(name="query_bill", input={"houseId": "house-A"}, result={
        "house": {"id": "house-A", "address": "演示地址"},
        "bills": [{"id": "bill-A", "year": "2026-2027", "amountCents": 215000, "status": "unpaid"}],
    }))
    assert workflow.display_focus(proxy, "results").billIds == ["bill-A"]
    assert "2150.00" in workflow.grounded_answer(proxy, "results", False)
    assert "application-old" not in workflow.grounded_answer(proxy, "results", False)
    proxy.reply_focus = Focus(billIds=["bill-foreign"])
    assert workflow.display_focus(proxy, "results").billIds == ["bill-A"]


def test_reply_focus_boundaries_and_current_material_copy():
    assert Reply(mode="materials").focus == Focus()
    with pytest.raises(ValidationError):
        Focus(billIds=["bill-A"] * 9)
    proxy = workflow.HeatingProxy("tool", "action", "token", "context")
    answer = workflow.grounded_answer(proxy, "materials", False)
    assert "模拟提交" in answer and "无需选择或上传真实文件" in answer
    assert "上传接口" not in answer


def test_untargeted_business_intent_shows_house_choices_without_keyword_matching():
    proxy = workflow.HeatingProxy("tool", "action", "token", "context")
    proxy.calls = [workflow.Card(name="query_records", input={}, result={"houses": [{"id": "house-F"}, {"id": "house-F2"}]})]
    for intent in ("payment", "disconnection", "bill_query"):
        proxy.reply_intent = intent
        assert workflow.normalize_reply(proxy, "results") == ("choose_house", False)
    proxy.reply_intent = "records"
    assert workflow.normalize_reply(proxy, "results") == ("results", False)
    proxy.reply_intent = "payment"
    assert workflow.normalize_reply(proxy, "clarify") == ("choose_house", False)
    proxy.reply_focus = Focus(houseIds=["house-F2"])
    assert workflow.normalize_reply(proxy, "results") == ("results", False)
    assert workflow.normalize_reply(proxy, "clarify") == ("results", True)
    proxy.calls.append(workflow.Card(name="query_bill", input={"houseId": "house-F2"}, result={"bills": []}))
    assert workflow.normalize_reply(proxy, "results") == ("results", False)


def test_text_only_completion_is_retried_then_reported_as_incomplete(monkeypatch):
    count = 0
    async def execute(self, name, args, proposal=False):
        self.calls.append(workflow.Card(name=name, input=args, result={"houses": []}))
        return "{}"
    monkeypatch.setattr(workflow.HeatingProxy, "execute", execute)
    class Agent:
        async def arun(self, *args, **kwargs):
            nonlocal count
            count += 1
            yield SimpleNamespace(event=RunEvent.run_completed, content="付款成功（不可相信的模型文本）")
    monkeypatch.setattr(workflow, "build_agent", lambda *args: Agent())
    async def run():
        return [event async for event in workflow.stream_chat(ChatRequest(message="缴费"), SETTINGS, "tool", "action", "context")]
    final = json.loads(asyncio.run(run())[-1].split("data: ")[1])
    assert count == 2
    assert final["degraded"] is True
    assert "助手本轮回复未完整完成" in final["answer"]
    assert "您想缴费" not in final["answer"] and "付款成功" not in final["answer"]


def test_already_bound_identity_cannot_be_sent_to_unbound_form():
    proxy = workflow.HeatingProxy("tool", "action", "token", "context")
    proxy.reply_intent = "binding"
    proxy.calls = [workflow.Card(name="query_records", input={}, result={"houses": [{"id": "house-A", "address": "演示房屋"}]})]
    assert workflow.normalize_reply(proxy, "binding_details") == ("results", False)
    assert "已经绑定" in workflow.grounded_answer(proxy, "results", False)


def test_incomplete_run_continues_same_proxy_then_returns_house_choices(monkeypatch):
    runs = 0
    async def execute(self, name, args, proposal=False):
        self.demo_state = "evolved-page-state"
        self.calls.append(workflow.Card(name=name, input=args, result={"houses": [{"id": "house-F"}, {"id": "house-F2"}]}))
        return "{}"
    monkeypatch.setattr(workflow.HeatingProxy, "execute", execute)
    class Agent:
        def __init__(self, proxy):
            self.proxy = proxy
        async def arun(self, *args, **kwargs):
            nonlocal runs
            runs += 1
            assert self.proxy.demo_state == "evolved-page-state"
            if runs == 2:
                self.proxy.reply_mode = "results"
                self.proxy.reply_intent = "disconnection"
            yield SimpleNamespace(event=RunEvent.run_completed, content="未经核实的自由文本")
    monkeypatch.setattr(workflow, "build_agent", lambda settings, proxy: Agent(proxy))
    async def run():
        return [event async for event in workflow.stream_chat(ChatRequest(message="今年房子没人住"), SETTINGS, "tool", "action", "context")]
    final = json.loads(asyncio.run(run())[-1].split("data: ")[1])
    assert runs == 2 and final["degraded"] is False
    assert final["replyMode"] == "choose_house"
    assert final["focus"]["houseIds"] == ["house-F", "house-F2"]
    assert final["demoState"] == "evolved-page-state"
    assert "未经核实" not in final["answer"]


@pytest.mark.parametrize("outcome", ["materials_refused", "proposal_then_error", "reply_then_error", "bill_then_error"])
def test_terminal_tool_outcome_survives_without_repeating_action(monkeypatch, outcome, caplog):
    requests = []
    original_client = httpx.AsyncClient
    def handler(request):
        data = json.loads(request.content)
        requests.append(data["name"])
        if data["name"] == "query_records":
            return httpx.Response(200, json={"result": {"houses": [{"id": "house-F"}, {"id": "house-F2"}],
                                                      "applications": [{"id": "application-D", "status": "draft"}]},
                                            "demoState": "records-state"})
        if outcome == "materials_refused":
            return httpx.Response(422, json={"error": "materials_incomplete"})
        if data["name"] == "query_bill":
            return httpx.Response(200, json={"result": {"house": {"id": "house-F2", "address": "演示第二套"},
                                                      "bills": [{"id": "bill-house-F2", "year": "2026-2027", "status": "unpaid", "amountCents": 190000}]},
                                            "demoState": "bill-state"})
        return httpx.Response(200, json={"result": {"requiresExplicitConfirmation": True, "id": "proposal-ready"},
                                        "demoState": "proposal-state"})
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original_client(transport=httpx.MockTransport(handler), **kw))
    runs = 0
    class Agent:
        def __init__(self, proxy):
            self.proxy = proxy
        async def arun(self, *args, **kwargs):
            nonlocal runs
            runs += 1
            if outcome == "reply_then_error":
                self.proxy.reply_mode, self.proxy.reply_intent = "choose_house", "payment"
            elif outcome == "bill_then_error":
                await self.proxy.execute("query_bill", {"houseId": "house-F2", "year": "2026-2027"})
            else:
                await self.proxy.execute("submit_application", {"applicationId": "application-D"}, True)
            if outcome == "materials_refused":
                yield SimpleNamespace(event=RunEvent.run_completed, content="工具拒绝提交")
            else:
                yield SimpleNamespace(event=RunEvent.run_error, content="private-provider-message")
    monkeypatch.setattr(workflow, "build_agent", lambda settings, proxy: Agent(proxy))
    async def run():
        return [event async for event in workflow.stream_chat(ChatRequest(message="继续办理"), SETTINGS, "https://site/tool", "https://site/action", "context")]
    events = asyncio.run(run())
    final = json.loads(events[-1].split("data: ")[1])
    assert runs == 1 and requests.count("submit_application") <= 1
    assert final["degraded"] is (outcome != "materials_refused")
    if outcome == "materials_refused":
        assert final["replyMode"] == "materials"
        assert final["focus"]["applicationIds"] == ["application-D"]
        assert "材料还不齐" in final["answer"]
    elif outcome == "proposal_then_error":
        assert final["demoState"] == "proposal-state"
        assert "确认" in final["answer"]
    elif outcome == "reply_then_error":
        assert final["replyMode"] == "choose_house"
        assert final["focus"]["houseIds"] == ["house-F", "house-F2"]
    else:
        assert final["focus"]["billIds"] == ["bill-house-F2"] and final["demoState"] == "bill-state"
        assert "1900.00" in final["answer"] and "未缴费" in final["answer"]
    assert "private-provider-message" not in final["answer"] and "private-provider-message" not in caplog.text


def test_payment_record_query_distinguishes_unpaid_from_completed():
    proxy = workflow.HeatingProxy("tool", "action", "token", "context")
    proxy.reply_intent = "records"
    bill = {"id": "bill-A", "status": "unpaid"}
    proxy.calls = [workflow.Card(name="query_records", input={}, result={"bills": [bill]})]
    assert "没有已完成" in workflow.grounded_answer(proxy, "results", False)
    bill["status"] = "paid"
    assert "1 笔已完成" in workflow.grounded_answer(proxy, "results", False)


def test_mistyped_model_focus_cannot_discard_verified_invoice_or_expand_scope():
    proxy = workflow.HeatingProxy("tool", "action", "token", "context")
    invoice = {"id": "invoice-real", "amountCents": 215000, "label": "模拟发票"}
    proxy.calls = [
        workflow.Card(name="query_records", input={}, result={"invoices": [invoice]}),
        workflow.Card(name="query_invoice", input={"invoiceId": "invoice-real"}, result=invoice),
    ]
    proxy.reply_focus = Focus(invoiceIds=["invoice-model-typo"], houseIds=["house-other-user"], billIds=["bill-other-user"])
    focus = workflow.display_focus(proxy, "results")
    assert focus.invoiceIds == ["invoice-real"]
    assert focus.houseIds == [] and focus.billIds == []
    answer = workflow.grounded_answer(proxy, "results", False)
    assert "2150.00" in answer
    assert "invoice-model-typo" not in answer and "other-user" not in answer
