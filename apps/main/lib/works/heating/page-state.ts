import { AsyncLocalStorage } from "node:async_hooks";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { deflateSync, inflateSync } from "node:zlib";
import { z } from "zod";
import { RequestHeatingStore } from "./store";
import { HeatingError } from "./errors";

const capsuleSchema = z.object({ version: z.literal(1), sandboxId: z.string().uuid(), entries: z.record(z.string().regex(/^heating:page:(sandbox|chat):/), z.string()) }).strict();
type Scope = { store: RequestHeatingStore; sandboxId?: string; body?: Record<string, unknown> };
const scopes = new AsyncLocalStorage<Scope>();
export function currentPage() { const scope = scopes.getStore(); if (!scope) throw new HeatingError("page_state_required", 401); return scope; }
export function pageSecret() {
  const value = process.env.HEATING_SESSION_SECRET || process.env.EXPERIMENT_AGENT_TOKEN;
  if (!value || value.length < 16) throw new HeatingError("session_unconfigured", 503);
  return value;
}
const key = () => createHash("sha256").update(`heating-page-demo-v1:${pageSecret()}`).digest();
export function decodePage(token: unknown) {
  try {
    if (typeof token !== "string" || token.length > 256000) throw new Error();
    const data = Buffer.from(token, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    const plain = Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]);
    return capsuleSchema.parse(JSON.parse(inflateSync(plain, { maxOutputLength: 4 * 1024 * 1024 }).toString()));
  } catch { throw new HeatingError("invalid_page_state", 401); }
}
export function encodePage() {
  const scope = currentPage();
  if (!scope.sandboxId) throw new HeatingError("page_state_required", 401);
  const state = capsuleSchema.parse({ version: 1, sandboxId: scope.sandboxId, entries: scope.store.entries() });
  const bytes = Buffer.from(JSON.stringify(state));
  if (bytes.length > 4 * 1024 * 1024) throw new HeatingError("sandbox_capacity", 413);
  const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), nonce);
  const content = Buffer.concat([cipher.update(deflateSync(bytes)), cipher.final()]);
  const token = Buffer.concat([nonce, cipher.getAuthTag(), content]).toString("base64url");
  if (token.length > 256000) throw new HeatingError("sandbox_capacity", 413);
  return token;
}
export function acceptPage(token: unknown) {
  const state = decodePage(token), scope = currentPage();
  if (state.sandboxId !== scope.sandboxId) throw new HeatingError("invalid_page_state", 401);
  scope.store.replace(state.entries);
}
async function limitedBody(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new HeatingError("missing_body", 400);
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > limit) { void reader.cancel().catch(() => undefined); throw new HeatingError("input_too_large", 413); }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally { reader.releaseLock(); }
}
export async function withPage(request: Request, run: () => Promise<Response>) {
  let token: unknown;
  let body: Record<string, unknown> | undefined;
  if (request.method === "POST" && request.headers.get("content-type")?.startsWith("application/json")) {
    const bytes = await limitedBody(request.clone(), 512000);
    const parsed = JSON.parse(bytes.toString());
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new HeatingError("invalid_request", 400);
    const { demoState, ...input } = parsed; token = demoState; body = input;
  } else if (request.method === "POST" && request.headers.get("content-type")?.startsWith("multipart/form-data;")) {
    const bytes = await limitedBody(request.clone(), 4500000);
    token = (await new Response(new Uint8Array(bytes), { headers: { "Content-Type": request.headers.get("content-type")! } }).formData()).get("demoState");
  }
  const state = token === undefined || token === null ? undefined : decodePage(token);
  return scopes.run({ store: new RequestHeatingStore(state?.entries), sandboxId: state?.sandboxId, body }, async () => {
    const response = await run();
    if (response.ok && response.headers.get("content-type")?.includes("application/json")) {
      const payload = await response.json();
      return Response.json({ ...payload, demoState: encodePage() }, { status: response.status, headers: response.headers });
    }
    return response;
  });
}
