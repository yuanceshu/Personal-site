import type { Page } from "@playwright/test";
const requests = new WeakMap<Page, { demoState: string; headers: Record<string, string> }>();
export function watchPage(page: Page) {
  page.on("request", request => {
    if (!request.url().includes("/api/experiments/heating/") || !request.headers()["content-type"]?.includes("application/json")) return;
    try { const { demoState } = request.postDataJSON(); if (typeof demoState === "string") requests.set(page, { demoState, headers: request.headers() }); } catch { /* multipart carries metadata independently */ }
  });
}
export async function pageSnapshot(page: Page) {
  const state = requests.get(page); if (!state) throw Error("Page request state not observed");
  return page.evaluate(async ({ demoState, headers }) => {
    const response = await fetch("/api/experiments/heating/snapshot", { method: "POST", credentials: "omit", headers: { "Content-Type": "application/json", "X-Heating-Demo": "1", "X-Heating-Identity-Version": headers["x-heating-identity-version"], "X-Heating-Generation": headers["x-heating-generation"] }, body: JSON.stringify({ demoState }) });
    if (!response.ok) throw Error("Snapshot failed"); return (await response.json()).result;
  }, state);
}
export async function repeatConfirm(page: Page, proposalId: string) {
  const state = requests.get(page)!;
  return page.evaluate(async ({ demoState, headers, proposalId }) => {
    return (await fetch("/api/experiments/heating/confirm", { method: "POST", headers: { "Content-Type": "application/json", "X-Heating-Demo": "1", "X-Heating-Identity-Version": headers["x-heating-identity-version"], "X-Heating-Generation": headers["x-heating-generation"] }, body: JSON.stringify({ demoState, proposalId, confirmed: true }) })).status;
  }, { ...state, proposalId });
}
