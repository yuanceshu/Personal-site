import asyncio
import contextlib
import secrets
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.responses import StreamingResponse
from fastapi.exceptions import RequestValidationError
from .config import Settings
from .works.ai_solution_lab.schemas import LabRequest, LabResponse
from .works.ai_solution_lab.workflow import WorkflowError, run_stage
from .works.island_travel.schemas import ChatRequest, ChatResponse
from .works.island_travel.workflow import TravelError, interpret
from .works.restaurant_ai.schemas import ChatRequest as RestaurantChatRequest
from .works.restaurant_ai.workflow import stream_chat as restaurant_stream_chat
from .works.linquan.schemas import ChatRequest as LinquanChatRequest, ChatResponse as LinquanChatResponse
from .works.linquan.workflow import LinquanError, explain as linquan_explain
from .works.qintai_ticketing.schemas import ChatRequest as QintaiChatRequest
from .works.qintai_ticketing.workflow import stream_chat as qintai_stream_chat
from .works.medical_ai.schemas import ChatRequest as MedicalChatRequest, ChatResponse as MedicalChatResponse
from .works.medical_ai.workflow import MedicalError, explain as medical_explain
from .works.finance_assistant.schemas import ChatRequest as FinanceChatRequest, ChatResponse as FinanceChatResponse
from .works.finance_assistant.workflow import run_chat as finance_run_chat


async def until_disconnect(request: Request):
    while True:
        message = await request.receive()
        if message["type"] == "http.disconnect":
            return


async def run_connected(request: Request, work):
    task = asyncio.create_task(work)
    disconnected = asyncio.create_task(until_disconnect(request))
    try:
        done, _ = await asyncio.wait(
            {task, disconnected}, return_when=asyncio.FIRST_COMPLETED
        )
        if disconnected in done:
            raise WorkflowError(499, "cancelled")
        return await task
    finally:
        for pending in (task, disconnected):
            if not pending.done():
                pending.cancel()
        for pending in (task, disconnected):
            with contextlib.suppress(asyncio.CancelledError):
                await pending


class RequestBoundary:
    """Pure ASGI boundary keeps disconnect delivery intact during model calls."""

    def __init__(self, app, token: str):
        self.app, self.token = app, token

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["path"] == "/healthz":
            return await self.app(scope, receive, send)

        async def reject(status, code):
            await JSONResponse(
                {"error": code},
                status_code=status,
                headers={"Cache-Control": "no-store"},
            )(scope, receive, send)

        if scope["path"] not in {
            "/works/ai-solution-lab/generate",
            "/works/island-travel/chat",
            "/works/restaurant-ai/chat",
            "/works/restaurant-ai/status",
            "/works/linquan/chat",
            "/works/qintai-ticketing/chat",
            "/works/qintai-ticketing/merchant",
            "/works/qintai-ticketing/status",
            "/works/medical-ai/chat",
            "/works/finance-assistant/chat",
        }:
            return await reject(404, "not_found")
        headers = dict(scope["headers"])
        if not self.token or not secrets.compare_digest(
            headers.get(b"authorization", b""), f"Bearer {self.token}".encode()
        ):
            return await reject(401, "unauthorized")
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body.extend(message.get("body", b""))
            if len(body) > 32768:
                return await reject(413, "input_too_large")
            if not message.get("more_body", False):
                break
        delivered = False

        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        async def no_cache(message):
            if message["type"] == "http.response.start":
                message["headers"] = [
                    *message.get("headers", []),
                    (b"cache-control", b"no-store"),
                ]
            await send(message)

        await self.app(scope, replay, no_cache)


def create_app(settings: Settings | None = None, runner=run_stage, travel_runner=interpret):
    settings = settings or Settings.from_env()
    app = FastAPI(title="实验作品接口", docs_url=None, redoc_url=None, openapi_url=None)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(_request, _error):
        return JSONResponse({"error": "invalid_request"}, status_code=422)

    app.add_middleware(RequestBoundary, token=settings.token)

    @app.get("/healthz")
    async def health():
        return {"status": "ok"}

    @app.post("/works/ai-solution-lab/generate", response_model=LabResponse)
    async def generate(payload: LabRequest, request: Request):
        try:
            async with asyncio.timeout(65):
                return await run_connected(request, runner(payload, settings))
        except TimeoutError:
            return JSONResponse({"error": "generation_timeout"}, status_code=504)
        except WorkflowError as error:
            return JSONResponse({"error": error.code}, status_code=error.status)
        except Exception:
            return JSONResponse({"error": "generation_failed"}, status_code=502)

    @app.post("/works/island-travel/chat", response_model=ChatResponse)
    async def travel_chat(payload: ChatRequest, request: Request):
        try:
            async with asyncio.timeout(48):
                return await run_connected(request, travel_runner(payload, settings))
        except TimeoutError:
            return JSONResponse({"error": "timeout"}, status_code=504)
        except (TravelError, WorkflowError) as error:
            return JSONResponse({"error": error.code}, status_code=error.status)
        except Exception:
            return JSONResponse({"error": "interpretation_failed"}, status_code=502)

    @app.post("/works/restaurant-ai/chat")
    async def restaurant_chat(payload: RestaurantChatRequest):
        if not settings.configured:
            return JSONResponse({"error": "model_unavailable"}, status_code=503)
        return StreamingResponse(
            restaurant_stream_chat(payload, settings),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
        )

    @app.get("/works/restaurant-ai/status")
    async def restaurant_status():
        return {"live": settings.configured}

    @app.post("/works/linquan/chat", response_model=LinquanChatResponse)
    async def linquan_chat(payload: LinquanChatRequest, request: Request):
        try:
            async with asyncio.timeout(17):
                return await run_connected(request, linquan_explain(payload, settings))
        except TimeoutError:
            return JSONResponse({"error": "timeout"}, status_code=504)
        except (LinquanError, WorkflowError) as error:
            return JSONResponse({"error": error.code}, status_code=error.status)
        except Exception:
            return JSONResponse({"error": "explanation_failed"}, status_code=502)

    # 琴台票务：顾客侧与运营侧共用同一个 Agno 工具 Agent + SSE，只经主站代理调用。
    async def qintai_response(payload: QintaiChatRequest):
        if not settings.configured:
            return JSONResponse({"error": "model_unavailable"}, status_code=503)
        return StreamingResponse(
            qintai_stream_chat(payload, settings),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
        )

    @app.post("/works/qintai-ticketing/chat")
    async def qintai_chat(payload: QintaiChatRequest):
        if payload.role != "customer":
            return JSONResponse({"error": "invalid_request"}, status_code=422)
        return await qintai_response(payload)

    @app.post("/works/qintai-ticketing/merchant")
    async def qintai_merchant(payload: QintaiChatRequest):
        if payload.role != "merchant":
            return JSONResponse({"error": "invalid_request"}, status_code=422)
        return await qintai_response(payload)

    @app.get("/works/qintai-ticketing/status")
    async def qintai_status():
        return {"live": settings.configured}

    @app.post("/works/medical-ai/chat", response_model=MedicalChatResponse)
    async def medical_chat(payload: MedicalChatRequest, request: Request):
        try:
            async with asyncio.timeout(17):
                return await run_connected(request, medical_explain(payload, settings))
        except TimeoutError:
            return JSONResponse({"error": "timeout"}, status_code=504)
        except (MedicalError, WorkflowError) as error:
            return JSONResponse({"error": error.code}, status_code=error.status)
        except Exception:
            return JSONResponse({"error": "explanation_failed"}, status_code=502)

    @app.post("/works/finance-assistant/chat", response_model=FinanceChatResponse)
    async def finance_chat(payload: FinanceChatRequest, request: Request):
        tool_url = request.headers.get("x-finance-tool-url")
        tool_token = request.headers.get("x-finance-tool-token")
        if not tool_url or not tool_token:
            return JSONResponse({"error": "tool_unavailable"}, status_code=503)
        try:
            async with asyncio.timeout(58):
                return await run_connected(request, finance_run_chat(payload, settings, tool_url, tool_token))
        except TimeoutError:
            return JSONResponse({"error": "timeout"}, status_code=504)
        except WorkflowError as error:
            return JSONResponse({"error": error.code}, status_code=error.status)
        except RuntimeError as error:
            if str(error) == "model_unavailable":
                return JSONResponse({"error": "model_unavailable"}, status_code=503)
            return JSONResponse({"error": "finance_agent_failed"}, status_code=502)
        except Exception:
            return JSONResponse({"error": "finance_agent_failed"}, status_code=502)

    return app


app = create_app()
