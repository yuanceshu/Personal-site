import asyncio
import contextlib
import secrets
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from .config import Settings
from .works.ai_solution_lab.schemas import LabRequest, LabResponse
from .works.ai_solution_lab.workflow import WorkflowError, run_stage
from .works.island_travel.schemas import ChatRequest, ChatResponse
from .works.island_travel.workflow import TravelError, interpret


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

        if scope["path"] not in {"/works/ai-solution-lab/generate", "/works/island-travel/chat"}:
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

    return app


app = create_app()
