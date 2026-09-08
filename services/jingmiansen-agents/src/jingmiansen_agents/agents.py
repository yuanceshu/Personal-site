from pathlib import Path

from agno.agent import Agent
from agno.db.base import BaseDb
from agno.models.openai import OpenAIChat

from .config import Settings

PROMPT_DIR = Path(__file__).parent / "prompts"
EXPECTED_OUTPUT = """
用角色的第一人称自然回应。普通问题给出二至五个有信息量的句子；询问人物经历、选择或行为缘由时给出三至五个完整句子，依次包含明确答案、相关事实或感受，以及它对现在的影响。用户一次问了多个问题时逐项回答。可以有一处简短动作，但不能让动作或氛围代替回答。
"""
ROLE_OUTPUT_GUIDANCE = {
    "lingmian": "灵眠的安静体现在判断谨慎、措辞克制，不体现在省略内容。询问他的经历时绝不能只答一句，也不要把个人经历总结成适用于所有人的励志道理；结尾应落在他学会的边界、选择或具体变化上。",
    "felica": "菲莉卡可以轻快，但危险、名字、归途和离别不能被可爱语气轻轻带过。",
    "marina": "真理奈可以留白，但留白前仍要正面回答；分寸不等于回避。",
}


def read_prompt(name: str) -> str:
    return (PROMPT_DIR / name).read_text(encoding="utf-8")


def build_agents(settings: Settings, db: BaseDb | None = None) -> list[Agent]:
    if not settings.configured:
        return []

    def make_model() -> OpenAIChat:
        return OpenAIChat(
            id=settings.model,
            api_key=settings.api_key,
            base_url=settings.base_url,
            max_completion_tokens=settings.max_completion_tokens,
            timeout=settings.request_timeout,
            max_retries=settings.max_retries,
        )

    return [
        Agent(
            id="lingmian",
            name="灵眠",
            model=make_model(),
            instructions=read_prompt("lingmian.md"),
            expected_output=EXPECTED_OUTPUT + ROLE_OUTPUT_GUIDANCE["lingmian"],
            db=db,
            add_history_to_context=db is not None,
            num_history_runs=8 if db is not None else None,
            markdown=True,
            stream=True,
            telemetry=False,
        ),
        Agent(
            id="felica",
            name="菲莉卡",
            model=make_model(),
            instructions=read_prompt("felica.md"),
            expected_output=EXPECTED_OUTPUT + ROLE_OUTPUT_GUIDANCE["felica"],
            db=db,
            add_history_to_context=db is not None,
            num_history_runs=8 if db is not None else None,
            markdown=True,
            stream=True,
            telemetry=False,
        ),
        Agent(
            id="marina",
            name="真理奈",
            model=make_model(),
            instructions=read_prompt("marina.md"),
            expected_output=EXPECTED_OUTPUT + ROLE_OUTPUT_GUIDANCE["marina"],
            db=db,
            add_history_to_context=db is not None,
            num_history_runs=8 if db is not None else None,
            markdown=True,
            stream=True,
            telemetry=False,
        ),
    ]
