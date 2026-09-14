"""Deterministic semantic checks, separate from wire schemas."""

from .schemas import Brief, Diagnosis, Prototype

CAPABILITIES = {
    "monitoring_dashboard": {
        "name": "经营指标展示",
        "scenario": "analytics",
        "default": "software",
    },
    "data_analysis": {
        "name": "趋势与异常分析",
        "scenario": "analytics",
        "default": "hybrid",
    },
    "data_query": {
        "name": "自然语言问数",
        "scenario": "analytics",
        "default": "hybrid",
    },
    "recommendation": {
        "name": "偏好筛选与推荐",
        "scenario": "retail",
        "default": "hybrid",
    },
    "guided_service": {
        "name": "店铺信息与到店指引",
        "scenario": "retail",
        "default": "software",
    },
    "content_generation": {
        "name": "营销活动草稿",
        "scenario": "marketing",
        "default": "hybrid",
    },
}
TEMPLATE_SLOTS = {
    "analytics_workspace": {
        "overview": ["Metrics"],
        "main": ["Trend", "Records"],
        "assistance": ["Insight", "Query"],
    },
    "guided_service": {"main": ["Recommendations"], "assistance": ["Insight"]},
    "ai_workspace": {"input": ["BriefForm"], "output": ["Document", "Insight"]},
}
COMPONENT_CAPABILITIES = {
    "Metrics": ["monitoring_dashboard"],
    "Trend": ["monitoring_dashboard", "data_analysis"],
    "Records": ["monitoring_dashboard", "data_analysis"],
    "Insight": ["data_analysis", "recommendation", "content_generation"],
    "Query": ["data_query"],
    "Recommendations": ["recommendation", "guided_service"],
    "BriefForm": ["content_generation"],
    "Document": ["content_generation"],
}
TEMPLATES = {
    "analytics": "analytics_workspace",
    "retail": "guided_service",
    "marketing": "ai_workspace",
}


def dataset_for(brief: Brief) -> str:
    if brief.scenario == "analytics":
        return {
            "healthcare": "healthcare_metrics",
            "retail": "retail_metrics",
            "general": "generic_metrics",
        }[brief.industry]
    return "retail_catalog" if brief.scenario == "retail" else "campaign_samples"


def validate_diagnosis(
    brief: Brief, diagnosis: Diagnosis, selected: list[str] | None = None
) -> Diagnosis:
    ids = [c.id for c in diagnosis.capabilities]
    if brief.scenario == "unsupported" or len(set(ids)) != len(ids):
        raise ValueError("unsupported or repeated capabilities")
    if selected and (len(set(selected)) != len(selected) or set(ids) != set(selected)):
        raise ValueError("selected capabilities must be honored")
    for c in diagnosis.capabilities:
        if CAPABILITIES[c.id]["scenario"] != brief.scenario:
            raise ValueError("capability scenario mismatch")
        if brief.aiPreference == "none" and c.approach != "software":
            raise ValueError("AI explicitly disabled")
        if (
            c.id in ("monitoring_dashboard", "guided_service")
            and c.approach != "software"
        ):
            raise ValueError("deterministic responsibility")
        if c.id == "data_query" and c.approach != "hybrid":
            raise ValueError("omit natural language query if AI disabled")
    return diagnosis


def validate_prototype(
    brief: Brief, diagnosis: Diagnosis, spec: Prototype
) -> Prototype:
    validate_diagnosis(brief, diagnosis)
    selected = {c.id: c for c in diagnosis.capabilities}
    ids, covered, types = set(), set(), set()
    for page in spec.pages:
        if page.template != TEMPLATES[brief.scenario]:
            raise ValueError("template mismatch")
        elements = [c for section in page.sections for c in section.components]
        if len(elements) > 8 or len({s.slot for s in page.sections}) != len(
            page.sections
        ):
            raise ValueError("too many modules or repeated slots")
        for item in [page, *elements]:
            if item.id in ids:
                raise ValueError("repeated ID")
            ids.add(item.id)
        for section in page.sections:
            for c in section.components:
                if (
                    c.type not in TEMPLATE_SLOTS[page.template].get(section.slot, [])
                    or c.capability not in selected
                    or c.capability not in COMPONENT_CAPABILITIES[c.type]
                ):
                    raise ValueError("invalid component mapping")
                if c.dataRef != dataset_for(brief):
                    raise ValueError("dataset mismatch")
                if (
                    c.type in ("Insight", "Query")
                    and selected[c.capability].approach != "hybrid"
                ):
                    raise ValueError("AI-only module in software plan")
                covered.add(c.capability)
                types.add(c.type)
    if covered != set(selected):
        raise ValueError("missing capability")
    if brief.scenario == "marketing" and not {"BriefForm", "Document"} <= types:
        raise ValueError("missing campaign input or result")
    if brief.scenario == "retail" and "Recommendations" not in types:
        raise ValueError("missing retail flow")
    return spec


def build_prototype(brief: Brief, diagnosis: Diagnosis) -> Prototype:
    validate_diagnosis(brief, diagnosis)
    sections: dict[str, list[dict]] = {}

    def add(slot, kind, title, capability):
        sections.setdefault(slot, []).append(
            {
                "id": f"{capability.replace('_', '-')}-{kind.lower()}",
                "type": kind,
                "title": title,
                "capability": capability,
                "dataRef": dataset_for(brief),
            }
        )

    for c in diagnosis.capabilities:
        if c.id == "monitoring_dashboard":
            add("overview", "Metrics", "关键指标", c.id)
            if not any(item.id == "data_analysis" for item in diagnosis.capabilities):
                add("main", "Trend", "指标趋势", c.id)
            add("main", "Records", "每日明细", c.id)
        elif c.id == "data_analysis":
            add("main", "Trend", "变化观察", c.id)
            if c.approach == "hybrid":
                add("assistance", "Insight", "异常观察与解释", c.id)
        elif c.id == "data_query":
            add("assistance", "Query", "问一问数据", c.id)
        elif c.id in ("recommendation", "guided_service"):
            add("main", "Recommendations", CAPABILITIES[c.id]["name"], c.id)
        elif c.id == "content_generation":
            add("input", "BriefForm", "活动输入", c.id)
            add("output", "Document", "方案草稿", c.id)
    spec = Prototype.model_validate(
        {
            "appTitle": brief.title,
            "pages": [
                {
                    "id": "overview",
                    "title": "产品草稿",
                    "template": TEMPLATES[brief.scenario],
                    "sections": [
                        {"slot": s, "components": c} for s, c in sections.items()
                    ],
                }
            ],
        }
    )
    return validate_prototype(brief, diagnosis, spec)
