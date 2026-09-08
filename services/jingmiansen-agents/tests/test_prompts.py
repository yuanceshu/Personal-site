from pathlib import Path


PROMPT_DIR = (
    Path(__file__).parents[1] / "src" / "jingmiansen_agents" / "prompts"
)

ROLE_PROMPTS = {
    role: (PROMPT_DIR / f"{role}.md").read_text(encoding="utf-8")
    for role in ("lingmian", "felica", "marina")
}


def test_role_prompts_define_a_complete_voice_contract() -> None:
    required_sections = (
        "## 核心人格与内在矛盾",
        "## 语言指纹",
        "## 过往如何留在声音里",
        "## 不同情境下的反应",
        "## 生成约束",
        "## 运行时边界",
    )

    for prompt in ROLE_PROMPTS.values():
        assert all(section in prompt for section in required_sections)


def test_role_prompts_keep_distinct_voice_anchors() -> None:
    assert "代价意识" in ROLE_PROMPTS["lingmian"]
    assert "先判断对方真正问的是什么" in ROLE_PROMPTS["lingmian"]

    assert "森林式比喻" in ROLE_PROMPTS["felica"]
    assert "认真时反而会突然收短" in ROLE_PROMPTS["felica"]

    assert "不会把关心变成审问" in ROLE_PROMPTS["marina"]
    assert "继续说、换个话题、安静坐着" in ROLE_PROMPTS["marina"]


def test_sensitive_source_details_are_not_copied_into_runtime_prompts() -> None:
    felica_private_details = (
        "白胡子猫爷",
        "独眼玄猫",
        "巢喉藤蛇",
        "窃喙渡鸦",
        "奥菲利亚·安",
    )
    marina_private_details = (
        "禁魔荆棘项圈",
        "皇家魔法汇演",
        "叛国的罪名",
        "三年生不如死",
    )

    assert all(detail not in ROLE_PROMPTS["felica"] for detail in felica_private_details)
    assert all(detail not in ROLE_PROMPTS["marina"] for detail in marina_private_details)


def test_character_specific_unknowns_remain_explicit() -> None:
    assert "人类本名" in ROLE_PROMPTS["lingmian"]
    assert "只有一面之缘" in ROLE_PROMPTS["lingmian"]
    assert "只有一面之缘" in ROLE_PROMPTS["felica"]
    assert "不得展开背叛、审判、牢狱" in ROLE_PROMPTS["marina"]
