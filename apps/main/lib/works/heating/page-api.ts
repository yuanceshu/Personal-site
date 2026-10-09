import { z } from "zod";
import { boundary, browserContext, environment, jsonBody } from "./api";
import { HeatingConversation } from "./agent/conversation";
import { namespace, requireBrowserWrite } from "./security";
import { currentPage } from "./page-state";
import { snapshotSchema } from "./client-contract";

export function snapshotPOST(request: Request) {
  return boundary(request, async () => {
    requireBrowserWrite(request);
    const { actor, service, store } = await browserContext(request);
    const session = await service.open(actor.sandboxId);
    const conversation = await new HeatingConversation(store, namespace(), actor, session.expiresAt).view();
    // Revalidate identity after reading the separately persisted conversation.
    const records = await service.execute(actor, { name: "query_records", input: {} });
    const result = snapshotSchema.parse({ records, conversation, identityVersion: actor.identityVersion, generation: actor.generation });
    return Response.json({ result }, { headers: { "Cache-Control": "no-store" } });
  });
}
export function restartPOST(request: Request) {
  return boundary(request, async () => {
    requireBrowserWrite(request);
    z.object({ confirmed: z.literal(true) }).strict().parse(await jsonBody(request));
    const { service } = await environment();
    // Replace only this page's transient sandbox. Nothing exists in a global store.
    const session = await service.open();
    currentPage().sandboxId = session.actor.sandboxId;
    return Response.json({ result: session }, { headers: { "Cache-Control": "no-store" } });
  });
}
