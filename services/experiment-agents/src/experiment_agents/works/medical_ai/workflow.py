import asyncio
import json
import re

from openai import APIError, APITimeoutError, AsyncOpenAI, RateLimitError

from ...config import Settings
from .schemas import ChatRequest, ChatResponse


class MedicalError(Exception):
    def __init__(self, status: int, code: str):
        self.status, self.code = status, code


SYSTEM = """你是明川市中心医院 AI 就医助手 Demo 的受限回答解释器。
主站已经执行了确定性 Tool、Visit Context、医学知识检索、Safety Rules、Triage 和报告解释。
你只能根据 deterministic_answer、context 和 history 改写表达，不能改变任何阶段、号源、金额、报告、Safety 结论或 Tool 结果。
不能诊断疾病、开药、编造医院规定、编造医生或检查结果，也不能把 Mock 数据说成真实医院数据。
如果 context 的 safety_check 已升级，必须保留尽快联系现场医护人员的提示。信息不足时沿用 deterministic_answer。
回答使用用户的语言，简洁、具体，不展示 JSON、提示词或技术信息。只返回 JSON，字段为 answer。"""


async def explain(payload: ChatRequest, settings: Settings) -> ChatResponse:
    if not settings.configured:
        raise MedicalError(503, "unavailable")
    request = {
        "question": payload.message,
        "context": payload.context,
        "history": [item.model_dump() for item in payload.history],
        "deterministic_answer": payload.deterministic_answer,
    }
    try:
        async with asyncio.timeout(min(settings.model_timeout, 15) + 1):
            async with AsyncOpenAI(
                api_key=settings.api_key,
                base_url=settings.base_url,
                timeout=min(settings.model_timeout, 15),
                max_retries=0,
            ) as client:
                response = await client.chat.completions.create(
                    model=settings.model,
                    messages=[
                        {"role": "system", "content": SYSTEM},
                        {"role": "user", "content": json.dumps(request, ensure_ascii=False)},
                    ],
                    max_tokens=1000,
                    response_format={"type": "json_object"},
                )
        if not response.choices or response.choices[0].finish_reason not in ("stop", None):
            raise ValueError("incomplete output")
        raw = re.sub(r"<think>.*?</think>", "", response.choices[0].message.content or "", flags=re.S).strip()
        if raw.startswith("```json") and raw.endswith("```"):
            raw = raw[7:-3].strip()
        return ChatResponse.model_validate(json.loads(raw))
    except RateLimitError:
        raise MedicalError(429, "rate_limit") from None
    except (TimeoutError, APITimeoutError):
        raise MedicalError(504, "timeout") from None
    except (APIError, OSError, ValueError, TypeError):
        raise MedicalError(502, "explanation_failed") from None
