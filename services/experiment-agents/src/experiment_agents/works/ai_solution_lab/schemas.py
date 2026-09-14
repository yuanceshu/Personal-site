"""Authoritative wire models. Semantic rules live in domain.py, not JSON schema."""

from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, TypeAdapter

Text = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=600)
]
Title = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)
]
Identifier = Annotated[str, StringConstraints(pattern=r"^[a-z][a-z0-9-]{0,48}$")]
Scenario = Literal["analytics", "retail", "marketing", "unsupported"]
CapabilityId = Literal[
    "monitoring_dashboard",
    "data_analysis",
    "data_query",
    "recommendation",
    "guided_service",
    "content_generation",
]
DataRef = Literal[
    "healthcare_metrics",
    "retail_metrics",
    "generic_metrics",
    "retail_catalog",
    "campaign_samples",
]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Clarification(StrictModel):
    question: Text
    answer: Annotated[str, StringConstraints(max_length=300)]


class Brief(StrictModel):
    scenario: Scenario
    industry: Literal["healthcare", "retail", "general"]
    aiPreference: Literal["allowed", "none", "undecided"]
    title: Title
    users: Text
    problem: Text
    goal: Text
    conditions: Annotated[str, StringConstraints(max_length=1200)]
    assumptions: list[Text] = Field(max_length=6)
    questions: list[Text] = Field(max_length=2)
    clarifications: list[Clarification] = Field(max_length=2)
    limitation: Annotated[str, StringConstraints(max_length=600)]


class Capability(StrictModel):
    id: CapabilityId
    approach: Literal["hybrid", "software"]
    reason: Text
    prerequisite: Text


class Diagnosis(StrictModel):
    summary: Text
    capabilities: list[Capability] = Field(min_length=1, max_length=5)
    risks: list[Text] = Field(min_length=1, max_length=5)


class Component(StrictModel):
    id: Identifier
    type: Literal[
        "Metrics",
        "Trend",
        "Records",
        "Insight",
        "Query",
        "Recommendations",
        "BriefForm",
        "Document",
    ]
    title: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)
    ]
    capability: CapabilityId
    dataRef: DataRef


class Section(StrictModel):
    slot: Literal["overview", "main", "assistance", "input", "output"]
    components: list[Component] = Field(min_length=1, max_length=8)


class Page(StrictModel):
    id: Identifier
    title: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)
    ]
    template: Literal["analytics_workspace", "guided_service", "ai_workspace"]
    sections: list[Section] = Field(min_length=1, max_length=5)


class Prototype(StrictModel):
    appTitle: Title
    pages: list[Page] = Field(min_length=1, max_length=3)


class AnalyzeRequest(StrictModel):
    stage: Literal["analyze"]
    input: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=10, max_length=3000)
    ]


class DiagnoseRequest(StrictModel):
    stage: Literal["diagnose"]
    brief: Brief
    selectedCapabilities: list[CapabilityId] = Field(max_length=5)


class PlanRequest(StrictModel):
    stage: Literal["plan"]
    brief: Brief
    diagnosis: Diagnosis


LabRequest = Annotated[
    AnalyzeRequest | DiagnoseRequest | PlanRequest, Field(discriminator="stage")
]
request_adapter = TypeAdapter(LabRequest)


class AnalyzeResponse(StrictModel):
    stage: Literal["analyze"]
    mode: Literal["live"]
    data: Brief


class DiagnoseResponse(StrictModel):
    stage: Literal["diagnose"]
    mode: Literal["live"]
    data: Diagnosis


class PlanResponse(StrictModel):
    stage: Literal["plan"]
    mode: Literal["live", "fallback"]
    data: Prototype


LabResponse = Annotated[
    AnalyzeResponse | DiagnoseResponse | PlanResponse, Field(discriminator="stage")
]
