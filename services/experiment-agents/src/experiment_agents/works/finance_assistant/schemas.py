from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class HistoryMessage(StrictModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=10_000)


class ChatRequest(StrictModel):
    message: str = Field(min_length=1, max_length=2_000)
    conversationHistory: list[HistoryMessage] = Field(default_factory=list, max_length=20)
    financeContext: dict[str, Any] = Field(default_factory=dict)


class ChatResponse(StrictModel):
    answer: str = Field(min_length=1, max_length=8_000)
    usedTools: list[str] = Field(default_factory=list, max_length=12)
    context: dict[str, Any] = Field(default_factory=dict)
    blocks: list[dict[str, Any]] = Field(default_factory=list, max_length=12)
