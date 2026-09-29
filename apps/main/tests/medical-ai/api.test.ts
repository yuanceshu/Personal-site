import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../../app/api/experiments/medical-ai/chat/route";

type ApiPayload = {
  message: string;
  visit_context: { current_stage: string };
  tool_calls: Array<{ name: string }>;
  state: { mock: { visitContext: { appointment_time: string | null } } };
};

async function call(body: unknown) {
  const request = new Request("http://localhost/api/experiments/medical-ai/chat", {
    method: "POST",
    headers: { origin: "http://localhost", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const response = await POST(request);
  assert.equal(response.status, 200);
  return response.json() as Promise<ApiPayload>;
}

test("API 在无服务端持久化时仍能通过 state 继续就医旅程", async () => {
  const first = await call({ message: "张明远今天还有号吗？", patient_id: "demo001", session_id: "api-test", state: null, history: [] });
  assert.equal(first.visit_context.current_stage, "PRE_VISIT");
  assert.equal(first.tool_calls[1].name, "get_registration_slots");

  const second = await call({ message: "帮我挂10:30。", patient_id: "demo001", session_id: "api-test", state: first.state, history: [{ role: "user", content: "张明远今天还有号吗？" }, { role: "assistant", content: first.message }] });
  assert.equal(second.visit_context.current_stage, "REGISTERED");
  assert.equal(second.state.mock.visitContext.appointment_time, "10:30");
});

test("API 拒绝跨来源请求", async () => {
  const response = await POST(new Request("http://localhost/api/experiments/medical-ai/chat", {
    method: "POST",
    headers: { origin: "http://other.example", "content-type": "application/json" },
    body: JSON.stringify({ message: "然后呢？" }),
  }));
  assert.equal(response.status, 403);
});
