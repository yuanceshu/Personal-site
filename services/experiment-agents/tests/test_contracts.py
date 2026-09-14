import json
from pathlib import Path
import pytest
from pydantic import ValidationError
from experiment_agents.works.ai_solution_lab.schemas import (
    Brief,
    Diagnosis,
    Prototype,
    request_adapter,
)
from experiment_agents.works.ai_solution_lab.domain import validate_prototype

CASES = json.loads((Path(__file__).parent / "fixtures/contracts.json").read_text())


@pytest.mark.parametrize("case", CASES, ids=lambda c: c["name"])
def test_shared_contract(case):
    try:
        v = case["value"]
        if case["kind"] == "brief":
            Brief.model_validate(v)
        elif case["kind"] == "request":
            request_adapter.validate_python(v)
        else:
            validate_prototype(
                Brief.model_validate(v["brief"]),
                Diagnosis.model_validate(v["diagnosis"]),
                Prototype.model_validate(v["prototype"]),
            )
        valid = True
    except (ValueError, ValidationError):
        valid = False
    assert valid == case["valid"]
