/** Opt-in live model verification. All business state is carried by the page client, no database. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { once } from "node:events";
import { toolPOST } from "@/lib/works/heating/api";
import { agentActionPOST } from "@/lib/works/heating/agent/api";
import { apiClient } from "./api-client";
import { png } from "./helpers";

async function main() {
  assert.equal(process.env.HEATING_LIVE_MODEL, "1");
  const token = randomUUID();
  Object.assign(process.env, { HEATING_DEMO_ENABLED: "1", HEATING_SESSION_SECRET: randomUUID(), EXPERIMENT_AGENT_TOKEN: token });
  const bridge = createServer(async (incoming, outgoing) => {
    try {
      const chunks: Buffer[] = []; for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const handler = incoming.url?.endsWith("agent-action") ? agentActionPOST : toolPOST;
      const response = await handler(new Request(`${origin}${incoming.url}`, { method: "POST", headers: incoming.headers as Record<string, string>, body: Buffer.concat(chunks) }));
      outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch { outgoing.writeHead(500); outgoing.end(); }
  });
  bridge.listen(0, "127.0.0.1"); await once(bridge, "listening");
  const origin = `http://127.0.0.1:${(bridge.address() as { port: number }).port}`;
  const finder = createServer(); finder.listen(0, "127.0.0.1"); await once(finder, "listening");
  const port = (finder.address() as { port: number }).port; await new Promise<void>(r => finder.close(() => r()));
  const agentUrl = `http://127.0.0.1:${port}`; process.env.EXPERIMENT_AGENT_URL = agentUrl;
  const processAgent = spawn("uv", ["run", "python", "tests/heating_live_server.py", String(port)], { cwd: resolve("../../services/experiment-agents"), env: { ...process.env, EXPERIMENT_AGENT_TOKEN: token }, stdio: "ignore" });
  const client = apiClient(origin); await client.call("session");
  let turns = 0;
  const chat = async (message: string, attempt = 0): Promise<any> => {
    const { final, events } = await client.chat(message);
    assert.ok(final, `Agent must return verified final (${events.find(item => item.event === "error")?.data.error ?? "missing_final"})`);
    if (final.degraded && attempt < 2) return chat(message, attempt + 1);
    assert.equal(final.degraded, false); turns++; console.log(`PASS ${turns} ${final.usedTools.join(",")}`); return final;
  };
  const confirm = async (result: any, expected: string, attempt = 0): Promise<void> => {
    if (!result.proposal && attempt < 2) return confirm(await chat(`请继续刚才的业务，为 ${expected} 准备待确认提案，执行前我会点击确认。`), expected, attempt + 1);
    assert.equal(result.proposal?.operation.name, expected);
    assert.equal((await client.call("confirm", { proposalId: result.proposal.id, confirmed: true })).status, 200);
  };
  const switchUser = async (userId: string) => { assert.equal((await client.call("session", { userId })).status, 200); };
  const upload = async (applicationId: string, type: string) => { assert.equal((await client.upload(applicationId, type, png())).status, 200); };
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) { try { ready = (await fetch(`${agentUrl}/healthz`)).ok; } catch {} if (ready) break; await new Promise(r => setTimeout(r, 100)); }
    assert.ok(ready, "本地 Agno 服务应正常启动");
    await confirm(await chat("我想交今年的暖气费。"), "create_payment");
    await confirm(await chat("我明确要继续这笔订单的模拟付款，模拟成功。"), "simulate_payment");
    assert.equal((await client.records()).bills[0].status, "paid");
    const invoice = await chat("刚刚支付成功了吗？发票在哪？");
    assert.ok(invoice.cards.some((c: { result: { invoices?: unknown[] }; name: string }) => c.name === "query_invoice" || c.result.invoices?.length));
    await switchUser("B");
    const unbound = await chat("我还没有绑定房子。"); assert.equal(unbound.proposal, null);
    await confirm(await chat("绑定我的演示房屋，户号 DEMO-H002，姓名演示住户B，电话 DEMO-PHONE-B。"), "bind_house");
    await switchUser("F");
    const ambiguous = await chat("想交今年的暖气费。"); assert.equal(ambiguous.proposal, null);
    const second = await chat("我的第二套房子今年多少钱？"); assert.ok(second.cards.some((c: { name: string; input: { houseId?: string } }) => c.name === "query_bill" && c.input.houseId === "house-F2"));
    const interrupted = await chat("先不交了，申请断暖需要哪些材料？"); assert.equal(interrupted.proposal, null); assert.ok(interrupted.usedTools.includes("query_policy"));
    await confirm(await chat("今年我的第二套房子没人住，想办断暖。"), "create_draft");
    const app = (await client.records()).applications[0];
    const missing = await chat("资料齐了，帮我提交。"); assert.equal(missing.proposal, null);
    await upload(app.id, "ownership"); await upload(app.id, "construction");
    await confirm(await chat("两类材料都已经通过上传接口传了，资料齐了，帮我提交刚才那个申请。"), "submit_application");
    const progress = await chat("我刚才那个申请审核到哪一步了？"); assert.ok(progress.cards.some((c: { name: string; input: { applicationId?: string } }) => c.name === "query_application" && c.input.applicationId === app.id));
    await new Promise(r => setTimeout(r, 31000)); await client.records();
    const returned = await chat("为什么我的申请被退回了？"); assert.match(returned.answer, /照片|退回/);
    // Use different valid PNG bytes so that replacement is genuinely new metadata.
    const photo = new File([Buffer.concat([Buffer.from(await png().arrayBuffer()), Buffer.from("new-demo-photo")])], "新虚构照片.png", { type: "image/png" });
    assert.equal((await client.upload(app.id, "construction", photo)).status, 200);
    await confirm(await chat("我已经补了照片，现在可以继续了吗？请继续提审。"), "resubmit_application");
    await new Promise(r => setTimeout(r, 31000)); await client.records();
    await confirm(await chat("审核通过了，我想缴费。"), "create_disconnection_bill");
    await confirm(await chat("继续缴纳这笔断暖费用，请创建订单。"), "create_payment");
    await confirm(await chat("我确认要模拟付款成功，继续刚才的断暖订单。"), "simulate_payment");
    assert.equal((await client.records()).applications[0].status, "fee_paid");
    const policy = await chat("断暖为什么还需要缴费？"); assert.ok(policy.usedTools.includes("query_policy"));
    console.log(`真实 MiniMax / Agno / TypeScript 验收通过：${turns} 轮；供暖及断暖缴费、绑定、补件、确认与发票在同页状态包中连续一致。`);
  } finally {
    processAgent.kill("SIGTERM"); await Promise.race([once(processAgent, "exit"), new Promise(r => setTimeout(r, 3000))]);
    await new Promise<void>(r => bridge.close(() => r()));
  }
}
void main().catch(error => { console.error(error instanceof assert.AssertionError ? error.message : "Live integration failed"); process.exitCode = 1; });
