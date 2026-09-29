from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class HistoryMessage(StrictModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1200)


class ProfileBrief(StrictModel):
    adults: int = Field(ge=0, le=20)
    children: int = Field(ge=0, le=20)
    elderly: int = Field(ge=0, le=20)
    fitness: Literal["low", "medium", "high"]
    availableMinutes: int = Field(ge=0, le=600)
    interests: list[str] = Field(max_length=6)
    avoidStairs: bool


class ContextBrief(StrictModel):
    currentSpotName: str = Field(min_length=1, max_length=80)
    currentSpotId: str = Field(min_length=1, max_length=80)
    profile: ProfileBrief
    hasRoute: bool
    routeSummary: str | None = Field(default=None, max_length=400)
    visitedSpotIds: list[str] = Field(max_length=20)


class ChatRequest(StrictModel):
    message: str = Field(min_length=1, max_length=1000)
    context: ContextBrief
    history: list[HistoryMessage] = Field(default_factory=list, max_length=8)
    deterministicAnswer: str = Field(min_length=1, max_length=2400)
    tool: str | None = Field(default=None, max_length=80)
    toolResult: Any = None


class ChatResponse(StrictModel):
    mode: Literal["live"] = "live"
    answer: str = Field(min_length=1, max_length=2400)
