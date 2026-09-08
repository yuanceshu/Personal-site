import { NextResponse } from "next/server";

const allowedAgentIds = new Set(["lingmian", "felica", "marina"]);
const anonymousIdPattern = /^[a-zA-Z0-9_-]{8,80}$/;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ChatRequest = {
  agentId?: unknown;
  message?: unknown;
  visitorId?: unknown;
  sessionId?: unknown;
};

type DeleteRequest = Omit<ChatRequest, "message">;

function getAgentConfig() {
  return {
    url: (
      process.env.JINGMIANSEN_AGENT_URL ?? "http://127.0.0.1:7777"
    ).replace(/\/$/, ""),
    token: process.env.JINGMIANSEN_AGENT_TOKEN?.trim() ?? "",
  };
}

function authorizationHeaders(token: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function POST(request: Request) {
  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  const agentId = typeof body.agentId === "string" ? body.agentId : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const visitorId = typeof body.visitorId === "string" ? body.visitorId : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";

  if (!allowedAgentIds.has(agentId)) {
    return NextResponse.json({ error: "角色不存在。" }, { status: 400 });
  }

  if (!message || message.length > 1200) {
    return NextResponse.json(
      { error: "请输入 1—1200 字以内的内容。" },
      { status: 400 },
    );
  }

  if (
    !anonymousIdPattern.test(visitorId) ||
    !anonymousIdPattern.test(sessionId)
  ) {
    return NextResponse.json({ error: "匿名标识不正确。" }, { status: 400 });
  }

  const agent = getAgentConfig();
  const form = new URLSearchParams({
    message,
    stream: "true",
    session_id: `${agentId}-${sessionId}`,
    user_id: `anonymous:${visitorId}`,
  });

  try {
    const upstream = await fetch(`${agent.url}/agents/${agentId}/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...authorizationHeaders(agent.token),
      },
      body: form,
      cache: "no-store",
      signal: request.signal,
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: "角色暂时没有回应，请稍后再试。" },
        { status: 503 },
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type":
          upstream.headers.get("content-type") ?? "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "角色服务暂时不可用，请稍后再试。" },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request) {
  let body: DeleteRequest;
  try {
    body = (await request.json()) as DeleteRequest;
  } catch {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  const agentId = typeof body.agentId === "string" ? body.agentId : "";
  const visitorId = typeof body.visitorId === "string" ? body.visitorId : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";

  if (
    !allowedAgentIds.has(agentId) ||
    !anonymousIdPattern.test(visitorId) ||
    !anonymousIdPattern.test(sessionId)
  ) {
    return NextResponse.json({ error: "会话标识不正确。" }, { status: 400 });
  }

  const agent = getAgentConfig();

  try {
    const upstream = await fetch(`${agent.url}/internal/sessions`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...authorizationHeaders(agent.token),
      },
      body: JSON.stringify({ agentId, visitorId, sessionId }),
      cache: "no-store",
      signal: request.signal,
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: "旧会话暂时无法清理。" },
        { status: 503 },
      );
    }

    return new Response(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: "旧会话暂时无法清理。" },
      { status: 503 },
    );
  }
}
