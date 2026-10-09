import { z } from "zod";
import { HeatingError } from "./errors";
import { agentToolNames, idSchema, operationSchema } from "./schema";
import { HeatingService } from "./service";
import { currentPage, withPage, pageSecret } from "./page-state";
import { checkIdentityHeaders, equalSecret, readDelegatedActor, requireBrowserWrite } from "./security";

export async function environment() {
  if (process.env.HEATING_DEMO_ENABLED === "0") throw new HeatingError("demo_unavailable", 503);
  pageSecret();
  return { store: currentPage().store, service: new HeatingService(currentPage().store, "page") };
}
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export async function boundary(request: Request, run: () => Promise<Response>) {
  try { return await withPage(request, run); }
  catch (error) {
    if (error instanceof HeatingError) return Response.json({ error: error.code }, { status: error.status, headers });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "invalid_request" }, { status: 400, headers });
    return Response.json({ error: "heating_unavailable" }, { status: 503, headers });
  }
}
export async function readLimited(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new HeatingError("missing_body", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new HeatingError("input_too_large", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
export async function jsonBody(request: Request) {
  if (currentPage().body) return currentPage().body;
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new HeatingError("invalid_content_type", 400);
  return JSON.parse((await readLimited(request, 16384)).toString());
}
export async function browserContext(request: Request) {
  const { store, service } = await environment();
  const sandbox = currentPage().sandboxId;
  if (!sandbox) throw new HeatingError("session_required", 401);
  const { actor } = await service.open(sandbox);
  checkIdentityHeaders(request, actor);
  return { service, actor, store };
}
function response(result: unknown) { return Response.json({ result }, { headers }); }

export function sessionPOST(request: Request) {
  return boundary(request, async () => {
    requireBrowserWrite(request);
    const { service } = await environment();
    const input = z.object({ userId: z.enum(["A", "B", "C", "D", "E", "F"]).optional() }).strict().parse(await jsonBody(request));
    const sandbox = currentPage().sandboxId;
    if (sandbox) {
      const { actor } = await browserContext(request);
      return response(input.userId ? await service.switchIdentity(actor, input.userId) : await service.open(sandbox));
    }
    const session = await service.open();
    const selected = input.userId ? await service.switchIdentity(session.actor, input.userId) : session;
    currentPage().sandboxId = session.actor.sandboxId;
    return Response.json({ result: selected }, { headers });
  });
}
export function confirmationPOST(request: Request) {
  return boundary(request, async () => {
    requireBrowserWrite(request);
    const { service, actor } = await browserContext(request);
    return response(await service.prepareConfirmation(actor, await jsonBody(request)));
  });
}
export function actionPOST(request: Request) {
  return boundary(request, async () => {
    requireBrowserWrite(request);
    const { service, actor } = await browserContext(request);
    const raw = await jsonBody(request);
    if (raw?.name === "create_disconnection_bill") {
      const payload = z.object({ name: z.literal("create_disconnection_bill"), input: z.object({ applicationId: idSchema }).strict() }).strict().parse(raw);
      return response(await service.createDisconnectionBill(actor, payload.input.applicationId));
    }
    return response(await service.execute(actor, raw));
  });
}
export function toolPOST(request: Request) {
  return boundary(request, async () => {
    if (!equalSecret(request.headers.get("authorization"), process.env.EXPERIMENT_AGENT_TOKEN ? `Bearer ${process.env.EXPERIMENT_AGENT_TOKEN}` : undefined)) throw new HeatingError("unauthorized", 401);
    const { service } = await environment();
    const delegation = request.headers.get("x-heating-context");
    if (!delegation) throw new HeatingError("delegation_required", 401);
    const actor = readDelegatedActor(delegation);
    const operation = operationSchema.parse(await jsonBody(request));
    if (!(agentToolNames as readonly string[]).includes(operation.name)) throw new HeatingError("user_action_required", 403);
    return response(await service.execute(actor, operation));
  });
}
export function uploadPOST(request: Request) {
  return boundary(request, async () => {
    requireBrowserWrite(request);
    const { service, actor } = await browserContext(request);
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) throw new HeatingError("invalid_content_type", 400);
    const bytes = await readLimited(request, 5 * 1024 * 1024 + 16384);
    const form = await new Response(new Uint8Array(bytes), { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
    if ([...form.keys()].some(k => !["file", "applicationId", "type", "demoState"].includes(k)) || form.getAll("file").length !== 1 || form.getAll("applicationId").length !== 1 || form.getAll("type").length !== 1) throw new HeatingError("invalid_upload", 400);
    const file = form.get("file");
    if (!(file instanceof File)) throw new HeatingError("file_required", 400);
    return response(await service.uploadMaterial(actor, form.get("applicationId"), form.get("type"), file));
  });
}
export function materialPOST(request: Request) {
  return boundary(request, async () => {
    const { service, actor } = await browserContext(request);
    const material = await service.material(actor, (await jsonBody(request)).id);
    // Deliberately render a fixed placeholder; never publish original uploads or filenames.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="#f3f4f6"/><text x="40" y="120" font-size="26">模拟材料占位</text><text x="40" y="170" font-size="18">${material.type === "ownership" ? "产权证明或合同" : "断暖施工照片"} · 原始文件未留存</text></svg>`;
    return new Response(svg, { headers: { ...headers, "Content-Type": "image/svg+xml", "Content-Security-Policy": "default-src 'none'; style-src 'none'; sandbox" } });
  });
}
export function resetPOST(request: Request) {
  return boundary(request, async () => {
    if (!equalSecret(request.headers.get("authorization"), process.env.HEATING_DEVELOPER_TOKEN ? `Bearer ${process.env.HEATING_DEVELOPER_TOKEN}` : undefined)) throw new HeatingError("unauthorized", 401);
    requireBrowserWrite(request);
    z.object({ confirmed: z.literal(true) }).strict().parse(await jsonBody(request));
    const { service, actor } = await browserContext(request);
    return response(await service.reset(actor));
  });
}
