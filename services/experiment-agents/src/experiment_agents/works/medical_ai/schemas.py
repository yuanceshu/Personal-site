from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class HistoryMessage(StrictModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2400)


class ChatRequest(StrictModel):
    message: str = Field(min_length=1, max_length=4000)
    context: dict[str, Any]
    history: list[HistoryMessage] = Field(default_factory=list, max_length=8)
    deterministic_answer: str = Field(min_length=1, max_length=2400)


class ChatResponse(StrictModel):
    mode: Literal["live"] = "live"
    answer: str = Field(min_length=1, max_length=2400)
