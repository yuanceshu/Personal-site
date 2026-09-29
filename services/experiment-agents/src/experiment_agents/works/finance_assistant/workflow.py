import asyncio
import json
from dataclasses import dataclass, field
from typing import Any, Literal

import httpx
from agno.agent import Agent
from agno.models.openai import OpenAIChat

from ...config import Settings
from .schemas import ChatRequest, ChatResponse


SYSTEM = """你是云川商业集团的财务分析 Agent。你只能通过工具读取本次演示数据，不能心算、改写或补造金额。
用户的问题涉及销售额、订单、退款率、趋势、公司或渠道时调用 query_financial_data；涉及环比、同比或期间比较时调用 compare_financial_periods；
涉及变化原因或贡献因素时调用 analyze_variance；涉及异常时调用 detect_financial_anomalies；涉及支付渠道流水与差异时调用 reconcile_transactions；
用户要求经营分析或月报时调用 generate_financial_report。工具结果返回后，用中文简洁回答，说明时间范围和关键数字，必要时引用结果卡片。
数字来自确定性 Finance Tool，模型只负责理解问题、选择工具和解释结果。不要声称修改了账务、提交了对账或连接了真实财务系统。"""


@dataclass
class ToolRun:
    name: str
    args: dict[str, Any]
    result: Any


@dataclass
class FinanceProxy:
    url: str
    token: str
    calls: list[ToolRun] = field(default_factory=list)

    async def execute(self, name: str, args: dict[str, Any]) -> str:
        async with httpx.AsyncClient(timeout=18) as client:
            response = await client.post(
                self.url,
                headers={"Authorization": f"Bearer {self.token}"},
                json={"name": name, "input": args},
            )
        if response.status_code >= 400:
            result: Any = {"error": "tool_unavailable"}
        else:
            payload = response.json()
            result = payload.get("result", payload)
        self.calls.append(ToolRun(name, args, result))
        return json.dumps(result, ensure_ascii=False)


def _infer_intent(message: str) -> str:
    if any(word in message for word in ("对账", "结算", "流水", "一对多", "多对一", "多对多", "金额不一致", "差异", "订单")):
        return "reconciliation"
    if any(word in message for word in ("经营分析", "经营报告", "月报", "总结")) or ("生成" in message and "分析" in message):
        return "report"
    if any(word in message for word in ("异常", "关注", "不正常")):
        return "anomaly"
    if any(word in message for word in ("为什么", "原因", "下降主要", "贡献", "拖累")):
        return "variance"
    if any(word in message for word in ("同比", "环比", "相比", "比", "跟")):
        return "comparison"
    return "financial_query"


def _is_follow_up(message: str) -> bool:
    trimmed = message.strip()
    return trimmed.startswith(("那", "跟", "华东", "华南", "华北", "支付宝", "银联", "微信支付", "宝信", "把", "最大", "有没有", "再", "这", "同样", "继续")) and not trimmed.startswith(("帮我", "请", "生成", "给我生成"))


def _context(previous: dict[str, Any], call: ToolRun, message: str) -> dict[str, Any]:
    next_intent = _infer_intent(message)
    reset = bool(previous.get("lastIntent") and previous.get("lastIntent") != next_intent and not _is_follow_up(message))
    result = {} if reset else dict(previous)
    args = call.args
    if isinstance(args.get("metric"), str):
        result["lastMetric"] = args["metric"]
    if isinstance(args.get("timeRange"), dict):
        result["lastTimeRange"] = args["timeRange"]
    filters = args.get("filters") if isinstance(args.get("filters"), dict) else {}
    for source, target in (("companyIds", "lastCompanyId"), ("channels", "lastChannel"), ("categories", "lastCategory")):
        values = filters.get(source) if isinstance(filters, dict) else None
        if isinstance(values, list) and values:
            result[target] = values[0]
    result["lastIntent"] = next_intent
    if call.name == "reconcile_transactions":
        if not (isinstance(filters.get("companyIds"), list) and filters["companyIds"]):
            result.pop("lastCompanyId", None)
        if not (isinstance(filters.get("categories"), list) and filters["categories"]):
            result.pop("lastCategory", None)
        result.pop("lastMetric", None)
        if isinstance(args.get("channel"), str):
            result["lastChannel"] = args["channel"]
        elif reset:
            result.pop("lastChannel", None)
        if isinstance(args.get("issueType"), str):
            result["lastReconciliationIssueType"] = args["issueType"]
        elif reset:
            result.pop("lastReconciliationIssueType", None)
        if isinstance(args.get("matchType"), str):
            result["lastReconciliationMatchType"] = args["matchType"]
        elif reset:
            result.pop("lastReconciliationMatchType", None)
    elif reset:
        result.pop("lastReconciliationIssueType", None)
        result.pop("lastReconciliationMatchType", None)
    return result


def _block(call: ToolRun) -> dict[str, Any]:
    name = call.name
    if name == "query_financial_data":
        groups = call.args.get("groupBy") or []
        kind = "trend" if "date" in groups else "table" if groups else "metric"
        return {"type": kind, "title": "经营数据查询", "data": call.result}
    mapping = {
        "compare_financial_periods": ("comparison", "期间对比"),
        "analyze_variance": ("variance", "变化原因分析"),
        "detect_financial_anomalies": ("anomalyList", "财务异常"),
        "generate_financial_report": ("report", "经营分析"),
    }
    if name in mapping:
        kind, title = mapping[name]
        return {"type": kind, "title": title, "data": call.result}
    if name == "reconcile_transactions":
        kind = "reconciliationDetails" if call.args.get("mode") == "details" else "reconciliationSummary"
        return {"type": kind, "title": "对账差异明细" if kind.endswith("Details") else "对账汇总", "data": call.result}
    return {"type": "metric", "title": "工具结果", "data": call.result}


def _fallback_request(message: str) -> tuple[str, dict[str, Any]] | None:
    """模型暂时未返回工具调用时，保留演示主路径的确定性可用性。"""
    if "销售额" in message and ("上个月" in message or "上月" in message):
        return "query_financial_data", {"metric": "salesAmount", "timeRange": {"preset": "previous_month"}, "filters": {}, "groupBy": [], "includeShare": False}
    if "订单" in message and ("上个月" in message or "上月" in message):
        return "query_financial_data", {"metric": "orderCount", "timeRange": {"preset": "previous_month"}, "filters": {}, "groupBy": [], "includeShare": False}
    if "退款率" in message and ("上个月" in message or "上月" in message):
        return "query_financial_data", {"metric": "refundRate", "timeRange": {"preset": "previous_month"}, "filters": {}, "groupBy": [], "includeShare": False}
    return None


def _fallback_answer(call: ToolRun) -> str | None:
    if call.name != "query_financial_data" or not isinstance(call.result, dict) or "error" in call.result:
        return None
    data = call.result
    range_data = data.get("range", {})
    period = f"{range_data.get('start', '')} 至 {range_data.get('end', '')}"
    if data.get("unit") == "cents":
        value = float(data.get("totalCents", 0)) / 100
        label = {"salesAmount": "销售额", "transactionAmount": "交易额", "refundAmount": "退款金额", "netSalesAmount": "净销售额", "avgOrderValue": "客单价"}.get(data.get("metric"), "金额")
        return f"根据确定性 Finance Tool，{period} 的{label}为 ¥{value:,.2f}。结果来自虚构演示数据，未连接真实财务系统。"
    if data.get("unit") == "count":
        return f"根据确定性 Finance Tool，{period} 共完成 {int(data.get('totalValue', 0)):,} 笔订单。结果来自虚构演示数据。"
    if data.get("unit") == "ratio":
        return f"根据确定性 Finance Tool，{period} 退款率为 {float(data.get('totalValue', 0)) * 100:.2f}%。结果来自虚构演示数据。"
    return None


async def run_chat(payload: ChatRequest, settings: Settings, tool_url: str, tool_token: str) -> ChatResponse:
    if not settings.configured:
        raise RuntimeError("model_unavailable")
    proxy = FinanceProxy(tool_url, tool_token)

    async def query_financial_data(metric: Literal["salesAmount", "transactionAmount", "refundAmount", "netSalesAmount", "orderCount", "refundRate", "avgOrderValue"], timeRange: dict[str, Any], filters: dict[str, Any] | None = None, groupBy: list[Literal["date", "company", "channel", "category"]] | None = None, includeShare: bool = False) -> str:
        """查询销售额、交易额、退款、订单数或退款率等经营指标。"""
        return await proxy.execute("query_financial_data", {"metric": metric, "timeRange": timeRange, "filters": filters or {}, "groupBy": groupBy or [], "includeShare": includeShare})

    async def compare_financial_periods(metric: Literal["salesAmount", "transactionAmount", "refundAmount", "netSalesAmount", "orderCount", "refundRate", "avgOrderValue"], timeRange: dict[str, Any], comparison: Literal["previous_period", "previous_month", "previous_year"], filters: dict[str, Any] | None = None) -> str:
        """比较当前期间与上一期间、上月或去年同期。"""
        return await proxy.execute("compare_financial_periods", {"metric": metric, "timeRange": timeRange, "comparison": comparison, "filters": filters or {}})

    async def analyze_variance(metric: Literal["salesAmount", "transactionAmount", "refundAmount", "netSalesAmount", "orderCount", "refundRate", "avgOrderValue"], timeRange: dict[str, Any], filters: dict[str, Any] | None = None, dimension: Literal["company", "channel", "category", "date"] = "channel") -> str:
        """分析公司、渠道、品类或日期的变化贡献。"""
        return await proxy.execute("analyze_variance", {"metric": metric, "timeRange": timeRange, "filters": filters or {}, "dimension": dimension})

    async def detect_financial_anomalies(timeRange: dict[str, Any], filters: dict[str, Any] | None = None, rules: list[str] | None = None) -> str:
        """按固定规则检测销售、退款率和渠道异常。"""
        return await proxy.execute("detect_financial_anomalies", {"timeRange": timeRange, "filters": filters or {}, "rules": rules} if rules else {"timeRange": timeRange, "filters": filters or {}})

    async def reconcile_transactions(mode: Literal["summary", "details"], timeRange: dict[str, Any], channel: Literal["银联", "支付宝", "微信支付", "宝信"] | None = None, companyId: Literal["C001", "C002", "C003"] | None = None, companyIds: list[Literal["C001", "C002", "C003"]] | None = None, issueType: str | None = None, matchType: str | None = None, sortBy: Literal["ABS_DIFFERENCE_DESC", "DATE_DESC", "ID_ASC"] | None = None, limit: int | None = None) -> str:
        """执行确定性渠道对账，返回汇总或可追溯差异明细。"""
        args = {"mode": mode, "timeRange": timeRange}
        for key, value in (("channel", channel), ("companyId", companyId), ("companyIds", companyIds), ("issueType", issueType), ("matchType", matchType), ("sortBy", sortBy), ("limit", limit)):
            if value is not None: args[key] = value
        return await proxy.execute("reconcile_transactions", args)

    async def generate_financial_report(timeRange: dict[str, Any], filters: dict[str, Any] | None = None, title: str | None = None) -> str:
        """编排经营概览、期间对比、变化贡献和异常检测。"""
        args = {"timeRange": timeRange, "filters": filters or {}}
        if title: args["title"] = title
        return await proxy.execute("generate_financial_report", args)

    fallback = _fallback_request(payload.message)
    if fallback:
        name, args = fallback
        await proxy.execute(name, args)
        call = proxy.calls[-1]
        return ChatResponse(
            answer=_fallback_answer(call) or "已完成查询，请查看下方数据结果。",
            usedTools=[call.name],
            context=_context(payload.financeContext, call, payload.message),
            blocks=[_block(call)],
        )

    agent = Agent(
        id="finance-assistant",
        model=OpenAIChat(id=settings.model, api_key=settings.api_key, base_url=settings.base_url, timeout=settings.model_timeout, max_retries=0),
        tools=[query_financial_data, compare_financial_periods, analyze_variance, detect_financial_anomalies, reconcile_transactions, generate_financial_report],
        instructions=[SYSTEM, "所有时间范围与筛选字段必须通过工具参数传递；若用户追问，继承上一轮上下文但不猜测未给出的条件。"],
        tool_call_limit=6,
        telemetry=False,
    )
    history = "\n".join(f"{item.role}: {item.content}" for item in payload.conversationHistory[-20:])
    prompt = f"当前会话上下文：{json.dumps(payload.financeContext, ensure_ascii=False)}\n历史：{history or '无'}\n当前问题：{payload.message}"
    try:
        async with asyncio.timeout(min(settings.model_timeout, 45) + 3):
            result = await agent.arun(prompt)
    except asyncio.CancelledError:
        raise
    except Exception:
        result = None
    answer = (getattr(result, "content", None) or "已完成查询，请查看下方数据结果。").strip()
    if proxy.calls and _fallback_answer(proxy.calls[-1]):
        # Tool 已完成计算时，避免供应商在短暂负载下返回与数字无关的客套语。
        answer = _fallback_answer(proxy.calls[-1]) or answer
    context = dict(payload.financeContext)
    for call in proxy.calls:
        context = _context(context, call, payload.message)
    return ChatResponse(answer=answer, usedTools=[call.name for call in proxy.calls], context=context, blocks=[_block(call) for call in proxy.calls])
