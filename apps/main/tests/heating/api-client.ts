import assert from "node:assert/strict";
import { sessionPOST, actionPOST, confirmationPOST, uploadPOST, simulateMaterialPOST, resetPOST, toolPOST } from "@/lib/works/heating/api";
import { chatPOST, confirmPOST, agentActionPOST } from "@/lib/works/heating/agent/api";
import { snapshotPOST, restartPOST } from "@/lib/works/heating/page-api";
import type { Actor } from "@/lib/works/heating/schema";
export const handlers = { session: sessionPOST, action: actionPOST, confirmation: confirmationPOST, upload: uploadPOST, "simulate-material": simulateMaterialPOST, reset: resetPOST, tool: toolPOST, chat: chatPOST, confirm: confirmPOST, "agent-action": agentActionPOST, snapshot: snapshotPOST, restart: restartPOST };
export function apiClient(origin = "http://localhost") {
  let demoState: string | undefined, actor: Actor | undefined;
  const headers = () => ({ origin, "x-heating-demo": "1", "content-type": "application/json", ...(actor ? { "x-heating-identity-version": String(actor.identityVersion), "x-heating-generation": actor.generation } : {}) });
  const request = (route: string, input: object = {}, extra: Record<string, string> = {}) => new Request(`${origin}/api/experiments/heating/${route}`, { method: "POST", headers: { ...headers(), ...extra }, body: JSON.stringify({ ...input, ...(demoState ? { demoState } : {}) }) });
  const call = async (route: keyof typeof handlers, input: object = {}, extra: Record<string, string> = {}) => {
    const response = await handlers[route](request(route, input, extra));
    const body = await response.json();
    if (response.ok) { demoState = body.demoState; if (body.result?.actor) actor = body.result.actor; }
    return { status: response.status, body, response };
  };
  const chat = async (message: string, requestId = crypto.randomUUID()) => {
    const response = await chatPOST(request("chat", { message, requestId }));
    assert.equal(response.status, 200);
    const events = (await response.text()).split("\n\n").filter(Boolean).map(event => ({ event: event.match(/^event: (\w+)/)?.[1], data: JSON.parse(event.split("\ndata: ")[1]) }));
    const final = events.find(item => item.event === "final")?.data;
    if (final) demoState = final.demoState;
    return { final, events };
  };
  const upload = async (applicationId: string, type: string, file: File) => {
    const form = new FormData(); form.set("applicationId", applicationId); form.set("type", type); form.set("file", file); form.set("demoState", demoState!);
    const h = headers() as Record<string, string>; delete h["content-type"];
    const response = await uploadPOST(new Request(`${origin}/api/experiments/heating/upload`, { method: "POST", headers: h, body: form }));
    const body = await response.json(); if (response.ok) demoState = body.demoState;
    return { status: response.status, body };
  };
  const records = async () => (await call("action", { name: "query_records", input: {} })).body.result;
  const execute = async (name: string, input: object) => {
    const op = { name, input: { ...input, idempotencyKey: crypto.randomUUID() } };
    const card = await call("confirmation", op); assert.equal(card.status, 200);
    const action = { name, input: { ...op.input, confirmationId: card.body.result.confirmationId } };
    const result = await call("action", action); assert.equal(result.status, 200);
    return { result: result.body.result, action };
  };
  return { call, chat, upload, request, records, execute, get state() { return demoState; }, get actor() { return actor!; } };
}
