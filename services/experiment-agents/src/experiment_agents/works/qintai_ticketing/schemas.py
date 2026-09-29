"""琴台票务（武汉门票场景）的请求/响应契约。

与 `apps/main/lib/works/qintai-ticketing/schema.ts` 一一对应：`context` 是前端确定性投影
（当次候选、选中项、费用行、会话摘要、相关制度、运营快照），服务端不落 fixture、不读本地
文件，只对该投影做检索、比价、政策解释与**提案暂存**。
"""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

Role = Literal["customer", "merchant"]
AcceptedId = Annotated[str, Field(pattern=r"^[a-z]+-[A-Za-z0-9-]{2,40}$")]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class HistoryMessage(StrictModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1200)


class Limits(StrictModel):
    hold_minutes: int = Field(gt=0)
    max_tickets_per_event: int = Field(gt=0)
    offer_claim_minutes: int = Field(gt=0)
    barcode_rotation_seconds: int = Field(gt=0)


class ShowBrief(StrictModel):
    product_id: str = Field(min_length=1, max_length=40)
    title: str = Field(min_length=1, max_length=200)
    price: float = Field(ge=0)
    currency: str = Field(max_length=8)
    category: str = Field(max_length=20)
    remaining: int = Field(ge=0)
    sold_out: bool
    event_name: str | None = Field(default=None, max_length=120)
    event_date: str | None = Field(default=None, max_length=20)
    event_time: str | None = Field(default=None, max_length=10)
    venue: str | None = Field(default=None, max_length=120)
    tier: str | None = Field(default=None, max_length=60)
    labels: list[str] = Field(default_factory=list, max_length=4)
    value_score: int | None = Field(default=None, ge=1, le=10)
    vs_box_office: str | None = Field(default=None, max_length=12)


class DisclosureRow(StrictModel):
    label: str = Field(min_length=1, max_length=40)
    value: str = Field(min_length=1, max_length=40)
    note: str | None = Field(default=None, max_length=160)


class DisclosureBrief(StrictModel):
    title: str = Field(min_length=1, max_length=220)
    product_id: str = Field(min_length=1, max_length=40)
    rows: list[DisclosureRow] = Field(default_factory=list, max_length=12)
    sources: list[str] = Field(default_factory=list, max_length=6)
    footnotes: list[str] = Field(default_factory=list, max_length=4)


class PolicyBrief(StrictModel):
    policy_id: str = Field(min_length=1, max_length=40)
    title: str = Field(min_length=1, max_length=80)
    content: str = Field(min_length=1, max_length=600)


class HoldBrief(StrictModel):
    product_id: str = Field(max_length=40)
    title: str = Field(max_length=200)
    quantity: int = Field(gt=0)
    seconds_remaining: int = Field(ge=0)


class WaitlistBrief(StrictModel):
    product_id: str = Field(max_length=40)
    title: str = Field(max_length=200)
    position: int = Field(gt=0)


class OfferBrief(StrictModel):
    product_id: str = Field(max_length=40)
    title: str = Field(max_length=200)
    quantity: int = Field(gt=0)
    seconds_remaining: int = Field(ge=0)


class TicketBrief(StrictModel):
    ticket_id: str = Field(max_length=40)
    title: str = Field(max_length=200)
    seat: str = Field(max_length=80)
    status: str = Field(max_length=30)


class TransferBrief(StrictModel):
    transfer_id: str = Field(max_length=40)
    recipient: str = Field(max_length=60)
    ticket_ids: list[str] = Field(default_factory=list, max_length=8)


class SessionBrief(StrictModel):
    user_name: str | None = Field(default=None, max_length=40)
    holds: list[HoldBrief] = Field(default_factory=list, max_length=8)
    waitlist: list[WaitlistBrief] = Field(default_factory=list, max_length=8)
    offers: list[OfferBrief] = Field(default_factory=list, max_length=8)
    tickets: list[TicketBrief] = Field(default_factory=list, max_length=20)
    pending_transfers: list[TransferBrief] = Field(default_factory=list, max_length=8)


class MerchantTotals(StrictModel):
    sales: float
    orders: int
    traffic: int
    conversion_rate: float
    sales_change_pct: float | None = None
    currency: str = Field(max_length=8)


class MerchantCounts(StrictModel):
    low_stock: int = Field(ge=0)
    slow_movers: int = Field(ge=0)
    order_issues: int = Field(ge=0)
    pending_changes: int = Field(ge=0)


class MerchantEvent(StrictModel):
    event_id: str = Field(max_length=40)
    event_name: str = Field(max_length=120)
    event_date: str = Field(max_length=20)
    days_to_event: int
    sold_out: bool


class PacingRow(StrictModel):
    product_id: str = Field(max_length=40)
    tier: str | None = Field(default=None, max_length=60)
    price: float
    capacity: int = Field(ge=0)
    sold: int = Field(ge=0)
    remaining: int = Field(ge=0)
    sell_through_pct: float
    baseline_pct: float | None = None
    pace_vs_baseline_pts: float | None = None
    waitlist_depth: int = Field(ge=0)


class AlertRow(StrictModel):
    listing_id: str = Field(max_length=40)
    title: str = Field(max_length=200)
    kind: Literal["low_stock", "slow_mover"]
    stock: int
    threshold: int | None = None


class PendingChangeRow(StrictModel):
    change_id: str = Field(max_length=40)
    kind: str = Field(max_length=30)
    summary: str = Field(max_length=200)
    item_count: int = Field(ge=0)


class GuardrailCaps(StrictModel):
    max_price_delta_pct: float
    max_promotion_discount_pct: float
    max_restock_quantity: int
    max_campaign_budget: float


class MerchantBrief(StrictModel):
    promoter: str = Field(min_length=1, max_length=80)
    current_period: str = Field(max_length=40)
    totals: MerchantTotals
    counts: MerchantCounts
    events: list[MerchantEvent] = Field(default_factory=list, max_length=12)
    pacing: list[PacingRow] = Field(default_factory=list, max_length=24)
    alerts: list[AlertRow] = Field(default_factory=list, max_length=24)
    pending_changes: list[PendingChangeRow] = Field(default_factory=list, max_length=12)
    guardrails: GuardrailCaps


class AgentContext(StrictModel):
    page: Literal[
        "home", "shows", "show", "wallet", "waitlist", "orders", "events", "holds", "merchant", "other"
    ]
    store: str = Field(min_length=1, max_length=40)
    limits: Limits
    results: list[ShowBrief] = Field(default_factory=list, max_length=12)
    selected: ShowBrief | None = None
    disclosure: DisclosureBrief | None = None
    policies: list[PolicyBrief] = Field(default_factory=list, max_length=6)
    session: SessionBrief | None = None
    merchant: MerchantBrief | None = None


class ChatRequest(StrictModel):
    role: Role
    message: str = Field(min_length=1, max_length=1200)
    history: list[HistoryMessage] = Field(default_factory=list, max_length=16)
    accepted: list[AcceptedId] = Field(default_factory=list, max_length=12)
    context: AgentContext


class Source(StrictModel):
    id: str
    title: str
    category: str
    excerpt: str


class CardItem(StrictModel):
    label: str
    value: str


class Card(StrictModel):
    id: str
    title: str
    eyebrow: str
    items: list[CardItem]


class ProposalAction(StrictModel):
    """草案携带的结构化动作。模型只填字段，执行在浏览器侧重新校验。"""

    kind: Literal["hold", "price", "promotion", "restock"]
    listing_id: str
    quantity: int | None = None
    value: float | None = None
    note: str | None = None


class Proposal(StrictModel):
    id: str
    title: str
    detail: str
    action_label: str
    action: ProposalAction | None = None


class ChatResult(StrictModel):
    mode: Literal["live"] = "live"
    answer: str
    sources: list[Source]
    cards: list[Card]
    proposal: Proposal | None = None
    followups: list[str] = Field(default_factory=list, max_length=3)
