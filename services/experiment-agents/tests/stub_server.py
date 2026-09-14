"""Local integration fixture. Never use as a production entry point.

Run: uv run python tests/stub_server.py
Only predefined analytics responses are returned; no model or credentials used.
"""

import json
from pathlib import Path
import uvicorn
from experiment_agents.app import create_app
from experiment_agents.config import Settings
from experiment_agents.works.ai_solution_lab.workflow import run_stage

base = json.loads((Path(__file__).parent / "fixtures/contracts.json").read_text())[0][
    "value"
]


async def model_substitute(_settings, stage, _context, _schema, _repair):
    return json.dumps(
        base[{"analyze": "brief", "diagnose": "diagnosis", "plan": "prototype"}[stage]]
    )


async def runner(payload, settings):
    return await run_stage(payload, settings, model_substitute)


if __name__ == "__main__":
    settings = Settings(
        "local-test-only", "http://unused.invalid", "no-real-key", "fixture"
    )
    uvicorn.run(
        create_app(settings, runner), host="127.0.0.1", port=8002, access_log=False
    )
