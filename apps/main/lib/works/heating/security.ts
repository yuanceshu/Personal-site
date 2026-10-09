import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { HeatingError } from "./errors";
import { userIdSchema, type Actor } from "./schema";
import { pageSecret } from "./page-state";

function secret() { return pageSecret(); }
export function namespace() { return "page"; }
function sign(data: string, purpose: string) { return createHmac("sha256", secret()).update(`${namespace()}:${purpose}:${data}`).digest("base64url"); }
export function equalSecret(actual: string | null, expected: string | undefined) {
  if (!actual || !expected) return false;
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
function encode(value: unknown, purpose: string) {
  const data = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${data}.${sign(data, purpose)}`;
}
function decode(token: string, purpose: string): unknown {
  const [data, signature, extra] = token.split(".");
  if (!data || !signature || extra || !equalSecret(signature, sign(data, purpose))) throw new HeatingError("invalid_session", 401);
  try { return JSON.parse(Buffer.from(data, "base64url").toString()); }
  catch { throw new HeatingError("invalid_session", 401); }
}
export function requireBrowserWrite(request: Request) {
  const origin = request.headers.get("origin");
  // Next dev can normalize Request.url to localhost even when the page uses an IP.
  // Host is the actual browser request authority; do not trust x-forwarded-host.
  const expected = new URL(request.url);
  const host = request.headers.get("host");
  if (host) {
    if (/[/\\?#@\s]/.test(host)) throw new HeatingError("invalid_origin", 403);
    expected.host = host;
    if (expected.host !== host) throw new HeatingError("invalid_origin", 403);
  }
  if (origin !== expected.origin || request.headers.get("x-heating-demo") !== "1") throw new HeatingError("invalid_origin", 403);
  return expected.origin;
}
export function checkIdentityHeaders(request: Request, actor: Actor) {
  if (request.headers.get("x-heating-identity-version") !== String(actor.identityVersion) || request.headers.get("x-heating-generation") !== actor.generation) throw new HeatingError("identity_changed", 409);
}
/** Short-lived context minted by the Next.js chat proxy; never trust a model-supplied actor. */
export function delegateActor(actor: Actor, now = Date.now(), turnId?: string) { return encode({ actor, expires: now + 120_000, ...(turnId ? { turnId } : {}) }, "agent"); }
export function readDelegation(token: string) {
  const result = z.object({ actor: z.object({ sandboxId: z.string().uuid(), userId: userIdSchema, identityVersion: z.number().int().nonnegative(), generation: z.string().uuid() }).strict(), expires: z.number().int(), turnId: z.string().uuid().optional() }).strict().parse(decode(token, "agent"));
  if (result.expires <= Date.now()) throw new HeatingError("delegation_expired", 401);
  return result;
}
export function readDelegatedActor(token: string) { return readDelegation(token).actor; }
