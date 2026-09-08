from secrets import compare_digest

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from agno.os import AgentOS
from pydantic import BaseModel, Field

from .agents import build_agents
from .config import load_settings, validate_production_settings
from .storage import build_database, cleanup_inactive_sessions, delete_anonymous_session

settings = load_settings()
validate_production_settings(settings)
db = build_database(settings)
agent_os: AgentOS | None = None
agents = build_agents(settings, db=db)

base_app = FastAPI(title="静眠森角色智能体")


class SessionDeleteRequest(BaseModel):
    agentId: str = Field(pattern="^(lingmian|felica|marina)$")
    visitorId: str = Field(pattern="^[a-zA-Z0-9_-]{8,80}$")
    sessionId: str = Field(pattern="^[a-zA-Z0-9_-]{8,80}$")


def has_bearer_token(request: Request, expected: str) -> bool:
    authorization = request.headers.get("authorization", "")
    prefix = "Bearer "
    if not expected or not authorization.startswith(prefix):
        return False
    return compare_digest(authorization[len(prefix) :], expected)


@base_app.middleware("http")
async def protect_agent_os(request: Request, call_next):
    if request.url.path in {"/healthz", "/internal/cleanup"}:
        return await call_next(request)

    if settings.agent_token and not has_bearer_token(request, settings.agent_token):
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    return await call_next(request)


@base_app.get("/healthz", include_in_schema=False)
def health() -> dict[str, str]:
    return {"status": "ok"}


@base_app.delete("/internal/sessions", include_in_schema=False)
def delete_session(payload: SessionDeleteRequest) -> dict[str, bool]:
    deleted = delete_anonymous_session(
        db,
        agent_id=payload.agentId,
        visitor_id=payload.visitorId,
        session_id=payload.sessionId,
    )
    return {"deleted": deleted}


@base_app.get("/internal/cleanup", include_in_schema=False)
def cleanup_sessions(request: Request):
    if not has_bearer_token(request, settings.cron_secret):
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    return {"deleted": cleanup_inactive_sessions(db)}


if settings.configured:
    agent_os = AgentOS(
        id="jingmiansen-agents",
        name="静眠森角色智能体",
        agents=agents,
        base_app=base_app,
        tracing=False,
    )
    app = agent_os.get_app()
else:
    app = base_app


if __name__ == "__main__":
    if agent_os is not None:
        agent_os.serve(app=app, host=settings.host, port=settings.port)
    else:
        import uvicorn

        uvicorn.run(app, host=settings.host, port=settings.port)
