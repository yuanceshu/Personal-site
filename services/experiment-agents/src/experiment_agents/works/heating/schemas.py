from typing import Annotated, Any, Literal
from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Message(StrictModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=12000)


class ChatRequest(StrictModel):
    message: str = Field(min_length=1, max_length=2000)
    demoState: str = Field(default="", max_length=256000)
    history: list[Message] = Field(default_factory=list, max_length=20)
    pending: dict[str, Any] | None = None


ReplyMode = Literal["results", "choose_house", "binding_details", "materials", "clarify"]


Reference = Annotated[str, Field(min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")]


class Focus(StrictModel):
    houseIds: list[Reference] = Field(default_factory=list, max_length=8)
    billIds: list[Reference] = Field(default_factory=list, max_length=8)
    applicationIds: list[Reference] = Field(default_factory=list, max_length=8)
    invoiceIds: list[Reference] = Field(default_factory=list, max_length=8)


class Reply(StrictModel):
    mode: ReplyMode
    focus: Focus = Field(default_factory=Focus)


class Card(StrictModel):
    name: str
    input: dict[str, Any]
    result: Any


class ChatResult(StrictModel):
    answer: str = Field(min_length=1, max_length=12000)
    usedTools: list[str] = Field(max_length=12)
    cards: list[Card] = Field(max_length=12)
    degraded: bool
    replyMode: ReplyMode = "results"
    focus: Focus = Field(default_factory=Focus)
    demoState: str = Field(default="", max_length=256000)
