/** Isolated E2E fixture upstream. It scripts test intents; production always uses Agno. */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, mkdirSync, symlinkSync, copyFileSync, cpSync } from "node:fs";
import { join, resolve } from "node:path";

async function main() {
const root = process.cwd();
mkdirSync(join(root, ".local/heating"), { recursive: true });
const directory = mkdtempSync(join(root, ".local/heating/browser-"));
const site = join(directory, "site"); mkdirSync(site);
for (const name of ["app", "components", "content", "lib", "styles", "public"]) cpSync(join(root, name), join(site, name), { recursive: true });
symlinkSync(join(root, "node_modules"), join(site, "node_modules"));
for (const name of ["package.json", "tsconfig.json", "next.config.ts", "next-env.d.ts"]) copyFileSync(join(root, name), join(site, name));
const upstream = createServer(async (request, response) => {
  try {
    const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const { message, history = [], demoState: initialState } = JSON.parse(Buffer.concat(chunks).toString());
    let demoState = initialState;
    if (message === "演示模型异常") { response.writeHead(503); response.end(); return; }
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    response.write('event: status\ndata: {"label":"正在调用已有业务工具"}\n\n');
    const cards: { name: string; input: Record<string, unknown>; result: unknown }[] = [];
    const call = async (name: string, input: Record<string, unknown>, write = false) => {
      const result = await fetch(String(request.headers[write ? "x-heating-action-url" : "x-heating-tool-url"]), { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.TEST_HEATING_TOKEN}`, "X-Heating-Context": String(request.headers["x-heating-context"]) }, body: JSON.stringify({ name, input, demoState }) });
      const body = await result.json();
      if (!result.ok) throw new Error(body.error);
      demoState = body.demoState;
      cards.push({ name, input, result: body.result }); return body.result;
    };
    const records = await call("query_records", {});
    let answer = "已核实本次业务，请查看下方结果。", degraded = false;
    let replyMode = "results";
    const focus = { houseIds: [] as string[], billIds: [] as string[], applicationIds: [] as string[], invoiceIds: [] as string[] };
    const app = records.applications[0];
    const selectedHouse = message.match(/\((house-[A-Za-z0-9_-]+)\)/)?.[1] ?? message.match(/（(house-[A-Za-z0-9_-]+)）/)?.[1];
    const priorUser = [...history].reverse().find((item: { role: string }) => item.role === "user")?.content ?? "";
    const payment = async () => {
      if (records.houses.length > 1 && !selectedHouse) {
        answer = "您有两套房屋，想为哪一套缴费？"; replyMode = "choose_house";
        focus.houseIds = records.houses.map((house: { id: string }) => house.id); return;
      }
      const bill = records.bills.find((b: { id: string; houseId: string }) => b.id === message.match(/账单 ([A-Za-z0-9_-]+)/)?.[1]) ?? records.bills.find((b: { houseId: string }) => b.houseId === (selectedHouse ?? records.houses[0].id));
      await call("query_bill", { houseId: bill.houseId, year: bill.year });
      focus.billIds = [bill.id]; await call("create_payment", { billId: bill.id }, true);
    };
    try {
      if (message === "演示工具成功后模型未完成") {
        await call("query_bill", { houseId: records.houses[0].id, year: "2026-2027" });
        focus.billIds = [records.bills[0].id]; degraded = true;
        answer = "助手本轮回复未完整完成，已保留工具核实的结果。已确认的操作无需再次确认。";
      }
      else if (message.includes("DEMO-H002")) await call("bind_house", { account: "DEMO-H002", name: "演示住户B", phone: "DEMO-PHONE-B" }, true);
      else if (!records.houses.length) { replyMode = "binding_details"; answer = "先使用下方的虚构资料绑定房屋，我会继续帮您办理。"; }
      else if (message.includes("模拟支付成功") || message.includes("模拟支付失败") || message.includes("取消刚才待支付订单")) {
        const order = records.orders.find((o: { status: string }) => o.status === "pending");
        focus.billIds = [order.billId];
        await call("simulate_payment", { orderId: order.id, outcome: message.includes("失败") ? "failure" : message.includes("取消") ? "cancel" : "success" }, true);
      } else if (message.includes("重新提审")) { focus.applicationIds = [app.id]; await call("resubmit_application", { applicationId: app.id }, true); }
      else if (message.includes("帮我提交")) { focus.applicationIds = [app.id]; await call("submit_application", { applicationId: app.id }, true); }
      else if (message.includes("审核通过了")) { focus.applicationIds = [app.id]; await call("create_disconnection_bill", { applicationId: app.id }, true); }
      else if (message.includes("申请断暖") || message.includes("想办断暖") || message.includes("想断暖") || (message.includes("我选择") && priorUser.includes("断暖"))) {
        if (records.houses.length > 1 && !selectedHouse) { replyMode = "choose_house"; answer = "请选择您要办理断暖的房屋。"; focus.houseIds = records.houses.map((h: { id: string }) => h.id); }
        else await call("create_draft", { houseId: selectedHouse ?? records.houses[0].id, year: "2026-2027" }, true);
      }
      else if (message.includes("绑定房屋")) { answer = "您已经绑定房屋，可直接办理。"; focus.houseIds = records.houses.map((h: { id: string }) => h.id); }
      else if (message.includes("缴费记录")) { focus.billIds = records.bills.filter((b: { status: string }) => b.status === "paid").map((b: { id: string }) => b.id); answer = "您的缴费记录已经核实。"; }
      else if (message.includes("房屋面积和供暖费")) {
        for (const house of records.houses) {
          const bill = records.bills.find((item: { houseId: string; year: string; kind: string }) => item.houseId === house.id && item.year === "2026-2027" && item.kind === "heating");
          if (bill) { await call("query_bill", { houseId: house.id, year: bill.year }); focus.billIds.push(bill.id); }
        }
        answer = "已核对名下房屋面积和本年度供暖费用。";
      }
      else if (message.includes("我要缴纳") || message.includes("我想交") || (message.includes("我选择") && priorUser.includes("交"))) await payment();
      else if (message.includes("进度") || message.includes("审核到哪") || message.includes("退回") || message.includes("补了照片")) {
        if (app) { await call("query_application", { applicationId: app.id }); focus.applicationIds = [app.id]; answer = "申请进度已经核实，请查看当前状态和下一步。"; }
        else answer = "目前还没有断暖申请。";
      } else if (message.includes("发票") || message.includes("支付成功了吗")) {
        if (records.invoices[0]) { await call("query_invoice", { invoiceId: records.invoices[0].id }); focus.invoiceIds = [records.invoices[0].id]; }
        else answer = "目前还没有模拟发票。";
      } else if (message.includes("第二套")) { await call("query_bill", { houseId: "house-F2", year: "2026-2027" }); focus.billIds = records.bills.filter((b: { houseId: string }) => b.houseId === "house-F2").map((b: { id: string }) => b.id); }
      else if (message.includes("材料") || message.includes("为什么") || message.includes("政策")) { const policy = await call("query_policy", { question: message }); answer = policy.answers.map((a: { answer: string }) => a.answer).join("\n"); }
      else { replyMode = "clarify"; answer = "告诉我您想办理什么，我会继续引导。"; }
      if (cards.some(c => c.name.startsWith("create_") || c.name.startsWith("simulate_") || c.name.includes("submission"))) answer = "工具已核对，请查看待确认卡片。此时操作尚未执行。";
    } catch { answer = "工具校验未通过，请核对材料或当前业务状态后继续。"; degraded = true; if (app) { replyMode = "materials"; focus.applicationIds = [app.id]; } }
    response.end(`event: final\ndata: ${JSON.stringify({ answer, cards, usedTools: cards.map(c => c.name), degraded, demoState, replyMode, focus })}\n\n`);
  } catch { if (!response.headersSent) response.writeHead(500); response.end(); }
});
upstream.listen(0, "127.0.0.1"); await once(upstream, "listening");
const token = randomUUID(); process.env.TEST_HEATING_TOKEN = token;
const env = { ...process.env, HEATING_DEMO_ENABLED: "1", HEATING_SESSION_SECRET: randomUUID(), EXPERIMENT_AGENT_URL: `http://127.0.0.1:${(upstream.address() as { port: number }).port}`, EXPERIMENT_AGENT_TOKEN: token };
let realAgent: ReturnType<typeof spawn> | undefined;
if (process.env.HEATING_BROWSER_LIVE === "1") {
  const finder = createServer(); finder.listen(0, "127.0.0.1"); await once(finder, "listening");
  const port = (finder.address() as { port: number }).port; await new Promise<void>(done => finder.close(() => done()));
  env.EXPERIMENT_AGENT_URL = `http://127.0.0.1:${port}`;
  realAgent = spawn("uv", ["run", "python", "tests/heating_live_server.py", String(port)], { cwd: resolve(root, "../../services/experiment-agents"), env: { ...process.env, HEATING_LIVE_MODEL: "1", EXPERIMENT_AGENT_TOKEN: token }, stdio: "ignore" });
  let ready = false;
  for (let i = 0; i < 100; i++) { try { ready = (await fetch(`${env.EXPERIMENT_AGENT_URL}/healthz`)).ok; } catch {} if (ready) break; await new Promise(done => setTimeout(done, 100)); }
  if (!ready) { realAgent.kill(); upstream.close(); rmSync(directory, { force: true, recursive: true }); throw new Error("本地真实 Agno 测试服务未启动"); }
}
const next = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "dev", site, "--hostname", "127.0.0.1", "--port", "3216"], { cwd: site, env, stdio: "inherit" });
function cleanup() { next.kill("SIGTERM"); realAgent?.kill("SIGTERM"); upstream.close(); rmSync(directory, { force: true, recursive: true }); }
process.on("SIGTERM", () => { cleanup(); });
process.on("SIGINT", () => { cleanup(); });
next.on("exit", code => { realAgent?.kill("SIGTERM"); upstream.close(); rmSync(directory, { force: true, recursive: true }); process.exit(code ?? 1); });
}
void main();
