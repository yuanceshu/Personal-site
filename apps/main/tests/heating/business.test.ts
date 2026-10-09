import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { HeatingError } from "@/lib/works/heating/errors";
import { RequestHeatingStore } from "@/lib/works/heating/store";
import { HeatingService } from "@/lib/works/heating/service";
import { applicationSchema, billSchema, materialSchema, operationSchema, orderSchema } from "@/lib/works/heating/schema";
import { assertApplicationTransition } from "@/lib/works/heating/state-machine";
import { confirm, draft, fixture, materials, pay, png, records, signBill } from "./helpers";

const code = (expected: string) => (error: unknown) => error instanceof HeatingError && error.code === expected;

test("正常缴费：金额来自Tool；订单/账单/发票原子更新；失败和取消不改缴费结论", async () => {
  const f = await fixture();
  try {
    const actor = f.session.actor;
    assert.equal((await records(f.service, actor)).bills[0].amountCents, 212500);
    for (const outcome of ["failure", "cancel"] as const) {
      const order = orderSchema.parse(await confirm(f.service, actor, { name: "create_payment", input: { billId: "bill-house-A", idempotencyKey: outcome } }));
      await confirm(f.service, actor, { name: "simulate_payment", input: { orderId: order.id, outcome, idempotencyKey: `${outcome}-settle` } });
      const view = await records(f.service, actor);
      assert.equal(view.bills[0].status, "unpaid");
      assert.equal(view.invoices.length, 0);
      assert.equal(view.orders.at(-1)?.status, outcome === "failure" ? "failed" : "cancelled");
    }
    await pay(f.service, actor, "bill-house-A");
    const view = await records(f.service, actor);
    assert.equal(view.bills[0].status, "paid");
    assert.equal(view.invoices.length, 1);
    assert.equal(view.invoices[0].amountCents, view.bills[0].amountCents);
    assert.equal(view.invoices[0].label, "模拟发票");
    await assert.rejects(confirm(f.service, actor, { name: "create_payment", input: { billId: "bill-house-A", idempotencyKey: "again" } }), code("bill_already_paid"));
  } finally { f.close(); }
});

test("确认凭据必需、不能跨操作使用；过期或材料改变的旧摘要失效", async () => {
  const f = await fixture();
  try {
    const actor = f.session.actor;
    await assert.rejects(f.service.execute(actor, { name: "create_payment", input: { billId: "bill-house-A", idempotencyKey: "missing" } }), code("confirmation_required"));
    const app = await draft(f.service, actor);
    await materials(f.service, actor, app.id);
    const operation = { name: "submit_application" as const, input: { applicationId: app.id, idempotencyKey: "submit" } };
    const card = await f.service.prepareConfirmation(actor, operation);
    const second = new File(["%PDF-1.4\n虚构演示补充合同"], "演示合同.pdf", { type: "application/pdf" });
    await f.service.uploadMaterial(actor, app.id, "ownership", second);
    await assert.rejects(f.service.execute(actor, { ...operation, input: { ...operation.input, confirmationId: card.confirmationId } }), code("confirmation_required"));
    const fresh = await f.service.prepareConfirmation(actor, operation);
    f.advance(300001);
    await assert.rejects(f.service.execute(actor, { ...operation, input: { ...operation.input, confirmationId: fresh.confirmationId } }), code("confirmation_required"));
    const cross = await f.service.prepareConfirmation(actor, { name: "create_payment", input: { billId: "bill-house-A", idempotencyKey: "pay-card" } });
    await assert.rejects(f.service.execute(actor, { ...operation, input: { ...operation.input, confirmationId: cross.confirmationId } }), code("confirmation_required"));
    assert.equal((await records(f.service, actor)).applications[0].status, "draft");
  } finally { f.close(); }
});

test("支付并发重复点击幂等；同一幂等键改参数会冲突", async () => {
  const f = await fixture();
  try {
    const actor = f.session.actor;
    await signBill(f.service, actor, "bill-house-A");
    const create = { name: "create_payment" as const, input: { billId: "bill-house-A", idempotencyKey: "same-order" } };
    const card = await f.service.prepareConfirmation(actor, create);
    const payload = { ...create, input: { ...create.input, confirmationId: card.confirmationId } };
    const orders = await Promise.all(Array.from({ length: 10 }, () => f.service.execute(actor, payload)));
    assert.equal(new Set(orders.map(o => orderSchema.parse(o).id)).size, 1);
    const order = orderSchema.parse(orders[0]);
    const payment = { name: "simulate_payment" as const, input: { orderId: order.id, outcome: "success" as const, idempotencyKey: "same-payment" } };
    const paidCard = await f.service.prepareConfirmation(actor, payment);
    await Promise.all(Array.from({ length: 10 }, () => f.service.execute(actor, { ...payment, input: { ...payment.input, confirmationId: paidCard.confirmationId } })));
    const view = await records(f.service, actor);
    assert.equal(view.orders.length, 1);
    assert.equal(view.invoices.length, 1);
    assert.equal(view.events.filter(e => e.entityId === order.id && e.to === "paid").length, 1);
    await assert.rejects(f.service.execute(actor, { ...payment, input: { ...payment.input, outcome: "failure" } }), code("idempotency_conflict"));
  } finally { f.close(); }
});

test("断暖全链路：真实文件元数据→唯一工单→固定两级审核→独立费用→缴费", async () => {
  const f = await fixture();
  try {
    const actor = f.session.actor;
    const app = await draft(f.service, actor);
    await assert.rejects(f.service.createDisconnectionBill(actor, app.id), code("approval_required"));
    await assert.rejects(confirm(f.service, actor, { name: "submit_application", input: { applicationId: app.id, idempotencyKey: "missing-files" } }), code("materials_incomplete"));
    assert.equal((await records(f.service, actor)).applications[0].status, "draft");
    await materials(f.service, actor, app.id);
    await confirm(f.service, actor, { name: "submit_application", input: { applicationId: app.id, idempotencyKey: "submit" } });
    for (const expected of ["submitted", "review_level_1", "review_level_2", "approved"]) {
      const view = applicationSchema.loose().parse(await f.service.execute(actor, { name: "query_application", input: { applicationId: app.id } }));
      assert.equal(view.status, expected);
      const repeat = applicationSchema.loose().parse(await f.service.execute(actor, { name: "query_application", input: { applicationId: app.id } }));
      assert.equal(repeat.status, expected);
      f.advance(10000);
    }
    await assert.rejects(confirm(f.service, actor, { name: "create_payment", input: { billId: "bill-house-A", idempotencyKey: "normal-conflict" } }), code("disconnection_conflict"));
    const fees = await Promise.all(Array.from({ length: 5 }, () => f.service.createDisconnectionBill(actor, app.id)));
    const bill = billSchema.parse(fees[0]);
    assert.equal(new Set(fees.map(b => billSchema.parse(b).id)).size, 1);
    assert.equal(bill.amountCents, 74375);
    assert.equal(bill.kind, "disconnection");
    await pay(f.service, actor, bill.id);
    const view = await records(f.service, actor);
    assert.equal(view.applications[0].status, "fee_paid");
    assert.equal(view.bills.find(b => b.kind === "heating")?.status, "unpaid");
    assert.equal(view.bills.find(b => b.kind === "disconnection")?.status, "paid");
    assert.equal(view.applications.length, 1);
    assert.deepEqual(view.events.filter(e => e.entityId === app.id && e.from !== e.to).map(e => e.to), ["draft", "submitted", "review_level_1", "review_level_2", "approved", "fee_pending", "fee_paid"]);
    await assert.rejects(f.service.uploadMaterial(actor, app.id, "construction", png()), code("materials_locked"));
  } finally { f.close(); }
});

test("预设补件与新申请退回都更新同一工单，保留原因和历史", async () => {
  const f = await fixture();
  try {
    const actor = (await f.service.switchIdentity(f.session.actor, "D")).actor;
    const appId = "application-D";
    await assert.rejects(confirm(f.service, actor, { name: "resubmit_application", input: { applicationId: appId, idempotencyKey: "old" } }), code("replacement_required"));
    await f.service.uploadMaterial(actor, appId, "construction", png());
    await confirm(f.service, actor, { name: "resubmit_application", input: { applicationId: appId, idempotencyKey: "new" } });
    f.advance(30000);
    const view = await records(f.service, actor);
    assert.equal(view.applications.length, 1);
    assert.equal(view.applications[0].id, appId);
    assert.equal(view.applications[0].status, "approved");
    assert.ok(view.events.some(e => e.to === "needs_more_materials" && e.reason.includes("施工照片")));
    assert.ok(view.events.some(e => e.to === "resubmitted"));
    const actorF = (await f.service.switchIdentity(actor, "F")).actor;
    const app = await draft(f.service, actorF, "house-F2");
    await materials(f.service, actorF, app.id);
    await confirm(f.service, actorF, { name: "submit_application", input: { applicationId: app.id, idempotencyKey: "f-submit" } });
    f.advance(20000);
    assert.equal((await records(f.service, actorF)).applications[0].status, "needs_more_materials");
    await f.service.uploadMaterial(actorF, app.id, "construction", png());
    await confirm(f.service, actorF, { name: "resubmit_application", input: { applicationId: app.id, idempotencyKey: "f-resubmit" } });
    f.advance(30000);
    assert.equal((await records(f.service, actorF)).applications[0].status, "approved");
  } finally { f.close(); }
});

test("A-F场景：首次绑定只匹配虚构凭据，多房屋顺序稳定、账单隔离", async () => {
  const f = await fixture();
  try {
    let actor = (await f.service.switchIdentity(f.session.actor, "B")).actor;
    assert.equal((await records(f.service, actor)).houses.length, 0);
    assert.equal((await records(f.service, actor)).bills.length, 0);
    await assert.rejects(f.service.execute(actor, { name: "query_bill", input: { houseId: "house-B", year: "2026-2027" } }), code("house_not_bound"));
    await assert.rejects(confirm(f.service, actor, { name: "bind_house", input: { account: "DEMO-H001", name: "演示住户B", phone: "DEMO-PHONE-B", idempotencyKey: "wrong" } }), code("demo_identity_mismatch"));
    await confirm(f.service, actor, { name: "bind_house", input: { account: "DEMO-H002", name: "演示住户B", phone: "DEMO-PHONE-B", idempotencyKey: "bind" } });
    await pay(f.service, actor, "bill-house-B");
    assert.equal((await records(f.service, actor)).bills[0].status, "paid");
    actor = (await f.service.switchIdentity(actor, "F")).actor;
    const houses = (await records(f.service, actor)).houses;
    assert.deepEqual(houses.map(h => h.id), ["house-F", "house-F2"]);
    const second = z.object({ bills: z.array(billSchema) }).loose().parse(await f.service.execute(actor, { name: "query_bill", input: { houseId: houses[1].id, year: "2026-2027" } }));
    assert.equal(second.bills[0].amountCents, 190000);
    actor = (await f.service.switchIdentity(actor, "C")).actor;
    assert.equal((await records(f.service, actor)).applications[0].status, "review_level_1");
    actor = (await f.service.switchIdentity(actor, "E")).actor;
    assert.equal((await records(f.service, actor)).invoices[0].id, "invoice-E");
  } finally { f.close(); }
});

test("越权ID、旧身份与访客沙盒不能串数据；切换使旧确认失效", async () => {
  const f = await fixture();
  try {
    const original = f.session.actor;
    const card = await f.service.prepareConfirmation(original, { name: "create_payment", input: { billId: "bill-house-A", idempotencyKey: "before-switch" } });
    const b = (await f.service.switchIdentity(original, "B")).actor;
    await assert.rejects(f.service.execute(original, { name: "query_records", input: {} }), code("identity_changed"));
    await assert.rejects(f.service.execute(b, { name: "query_invoice", input: { invoiceId: "invoice-E" } }), code("record_not_found"));
    await assert.rejects(f.service.execute(b, { name: "query_application", input: { applicationId: "application-D" } }), code("record_not_found"));
    await assert.rejects(f.service.material(b, "material-D-ownership"), code("record_not_found"));
    const a = (await f.service.switchIdentity(b, "A")).actor;
    await assert.rejects(f.service.execute(a, { name: "create_payment", input: { billId: "bill-house-A", idempotencyKey: "before-switch", confirmationId: card.confirmationId } }), code("confirmation_required"));
    await pay(f.service, a, "bill-house-A");
    const visitor2 = await f.service.open();
    assert.equal((await records(f.service, visitor2.actor)).bills[0].status, "unpaid");
  } finally { f.close(); }
});

test("上传校验：类型/扩展名/大小/签名；重复上传幂等；保存显示文件名与元数据，不保存原文件", async () => {
  const f = await fixture();
  try {
    const actor = f.session.actor;
    const app = await draft(f.service, actor);
    for (const file of [new File(["fake"], "demo.png", { type: "image/png" }), new File(["%PDF-1.4"], "demo.exe", { type: "application/pdf" }), new File([], "demo.png", { type: "image/png" }), new File([new Uint8Array(5 * 1024 * 1024 + 1)], "demo.png", { type: "image/png" })]) await assert.rejects(f.service.uploadMaterial(actor, app.id, "ownership", file), error => error instanceof HeatingError);
    const m1 = materialSchema.parse(await f.service.uploadMaterial(actor, app.id, "ownership", png()));
    const m2 = materialSchema.parse(await f.service.uploadMaterial(actor, app.id, "ownership", png()));
    assert.equal(m1.id, m2.id);
    assert.equal(m1.storageMode, "demo_placeholder");
    assert.equal(m1.fileName, "虚构演示材料.png");
    assert.deepEqual(Object.keys(m1).sort(), ["id", "userId", "applicationId", "type", "fileName", "mime", "size", "sha256", "storageMode", "uploadedAt"].sort());
    const secondStore = new RequestHeatingStore(f.store.entries());
    try {
      const restored = await new HeatingService(secondStore, "test", f.clock).material(actor, m1.id);
      assert.equal(restored.fileName, m1.fileName);
      assert.equal(restored.sha256, m1.sha256);
    } finally {  }
    const renamed = new File([await png().arrayBuffer()], "../本地\u0000演示.png", { type: "image/png" });
    const same = await f.service.uploadMaterial(actor, app.id, "ownership", renamed);
    assert.equal(same.id, m1.id);
    assert.equal(same.fileName, "本地演示.png");
    const legacy = { ...m1 } as Record<string, unknown>; delete legacy.fileName;
    assert.equal(materialSchema.parse(legacy).fileName, "历史演示材料（未记录文件名）");
    assert.equal((await f.service.material(actor, m1.id)).id, m1.id);
  } finally { f.close(); }
});

test("重置只恢复当前访客种子，并使旧身份/会话上下文失效", async () => {
  const f = await fixture();
  try {
    const visitor2 = await f.service.open();
    await pay(f.service, f.session.actor, "bill-house-A");
    await pay(f.service, visitor2.actor, "bill-house-A");
    const reset = await f.service.reset(f.session.actor);
    assert.equal((await records(f.service, reset.actor)).orders.length, 0);
    assert.equal((await records(f.service, visitor2.actor)).bills[0].status, "paid");
    await assert.rejects(records(f.service, f.session.actor), code("identity_changed"));
  } finally { f.close(); }
});

test("状态机拒绝越级审批；关键入参拒绝模型金额/状态/真实手机号；未知政策不编造", async () => {
  assert.throws(() => assertApplicationTransition("draft", "approved"), code("invalid_application_transition"));
  assert.throws(() => assertApplicationTransition("review_level_2", "fee_paid"), code("invalid_application_transition"));
  for (const raw of [{ name: "create_payment", input: { billId: "bill-house-A", amountCents: 1, idempotencyKey: "bad" } }, { name: "bind_house", input: { account: "DEMO-H002", name: "演示住户B", phone: "13800000000", idempotencyKey: "bad" } }, { name: "approve_application", input: { status: "approved" } }]) assert.equal(operationSchema.safeParse(raw).success, false);
  const f = await fixture();
  try {
    const result = z.object({ answers: z.array(z.object({ answer: z.string() }).loose()) }).loose().parse(await f.service.execute(f.session.actor, { name: "query_policy", input: { question: "哈尔滨的政府补贴具体是多少？" } }));
    assert.ok(result.answers[0].answer.includes("演示资料未包含"));
  } finally { f.close(); }
});
