import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { consumeChat } from "@/lib/works/heating/client-contract";
const final = { demoState: "opaque-test-state", answer: "工具核实的费用", cards: [], usedTools: [], degraded: false, proposal: null, identityVersion: 0, generation: randomUUID(), demo: true };
function stream(chunks: string[]) { return new Response(new ReadableStream({ start(c) { for (const chunk of chunks) c.enqueue(new TextEncoder().encode(chunk)); c.close(); } }), { headers: { "Content-Type": "text/event-stream" } }); }
test("H5 SSE 分片恢复、状态事件、业务 final 校验", async () => {
  const event = `event: status\ndata: {"label":"正在核实"}\n\nevent: final\ndata: ${JSON.stringify(final)}\n\n`, labels: string[] = [];
  const response = await consumeChat(stream([event.slice(0, 13), event.slice(13, 65), event.slice(65)]), label => labels.push(label));
  assert.equal(response.answer, final.answer); assert.deepEqual(labels, ["正在核实"]);
});
test("模型失败、缺失/重复 final 和畸形业务结构不能显示成功", async () => {
  for (const event of ['event: error\ndata: {"error":"agent_failed"}\n\n', 'event: status\ndata: {"label":"等待"}\n\n', 'event: final\ndata: {"answer":"假成功"}\n\n', `event: final\ndata: ${JSON.stringify(final)}\n\nevent: final\ndata: ${JSON.stringify(final)}\n\n`]) await assert.rejects(consumeChat(stream([event]), () => {}));
});

test("Next URL 标准化为 localhost 时仍验证实际 Host；拒绝跨源与伪造转发 Host", async () => {
  const { requireBrowserWrite } = await import("@/lib/works/heating/security");
  const request = (origin: string, host?: string, forwarded?: string) => new Request("http://localhost:3216/api/experiments/heating/chat", { headers: { origin, "x-heating-demo": "1", ...(host ? { host } : {}), ...(forwarded ? { "x-forwarded-host": forwarded } : {}) } });
  assert.equal(requireBrowserWrite(request("http://127.0.0.1:3216", "127.0.0.1:3216")), "http://127.0.0.1:3216");
  assert.throws(() => requireBrowserWrite(request("http://other.example", "127.0.0.1:3216", "other.example")));
  assert.throws(() => requireBrowserWrite(request("http://other.example", "other.example@localhost:3216")));
});


test("大型 Tool 快照不会截坏历史 JSON，也不会把损坏历史误报为用户确认", async () => {
  const { historyContent } = await import("@/lib/works/heating/agent/api");
  const large = { ...final, cards: [{ name: "query_records", input: {}, result: { data: "x".repeat(40000) } }] };
  const saved = historyContent(large, undefined);
  assert.equal(JSON.parse(saved).answer, final.answer); assert.ok(saved.length <= 12000);
  const escaped = historyContent({ ...large, answer: "\\".repeat(12000) }, undefined);
  assert.ok(escaped.length <= 12000); assert.ok(JSON.parse(escaped).answer.includes("节选"));
  const { fixture } = await import("./helpers"), { HeatingConversation } = await import("@/lib/works/heating/agent/conversation");
  const f = await fixture();
  try {
    const chat = new HeatingConversation(f.store, "test", f.session.actor, f.session.expiresAt);
    const run = await chat.begin(randomUUID(), "恢复");
    await chat.finish(run.turnId!, randomUUID(), "恢复", {}, [{ role: "assistant", content: '{"answer":"历史被截断' }]);
    const view = await chat.view(); assert.match(view.history[0].content, /未能完整恢复/); assert.doesNotMatch(view.history[0].content, /明确确认/);
  } finally { f.close(); }
});
