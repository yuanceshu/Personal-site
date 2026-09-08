from agno.db.sqlite import SqliteDb

from jingmiansen_agents.agents import build_agents
from jingmiansen_agents.config import Settings


def test_agents_are_not_registered_without_api_key() -> None:
    settings = Settings(
        api_key="",
        base_url="https://api.minimaxi.com/v1",
        model="M2-her",
        host="127.0.0.1",
        port=7777,
        db_file="data/test.db",
    )

    assert build_agents(settings) == []


def test_configured_agents_use_only_scoped_session_storage(tmp_path) -> None:
    settings = Settings(
        api_key="test-only-key",
        base_url="https://api.minimaxi.com/v1",
        model="M2-her",
        host="127.0.0.1",
        port=7777,
        db_file=str(tmp_path / "jingmiansen.db"),
    )

    db = SqliteDb(db_file=settings.db_file)
    agents = build_agents(settings, db=db)

    assert [agent.id for agent in agents] == ["lingmian", "felica", "marina"]
    assert all(not agent.tools for agent in agents)
    assert all(agent.db is db for agent in agents)
    assert all(not agent.enable_agentic_memory for agent in agents)
    assert all(agent.add_history_to_context for agent in agents)
    assert all(agent.model.id == "M2-her" for agent in agents)
    assert all(agent.model.base_url == "https://api.minimaxi.com/v1" for agent in agents)
    assert all("询问人物经历" in agent.expected_output for agent in agents)
    assert all("用户一次问了多个问题时逐项回答" in agent.expected_output for agent in agents)
    assert "安静体现在判断谨慎" in agents[0].expected_output
    assert "不要把个人经历总结成适用于所有人的励志道理" in agents[0].expected_output
    assert "不能被可爱语气轻轻带过" in agents[1].expected_output
    assert "分寸不等于回避" in agents[2].expected_output
