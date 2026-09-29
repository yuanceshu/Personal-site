from experiment_agents.works.finance_assistant.schemas import ChatRequest
from experiment_agents.works.finance_assistant.workflow import ToolRun, _block, _context


def test_finance_request_keeps_history_and_context_contract():
    payload = ChatRequest(
        message="上个月销售额是多少？",
        conversationHistory=[{"role": "user", "content": "先看集团"}],
        financeContext={"lastIntent": "financial_query"},
    )
    assert payload.conversationHistory[0].content == "先看集团"
    assert payload.financeContext["lastIntent"] == "financial_query"


def test_agno_tool_results_are_mapped_to_ui_blocks_and_follow_up_context():
    call = ToolRun(
        "reconcile_transactions",
        {"mode": "details", "timeRange": {"preset": "previous_week"}, "channel": "银联", "issueType": "AMOUNT_MISMATCH"},
        {"mode": "details", "groups": []},
    )
    block = _block(call)
    context = _context({}, call, "展开金额差异")
    assert block["type"] == "reconciliationDetails"
    assert context["lastChannel"] == "银联"
    assert context["lastReconciliationIssueType"] == "AMOUNT_MISMATCH"


def test_new_reconciliation_task_clears_previous_company_context():
    call = ToolRun(
        "reconcile_transactions",
        {"mode": "summary", "timeRange": {"preset": "previous_week"}, "channel": "银联"},
        {"mode": "summary", "summary": {}},
    )
    context = _context(
        {"lastIntent": "financial_query", "lastCompanyId": "C001", "lastMetric": "salesAmount"},
        call,
        "帮我看看上周银联渠道对账。",
    )
    assert context["lastIntent"] == "reconciliation"
    assert "lastCompanyId" not in context
    assert "lastMetric" not in context
    assert context["lastChannel"] == "银联"


def test_follow_up_context_retains_reconciliation_channel_and_adds_company_filter():
    first = ToolRun(
        "reconcile_transactions",
        {"mode": "summary", "timeRange": {"preset": "previous_week"}, "channel": "银联"},
        {"mode": "summary", "summary": {}},
    )
    first_context = _context({}, first, "帮我看看上周银联渠道的对账情况。")
    details = ToolRun(
        "reconcile_transactions",
        {"mode": "details", "timeRange": {"preset": "previous_week"}, "channel": "银联", "issueType": "AMOUNT_MISMATCH"},
        {"mode": "details", "groups": []},
    )
    details_context = _context(first_context, details, "把金额不一致的展开。")
    assert details_context["lastChannel"] == "银联"
    assert details_context["lastReconciliationIssueType"] == "AMOUNT_MISMATCH"

    follow_up = ToolRun(
        "query_financial_data",
        {"metric": "transactionAmount", "timeRange": {"preset": "previous_month"}, "filters": {"companyIds": ["C001"], "channels": ["支付宝"]}},
        {"unit": "cents", "totalCents": 0, "rows": []},
    )
    follow_up_context = _context(
        {"lastIntent": "comparison", "lastMetric": "transactionAmount", "lastChannel": "支付宝"},
        follow_up,
        "华东呢？",
    )
    assert follow_up_context["lastCompanyId"] == "C001"
    assert follow_up_context["lastChannel"] == "支付宝"
