from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


Role = Literal["customer", "operations", "finance"]
AcceptedId = Annotated[str, Field(pattern=r"^(booking|campaign|review)-[a-f0-9]{10}$")]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class HistoryMessage(StrictModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1200)


class ChatRequest(StrictModel):
    role: Role
    message: str = Field(min_length=1, max_length=1200)
    history: list[HistoryMessage] = Field(default_factory=list, max_length=16)
    accepted: list[AcceptedId] = Field(default_factory=list, max_length=12)


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


class Proposal(StrictModel):
    id: str
    title: str
    detail: str
    action_label: str


class ChatResult(StrictModel):
    mode: Literal["live"] = "live"
    answer: str
    sources: list[Source]
    cards: list[Card]
    proposal: Proposal | None = None
    followups: list[str] = Field(default_factory=list, max_length=3)
