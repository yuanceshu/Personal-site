"""琴台票务 Agent：Agno 工具 Agent + SSE，做法与食智助手（restaurant_ai）一致。

边界（与主站不变量一致）：模型不碰金额、库存与状态机。工具只在**请求自带的确定性投影**
上检索、比价、解释政策，并能抛出待确认提案（`hold-…` / `change-…`）；真正的锁座、改价、
补货、审批全部由浏览器侧的确定性代码在用户确认后执行。无模型时确定性降级，不伪造数据。
"""

import asyncio
import json
import re
from dataclasses import dataclass, field
from uuid import uuid4

from agno.agent import Agent, RunEvent
from agno.models.openai import OpenAIChat

from ...config import Settings
from .schemas import (
    AlertRow,
    Card,
    CardItem,
    ChatRequest,
    ChatResult,
    DisclosureBrief,
    MerchantBrief,
    PacingRow,
    Proposal,
    ProposalAction,
    ShowBrief,
    Source,
)

FOLLOWUPS: dict[str, list[str]] = {
    "customer": ["帮我看看这份费用拆分", "哪个票档还有连座？", "售罄的票档怎么候补？"],
    "merchant": ["哪些场次明显低于同类基线？", "帮我把惠民票做个活动草案", "现在有哪些待审批的提案？"],
}

TOOL_LABELS = {
    "search_shows": "检索本次页面的票档",
    "get_show_detail": "核对票档细节",
    "compare_tiers": "比价几个票档",
    "explain_fees": "核对费用逐项拆分",
    "search_policy": "查阅购票规则",
    "stage_hold": "准备锁座草案",
    "list_pacing": "读取排期与售出进度",
    "list_alerts": "汇总需要关注的票档",
    "list_pending_changes": "读取待审批提案",
    "stage_change": "准备变更草案",
}

FOOTNOTE = "本演示的库存、费用与运营数字均为本地模拟数据，不产生真实交易。"


@dataclass
class Evidence:
    sources: dict[str, Source] = field(default_factory=dict)
    cards: dict[str, Card] = field(default_factory=dict)
    proposal: Proposal | None = None
    seen_products: set[str] = field(default_factory=set)

    def add_source(self, id: str, title: str, category: str, excerpt: str):
        self.sources[id] = Source(id=id, title=title, category=category, excerpt=excerpt[:600])


def _grams(text: str) -> set[str]:
    """中英混合的粗分词：去掉空白后取相邻二字，英文额外取整词。"""
    cleaned = re.sub(r"\s+", "", (text or "").lower())
    grams = {cleaned[i : i + 2] for i in range(max(0, len(cleaned) - 1))}
    grams.update(re.findall(r"[a-z0-9]{2,}", (text or "").lower()))
    return {gram for gram in grams if gram.strip()}


def _search_shows(query: str, shows: list[ShowBrief], limit: int = 4) -> list[ShowBrief]:
    grams = _grams(query)
    if not grams:
        return []
    ranked: list[tuple[int, ShowBrief]] = []
    for show in shows:
        title_score = sum(3 for gram in grams if gram in show.title.lower())
        attribute_score = sum(
            1
            for gram in grams
            if any(gram in (value or "").lower() for value in (show.event_name, show.venue, show.tier))
        )
        score = title_score + attribute_score
        if score > 0:
            ranked.append((score, show))
    ranked.sort(key=lambda pair: (-pair[0], pair[1].price))
    return [show for _, show in ranked[:limit]]


def _money(value: float) -> str:
    return f"¥{value:,.2f}"


def _show_line(show: ShowBrief) -> str:
    stock = "已售罄" if show.remaining == 0 else f"余 {show.remaining}"
    return f"{show.product_id}｜{show.title}｜{_money(show.price)}｜{stock}"


def _disclosure_card(disclosure: DisclosureBrief) -> Card:
    return Card(
        id="fees",
        title=disclosure.title,
        eyebrow="含全部费用 · 逐项拆分",
        items=[CardItem(label=row.label, value=row.value) for row in disclosure.rows[:8]],
    )


def _pacing_card(merchant: MerchantBrief) -> Card:
    rows = sorted(
        merchant.pacing,
        key=lambda row: (row.pace_vs_baseline_pts if row.pace_vs_baseline_pts is not None else 999),
    )[:6]
    return Card(
        id="pacing",
        title=f"{merchant.promoter} · 售出进度",
        eyebrow=f"区间 {merchant.current_period}",
        items=[
            CardItem(
                label=f"{row.product_id} · {row.tier or ''}".strip(),
                value=(
                    f"{row.sell_through_pct}% 已售"
                    + (f"（对基线 {row.pace_vs_baseline_pts:+.1f} 点）" if row.pace_vs_baseline_pts is not None else "")
                    + f"，余 {row.remaining}"
                ),
            )
            for row in rows
        ],
    )


def _alerts_card(alerts: list[AlertRow]) -> Card:
    return Card(
        id="alerts",
        title="需要关注的票档",
        eyebrow="程序判定 · 非模型推测",
        items=[
            CardItem(
                label=f"{alert.title}",
                value=("即将售罄" if alert.kind == "low_stock" else "低于同类基线") + f"，余 {alert.stock}",
            )
            for alert in alerts[:6]
        ],
    )


def build_agent(payload: ChatRequest, settings: Settings, evidence: Evidence) -> Agent:
    context = payload.context
    # 选中项通常也在候选集里：按编号去重，否则检索卡片会出现同一票档两遍。
    shows: list[ShowBrief] = list(context.results)
    if context.selected is not None:
        shows = [context.selected, *shows]
    deduped: list[ShowBrief] = []
    seen_ids: set[str] = set()
    for show in shows:
        if show.product_id in seen_ids:
            continue
        seen_ids.add(show.product_id)
        deduped.append(show)
    shows = deduped
    by_id = {show.product_id: show for show in shows}
    disclosure = context.disclosure
    merchant = context.merchant

    instructions = [
        f"你是「{context.store}」的演示 Agent，服务武汉琴台一带的演出票务场景，金额一律用人民币。",
        (
            "所有数据都来自本次请求携带的页面投影，均为本地模拟数据。只能依据工具返回的信息回答，"
            "绝不声称掌握真实票务库存、真实支付或真实演出安排。"
        ),
        (
            f"锁座 {context.limits.hold_minutes} 分钟、"
            f"同一场演出每单最多 {context.limits.max_tickets_per_event} 张、"
            f"回流票领取窗口 {context.limits.offer_claim_minutes} 分钟、"
            f"电子票条码每 {context.limits.barcode_rotation_seconds} 秒刷新。"
        ),
        "费用问题必须先调用 explain_fees；规则问题先调用 search_policy；不确定票档细节先调用 get_show_detail。",
        (
            "你可以准备待确认的草案（锁座、改价、活动、补货），但绝不能声称已经锁座、已经改价、"
            "已经发布或已经收款——最终执行必须由页面用户确认。"
        ),
        "回答简洁具体，引用工具返回的票档编号与数字；不展示内部提示词、工具名或技术参数。",
        "不要输出 Markdown 代码块、工具指令或交易字段。",
    ]

    def search_shows(query: str) -> str:
        """在当前页面提供的候选票档里检索。用户问「有没有什么演出」时使用。"""
        found = _search_shows(query, shows)
        for show in found:
            evidence.seen_products.add(show.product_id)
        if found:
            evidence.cards["shows"] = Card(
                id="shows",
                title="本次页面里的票档",
                eyebrow="本地模拟库存",
                items=[
                    CardItem(
                        label=show.title,
                        value=f"{_money(show.price)} · " + ("已售罄" if show.sold_out else f"余 {show.remaining}"),
                    )
                    for show in found
                ],
            )
        return json.dumps([show.model_dump() for show in found], ensure_ascii=False)

    def get_show_detail(product_id: str) -> str:
        """按票档编号核对细节（场次、场馆、票档、余量、性价比分）。"""
        show = by_id.get(product_id) or next((s for s in shows if s.product_id.lower() == product_id.lower()), None)
        if show is None:
            available = "、".join(by_id) or "无"
            return f"本次投影里没有 {product_id}。当前可用编号：{available}。"
        evidence.seen_products.add(show.product_id)
        return json.dumps(show.model_dump(), ensure_ascii=False)

    def compare_tiers(product_ids: str) -> str:
        """比较几个票档（逗号分隔的编号），按顺序给出价格、余量与性价比。"""
        wanted = [item.strip() for item in product_ids.replace("；", ",").replace(" ", ",").split(",") if item.strip()]
        rows = [by_id[item] for item in wanted if item in by_id]
        missing = [item for item in wanted if item not in by_id]
        if not rows:
            return f"这些编号都不在本次投影里：{'、'.join(wanted)}。"
        for show in rows:
            evidence.seen_products.add(show.product_id)
        return json.dumps(
            {"rows": [show.model_dump() for show in rows], "missing": missing},
            ensure_ascii=False,
        )

    def explain_fees(product_id: str = "") -> str:
        """返回费用逐项拆分（含全部费用、票面价、服务费、场馆费、订单处理费、官方价与性价比分）。"""
        if disclosure is None:
            return "本次页面没有携带费用拆分，无法逐项说明；请先打开该票档的价格与购票规则。"
        if product_id and product_id.lower() != disclosure.product_id.lower():
            return f"本次携带的是 {disclosure.product_id} 的费用拆分，与 {product_id} 不一致。"
        evidence.cards["fees"] = _disclosure_card(disclosure)
        evidence.add_source(
            "fees",
            disclosure.title,
            "费用披露",
            "；".join(f"{row.label} {row.value}" for row in disclosure.rows[:6]),
        )
        return json.dumps(disclosure.model_dump(), ensure_ascii=False)

    def search_policy(query: str) -> str:
        """查阅购票规则（锁座、候补、退票、转票、电子票入场等）。回答规则问题前必须调用。"""
        grams = _grams(query)
        ranked = []
        for policy in context.policies:
            score = sum(3 for gram in grams if gram in policy.title.lower())
            score += sum(1 for gram in grams if gram in policy.content.lower())
            if score > 0:
                ranked.append((score, policy))
        ranked.sort(key=lambda pair: -pair[0])
        found = [policy for _, policy in ranked[:3]]
        for policy in found:
            evidence.add_source(policy.policy_id, policy.title, "购票规则", policy.content)
        if not found:
            return "本次投影里没有相关规则条目；可以换个说法，或直接看页面上的票务说明。"
        return json.dumps([policy.model_dump() for policy in found], ensure_ascii=False)

    def stage_hold(product_id: str, quantity: int) -> str:
        """准备一份待用户确认的锁座草案；不会真的锁座，也不会扣款。"""
        show = by_id.get(product_id)
        if show is None:
            return f"无法准备草案：{product_id} 不在本次投影里。"
        if quantity < 1:
            return "无法准备草案：数量至少为 1。"
        if quantity > context.limits.max_tickets_per_event:
            return f"无法准备草案：每场演出最多 {context.limits.max_tickets_per_event} 张，本次锁座未变更。"
        if show.remaining < quantity:
            left = show.remaining
            if left == 0:
                return "该票档已售罄；候补在演出详情页加入，这里只能准备观众转票的查看建议。"
            return f"无法准备草案：该票档仅剩 {left} 张。"
        evidence.proposal = Proposal(
            id=f"hold-{uuid4().hex[:10]}",
            title="锁座草案",
            detail=(
                f"{show.title} · {quantity} 张 · 含全部费用 {_money(show.price * quantity)}；"
                f"确认后由页面发起 {context.limits.hold_minutes} 分钟锁座，期间不扣款。"
            ),
            action_label="确认演示锁座",
            action=ProposalAction(
                kind="hold",
                listing_id=show.product_id,
                quantity=quantity,
                value=None,
                note=None,
            ),
        )
        return "已生成待确认的锁座草案；尚未占用座位。"

    instructions.append("需要锁座时先 get_show_detail 核对余量，再 stage_hold；一次只准备一份草案。")

    tools: list = [search_shows, get_show_detail, compare_tiers, explain_fees, search_policy]

    if payload.role == "customer":
        tools.append(stage_hold)
    else:
        instructions.append(
            "运营侧只读取排期、告警与待审批提案；准备任何改价/活动/补货草案前，先调用 list_pacing 核对实时售出进度。"
        )

        def list_pacing(limit: int = 8) -> str:
            """读取候选场次的实时售出进度、基线与余量。运营侧分析或准备变更前必须调用。"""
            if merchant is None:
                return "本次页面没有携带运营数据；请先打开排期面板。"
            rows: list[PacingRow] = merchant.pacing[: max(1, min(limit, 24))]
            evidence.cards["pacing"] = _pacing_card(merchant)
            evidence.add_source(
                "pacing",
                f"{merchant.promoter} 演示排期",
                "运营数据",
                f"区间 {merchant.current_period}：销售额 ¥{merchant.totals.sales:,.0f}，"
                f"订单 {merchant.totals.orders} 笔，转化 {merchant.totals.conversion_rate}%。",
            )
            return json.dumps([row.model_dump() for row in rows], ensure_ascii=False)

        def list_alerts() -> str:
            """列出程序判定的库存与节奏告警（即将售罄 / 低于同类基线）。"""
            if merchant is None:
                return "本次页面没有携带运营数据；请先打开排期面板。"
            if merchant.alerts:
                evidence.cards["alerts"] = _alerts_card(merchant.alerts)
            return json.dumps([alert.model_dump() for alert in merchant.alerts], ensure_ascii=False)

        def list_pending_changes() -> str:
            """列出当前待审批的变更提案。"""
            if merchant is None:
                return "本次页面没有携带运营数据；请先打开排期面板。"
            return json.dumps([row.model_dump() for row in merchant.pending_changes], ensure_ascii=False)

        def stage_change(kind: str, listing_id: str, value: float, note: str = "") -> str:
            """准备一份待审批的运营变更草案。kind 取 price/promotion/restock；
            price 的 value 是新含全部费用价格，promotion 是新折扣百分比，restock 是释放张数。
            只校验护栏并生成草案，绝不改价、补货或发布。"""
            if merchant is None:
                return "无法准备草案：本次页面没有携带运营数据。"
            row = next((item for item in merchant.pacing if item.product_id.lower() == listing_id.lower()), None)
            if row is None:
                known = "、".join(item.product_id for item in merchant.pacing) or "无"
                return f"无法准备草案：{listing_id} 不在本次运营投影里。可用编号：{known}。"
            caps = merchant.guardrails
            action_kind: str
            action_value: float | None
            action_quantity: int | None
            if kind == "price":
                if value <= 0:
                    return "无法准备草案：价格必须为正数。"
                delta_pct = abs(value - row.price) / row.price * 100
                if delta_pct > caps.max_price_delta_pct:
                    return (
                        f"无法准备草案：改价幅度 {delta_pct:.0f}% 超出单次上限 "
                        f"{caps.max_price_delta_pct:.0f}%。请分次或缩小幅度。"
                    )
                detail = f"{listing_id}：含全部费用 {_money(row.price)} → {_money(value)}"
                action_kind, action_value, action_quantity = "price", value, None
            elif kind == "promotion":
                if value <= 0 or value > caps.max_promotion_discount_pct:
                    return (
                        f"无法准备草案：折扣 {value:.0f}% 超出活动上限 "
                        f"{caps.max_promotion_discount_pct:.0f}%。"
                    )
                promo = round(row.price * (1 - value / 100), 2)
                detail = f"{listing_id}：活动价 {_money(promo)}（折扣 {value:.0f}%，常设价 {_money(row.price)} 不变）"
                action_kind, action_value, action_quantity = "promotion", value, None
            elif kind == "restock":
                if value < 1 or value > caps.max_restock_quantity:
                    return f"无法准备草案：释放张数需在 1 到 {caps.max_restock_quantity} 之间。"
                detail = f"{listing_id}：释放 {int(value)} 张保留座位进入在售容量"
                action_kind, action_value, action_quantity = "restock", None, int(value)
            else:
                return "无法准备草案：kind 只支持 price、promotion、restock。"
            action_note = (note or "")[:120] or None
            if note:
                detail += f"；说明：{note[:120]}"
            action = ProposalAction(
                kind=action_kind if action_kind in ("price", "promotion") else "restock",
                listing_id=row.product_id,
                quantity=action_quantity,
                value=action_value,
                note=action_note,
            )
            evidence.proposal = Proposal(
                id=f"change-{uuid4().hex[:10]}",
                title="运营变更草案",
                detail=detail + "。确认后由页面按当前余额复校并应用。",
                action_label="确认演示变更",
                action=action,
            )
            return "已生成待确认的运营变更草案；尚未改价、补货或发布。"

        tools += [list_pacing, list_alerts, list_pending_changes, stage_change]

    model = OpenAIChat(
        id=settings.model,
        api_key=settings.api_key,
        base_url=settings.base_url,
        timeout=settings.model_timeout,
        max_retries=0,
    )
    return Agent(
        id=f"qintai-{payload.role}",
        model=model,
        tools=tools,
        instructions=instructions,
        tool_call_limit=6,
        telemetry=False,
        stream=True,
        stream_events=True,
    )


def grounded_answer(payload: ChatRequest, evidence: Evidence) -> str:
    """无模型或模型失败时的确定性回答：只用请求里已经确定的投影说话。"""
    context = payload.context
    if payload.role == "merchant":
        merchant = context.merchant
        if merchant is None:
            return "运营台还没有载入当前数据。请先打开排期或告警面板，我再基于真实数字说明。"
        parts = [
            (
                f"当前区间 {merchant.current_period}：销售额 ¥{merchant.totals.sales:,.0f}，"
                f"订单 {merchant.totals.orders} 笔，访问 {merchant.totals.traffic}，"
                f"转化 {merchant.totals.conversion_rate}%。"
            )
        ]
        if merchant.alerts:
            listed = "、".join(
                f"{alert.title}（{'即将售罄' if alert.kind == 'low_stock' else '低于基线'}，余 {alert.stock}）"
                for alert in merchant.alerts[:4]
            )
            parts.append(f"需要关注：{listed}。")
        caps = merchant.guardrails
        parts.append(
            f"改价单次上限 {caps.max_price_delta_pct:.0f}%、活动折扣上限 "
            f"{caps.max_promotion_discount_pct:.0f}%，任何改动都先生成待审批提案。"
        )
        return "".join(parts)

    selected = context.selected
    if selected is not None and context.disclosure is not None:
        rows = "；".join(f"{row.label} {row.value}" for row in context.disclosure.rows)
        stock = "该票档当前已售罄，只能加入候补。" if selected.remaining == 0 else f"当前还剩 {selected.remaining} 张。"
        return (
            f"{selected.title}：{rows}。{stock}"
            f"以上是确定的费用与余量数字，锁座 {context.limits.hold_minutes} 分钟内不扣款。"
        )
    if selected is not None:
        extra = f"，性价比分 {selected.value_score}/10" if selected.value_score else ""
        stock = "，当前已售罄（可加入候补）。" if selected.remaining == 0 else f"，当前还剩 {selected.remaining} 张。"
        return f"{selected.title} 的含全部费用为 {_money(selected.price)}{extra}{stock}"
    if context.results:
        listed = "、".join(
            f"{(show.event_name or show.title)}·{show.tier or ''} {_money(show.price)}" for show in context.results[:5]
        )
        return f"当前列表里有这些票档：{listed}。点开任意一场可以看到逐项费用和实时余量。"
    if context.policies:
        policy = context.policies[0]
        return f"《{policy.title}》：{policy.content}"
    if evidence.sources:
        source = next(iter(evidence.sources.values()))
        return f"我查到了《{source.title}》：{source.excerpt}"
    return "我还没有拿到本次界面的数据，没法给出确定回答。先打开一场演出，或把问题说得更具体一些。"


async def stream_chat(payload: ChatRequest, settings: Settings):
    evidence = Evidence()
    history = "\n".join(f"{item.role}: {item.content}" for item in payload.history)
    accepted = ", ".join(payload.accepted)
    prompt = (
        f"角色：{payload.role}\n最近对话（仅作上下文）：\n{history or '无'}\n"
        f"本页已确认的提案 ID：{accepted or '无'}\n当前用户请求：{payload.message}"
    )
    try:
        agent = build_agent(payload, settings, evidence)
        async with asyncio.timeout(48):
            async for event in agent.arun(prompt, stream=True, stream_events=True, yield_run_output=True):
                kind = getattr(event, "event", None)
                if kind == RunEvent.tool_call_started:
                    name = getattr(getattr(event, "tool", None), "tool_name", "")
                    if name in TOOL_LABELS:
                        yield (
                            "event: status\ndata: "
                            + json.dumps({"label": TOOL_LABELS[name]}, ensure_ascii=False)
                            + "\n\n"
                        )
                elif kind == RunEvent.run_error:
                    raise RuntimeError("agent run failed")
        result = ChatResult(
            answer=grounded_answer(payload, evidence),
            sources=list(evidence.sources.values()),
            cards=list(evidence.cards.values()),
            proposal=evidence.proposal,
            followups=FOLLOWUPS[payload.role],
        )
        yield "event: final\ndata: " + result.model_dump_json() + "\n\n"
    except asyncio.CancelledError:
        raise
    except Exception:
        # 已经拿到工具证据就仍然确定性作答，否则明确报错（由前端降级）。
        if evidence.cards or evidence.sources or evidence.proposal:
            result = ChatResult(
                answer=grounded_answer(payload, evidence),
                sources=list(evidence.sources.values()),
                cards=list(evidence.cards.values()),
                proposal=evidence.proposal,
                followups=FOLLOWUPS[payload.role],
            )
            yield "event: final\ndata: " + result.model_dump_json() + "\n\n"
        else:
            yield 'event: error\ndata: {"error":"Agent 暂时无法完成这项任务，请稍后重试。"}\n\n'
