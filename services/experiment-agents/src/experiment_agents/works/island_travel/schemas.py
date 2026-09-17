"""Island Travel wire contract. No passenger, fare or transaction fields."""

import re
from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Conditions(StrictModel):
    origin: str | None = Field(default=None, min_length=1, max_length=30)
    destination: str | None = Field(default=None, min_length=1, max_length=30)
    date: str | None = None
    time_preference: Literal["不限", "上午", "下午", "晚上"] | None = None
    quantity: int | None = Field(default=None, ge=1, le=5, strict=True)

    @field_validator("date")
    @classmethod
    def valid_date(cls, value):
        if value is not None:
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
                raise ValueError("invalid date")
            date.fromisoformat(value)
        return value

    @field_validator("origin", "destination")
    @classmethod
    def no_numeric_identity(cls, value):
        if value and re.search(r"\d{7,}", value):
            raise ValueError("sensitive input")
        return value


class Message(StrictModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1200)

    @field_validator("content")
    @classmethod
    def no_sensitive_numbers(cls, value):
        def allow_date(match):
            try:
                date.fromisoformat(match.group())
                return "日期"
            except ValueError:
                return match.group()

        without_dates = re.sub(r"(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)", allow_date, value)
        if re.search(r"\d{7,}", re.sub(r"[\s+()（）-]", "", without_dates)):
            raise ValueError("sensitive input")
        return value


class ChatRequest(StrictModel):
    message: str = Field(min_length=1, max_length=1200)
    conditions: Conditions = Field(default_factory=Conditions)
    history: list[Message] = Field(default_factory=list, max_length=16)

    @field_validator("message")
    @classmethod
    def no_sensitive_numbers(cls, value):
        return Message.no_sensitive_numbers(value)


class Interpretation(StrictModel):
    intent: Literal["search_trips", "clarify", "list_orders", "faq", "select_trip", "unsupported"]
    conditions: Conditions
    reply: str = Field(default="", max_length=400)
    faq: Literal["passenger", "luggage", "arrival", "payment"] | None = None
    selection: int | None = Field(default=None, ge=1, le=6, strict=True)


class ChatResponse(Interpretation):
    mode: Literal["live"] = "live"
