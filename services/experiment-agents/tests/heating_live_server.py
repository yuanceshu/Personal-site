"""Opt-in local integration server; diagnostics contain only event/type names."""
import os
import sys
import time
import uvicorn
from agno.models.openai import OpenAIChat
from experiment_agents.works.heating import workflow

original_build = workflow.build_agent
original_parse = OpenAIChat._parse_provider_response_delta


def parse(self, chunk):
    for choice in chunk.choices or []:
        if choice.finish_reason in {"stop", "tool_calls", "length", "content_filter"}:
            print("HEATING_DIAGNOSTIC provider_finish", choice.finish_reason, flush=True)
    return original_parse(self, chunk)


def build(settings, proxy):
    agent = original_build(settings, proxy)
    class ObservedAgent:
        async def arun(self, *args, **kwargs):
            started = time.monotonic()
            try:
                async for event in agent.arun(*args, **kwargs):
                    kind = getattr(event, "event", "")
                    if str(kind) in {"RunCompleted", "RunError"}:
                        print("HEATING_DIAGNOSTIC", kind, type(getattr(event, "content", None)).__name__,
                              "elapsed_s", round(time.monotonic() - started, 2), "tools", len(proxy.calls),
                              "reply", proxy.reply_mode is not None, "proposal", proxy.proposal is not None,
                              "error_type", getattr(event, "error_type", None), flush=True)
                    yield event
            except Exception as error:
                print("HEATING_DIAGNOSTIC", type(error).__name__, flush=True)
                raise
    return ObservedAgent()


if os.environ.get("HEATING_LIVE_MODEL") != "1":
    raise SystemExit("Explicit live-model opt-in required")
workflow.build_agent = build
OpenAIChat._parse_provider_response_delta = parse
uvicorn.run("experiment_agents.app:app", host="127.0.0.1", port=int(sys.argv[1]), access_log=False, log_level="error")
