"""Opt-in local integration server; diagnostics contain only event/type names."""
import os
import sys
import uvicorn
from experiment_agents.works.heating import workflow

original_build = workflow.build_agent


def build(settings, proxy):
    agent = original_build(settings, proxy)
    class ObservedAgent:
        async def arun(self, *args, **kwargs):
            try:
                async for event in agent.arun(*args, **kwargs):
                    kind = getattr(event, "event", "")
                    if str(kind) in {"RunCompleted", "RunError"}:
                        print("HEATING_DIAGNOSTIC", kind, type(getattr(event, "content", None)).__name__, flush=True)
                    yield event
            except Exception as error:
                print("HEATING_DIAGNOSTIC", type(error).__name__, flush=True)
                raise
    return ObservedAgent()


if os.environ.get("HEATING_LIVE_MODEL") != "1":
    raise SystemExit("Explicit live-model opt-in required")
workflow.build_agent = build
uvicorn.run("experiment_agents.app:app", host="127.0.0.1", port=int(sys.argv[1]), access_log=False, log_level="error")
