import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { agreementContent, signatureSchema, type Signature } from "./agreement";
import { HeatingError } from "./errors";
import { createSeed, SANDBOX_TTL_SECONDS } from "./seed";
import { assertApplicationTransition, assertConsistent } from "./state-machine";
import { confirmationNames, idSchema, materialTypeSchema, simulatedMaterialInputSchema, operationSchema, stateSchema, userIdSchema, type Actor, type Application, type ApplicationStatus, type Bill, type HeatingBusinessAdapter, type HeatingState, type Operation, type MaterialType } from "./schema";
import type { HeatingStore } from "./store";

const nowISO = (now: number) => new Date(now).toISOString();
const newId = (prefix: string) => `${prefix}-${randomUUID()}`;
const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const namespaceSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/);

export class HeatingService implements HeatingBusinessAdapter {
  private namespace: string;
  constructor(private store: HeatingStore, namespace = "local", private clock = Date.now) { this.namespace = namespaceSchema.parse(namespace); }
  private key(sandboxId: string) { return `heating:${this.namespace}:sandbox:${z.string().uuid().parse(sandboxId)}`; }
  private actor(state: HeatingState, sandboxId: string): Actor { return { sandboxId, userId: state.activeUserId, identityVersion: state.identityVersion, generation: state.generation }; }
  private validateActor(state: HeatingState, actor: Actor) {
    if (state.activeUserId !== actor.userId || state.identityVersion !== actor.identityVersion || state.generation !== actor.generation) throw new HeatingError("identity_changed", 409);
  }
  private async transaction<T>(sandboxId: string, actor: Actor | undefined, run: (state: HeatingState, now: number) => T): Promise<T> {
    const key = this.key(sandboxId);
    for (let attempt = 0; attempt < 16; attempt++) {
      const current = await this.store.read(key);
      if (!current) throw new HeatingError("session_expired", 401);
      const state = stateSchema.parse(JSON.parse(current));
      const now = this.clock();
      if (Date.parse(state.expiresAt) <= now) throw new HeatingError("session_expired", 401);
      assertConsistent(state);
      if (actor) this.validateActor(state, actor);
      const result = run(state, now);
      state.confirmations = state.confirmations.filter(c => Date.parse(c.expiresAt) > now);
      assertConsistent(state);
      const next = JSON.stringify(stateSchema.parse(state));
      if (Buffer.byteLength(next) > 2 * 1024 * 1024) throw new HeatingError("sandbox_capacity", 413);
      // Validate reads atomically too: a concurrent identity switch or a stale snapshot
      // must not return an old user's records. Read-only transactions still CAS the snapshot.
      if (await this.store.compareAndSwap(key, current, next, Math.max(1, Math.ceil((Date.parse(state.expiresAt) - now) / 1000)))) return result;
    }
    throw new HeatingError("concurrent_retry", 409);
  }
  async open(sandboxId?: string) {
    if (sandboxId) return this.transaction(sandboxId, undefined, state => this.sessionView(state, sandboxId));
    const id = randomUUID();
    const state = createSeed(new Date(this.clock()));
    assertConsistent(state);
    if (!await this.store.compareAndSwap(this.key(id), null, JSON.stringify(state), SANDBOX_TTL_SECONDS)) throw new HeatingError("concurrent_retry");
    return this.sessionView(state, id);
  }
  private sessionView(state: HeatingState, sandboxId: string) {
    return { actor: this.actor(state, sandboxId), identities: state.users, profile: state.users.find(u => u.id === state.activeUserId), demo: true, expiresAt: state.expiresAt, materialStorage: "仅保存元数据和模拟占位，不保存原始文件" };
  }
  private agreementView(state: HeatingState, actor: Actor, bill: Bill) {
    const house = this.house(state, actor, bill.houseId);
    const content = agreementContent(bill, house);
    const contentHash = fingerprint(content);
    const signed = state.agreements.find(a => a.userId === actor.userId && a.billId === bill.id && a.contentHash === contentHash && a.version === content.version);
    return { ...content, contentHash, ...(signed ? { signedAt: signed.signedAt, source: signed.source } : {}) };
  }
  private requireAgreement(state: HeatingState, actor: Actor, bill: Bill) {
    if (!this.agreementView(state, actor, bill).signedAt) throw new HeatingError("agreement_required", 403);
  }
  async signAgreement(actor: Actor, billId: string, version: string, contentHash: string, signature: Signature) {
    signatureSchema.parse(signature); // Validate then discard strokes: never retain or send to the model.
    return this.transaction(actor.sandboxId, actor, (state, now) => {
      const bill = this.owned(state.bills, actor, billId);
      const agreement = this.agreementView(state, actor, bill);
      if (agreement.version !== version || agreement.contentHash !== contentHash) throw new HeatingError("agreement_changed", 409);
      if (bill.status === "paid") throw new HeatingError("bill_already_paid", 409);
      if (!agreement.signedAt) {
        state.agreements = state.agreements.filter(a => !(a.userId === actor.userId && a.billId === billId));
        state.agreements.push({ id: newId("agreement"), userId: actor.userId, billId, houseId: bill.houseId, year: bill.year, kind: bill.kind, amountCents: bill.amountCents, version, contentHash, signedAt: nowISO(now), source: "handwritten_demo" });
      }
      return this.agreementView(state, actor, bill);
    });
  }
  async switchIdentity(actor: Actor, userId: unknown) {
    const nextUser = userIdSchema.parse(userId);
    return this.transaction(actor.sandboxId, actor, state => {
      state.activeUserId = nextUser;
      state.identityVersion++;
      state.confirmations = [];
      return this.sessionView(state, actor.sandboxId);
    });
  }
  async reset(actor: Actor) {
    return this.transaction(actor.sandboxId, actor, state => {
      const seed = createSeed(new Date(this.clock()));
      seed.identityVersion = state.identityVersion + 1;
      Object.assign(state, seed);
      return this.sessionView(state, actor.sandboxId);
    });
  }
  private event(state: HeatingState, actor: Actor, entityType: HeatingState["events"][number]["entityType"], entityId: string, from: string, to: string, reason: string, now: number) {
    state.events.push({ id: newId("event"), userId: actor.userId, entityType, entityId, from, to, reason, at: nowISO(now) });
  }
  private house(state: HeatingState, actor: Actor, houseId: string) {
    const house = state.houses.find(h => h.id === houseId && h.ownerId === actor.userId);
    if (!house || !state.bindings.some(b => b.houseId === houseId && b.userId === actor.userId)) throw new HeatingError("house_not_bound", 404);
    return house;
  }
  private owned<T extends { id: string; userId: string }>(records: T[], actor: Actor, id: string): T {
    const record = records.find(r => r.id === id && r.userId === actor.userId);
    if (!record) throw new HeatingError("record_not_found", 404);
    return record;
  }
  private applicationTransition(state: HeatingState, actor: Actor, application: Application, to: ApplicationStatus, reason: string, now: number) {
    assertApplicationTransition(application.status, to);
    this.event(state, actor, "application", application.id, application.status, to, reason, now);
    application.status = to;
  }
  private billTransition(state: HeatingState, actor: Actor, bill: Bill, to: Bill["status"], reason: string, now: number) {
    const allowed: Record<Bill["status"], Bill["status"][]> = { unpaid: ["payment_pending"], payment_pending: ["unpaid", "paid"], paid: [] };
    if (!allowed[bill.status].includes(to)) throw new HeatingError("invalid_bill_transition");
    this.event(state, actor, "bill", bill.id, bill.status, to, reason, now);
    bill.status = to;
  }
  private advanceReview(state: HeatingState, actor: Actor, application: Application, now: number) {
    // Polling can catch up elapsed steps; identical-time requests cannot advance faster.
    while (application.nextReviewAt && Date.parse(application.nextReviewAt) <= now) {
      const at = Date.parse(application.nextReviewAt);
      let next: ApplicationStatus;
      if (["submitted", "resubmitted"].includes(application.status)) next = "review_level_1";
      else if (application.status === "review_level_1") next = application.reviewScenario === "supplement_once" && !application.returnedOnce ? "needs_more_materials" : "review_level_2";
      else if (application.status === "review_level_2") next = "approved";
      else throw new HeatingError("invalid_review_state", 503);
      this.applicationTransition(state, actor, application, next, next === "needs_more_materials" ? "预设模拟退回：请模拟提交断暖施工照片补件；不是图像审核结论" : "按演示时间规则推进两级审核", at);
      if (next === "needs_more_materials") {
        application.returnedOnce = true;
        application.requiredReplacements = ["construction"];
        application.returnedMaterialIds = state.materials.filter(m => m.applicationId === application.id && m.type === "construction").map(m => m.id);
        delete application.nextReviewAt;
      } else if (next === "approved") delete application.nextReviewAt;
      else application.nextReviewAt = nowISO(at + state.policy.reviewIntervalMs);
    }
  }
  private applicationView(state: HeatingState, application: Application) {
    return { ...application, materials: state.materials.filter(m => m.applicationId === application.id), events: state.events.filter(e => e.entityId === application.id), nextStep: application.status === "approved" ? "审核已通过，需创建并缴纳断暖费用，尚未办结" : application.status === "fee_paid" ? "演示断暖业务已办结" : application.status === "needs_more_materials" ? "模拟提交指定补件后确认重新提审" : "按当前节点继续办理（演示环境）" };
  }
  private checkMaterials(state: HeatingState, application: Application) {
    const materials = state.materials.filter(m => m.applicationId === application.id && m.userId === application.userId);
    if (!state.policy.requiredMaterials.every(type => materials.some(m => m.type === type))) throw new HeatingError("materials_incomplete", 422);
    if (!application.requiredReplacements.every(type => materials.some(m => m.type === type && !application.returnedMaterialIds.includes(m.id)))) throw new HeatingError("replacement_required", 422);
  }
  private withoutConfirmation(operation: Operation) {
    const input = { ...operation.input } as Record<string, unknown>;
    delete input.confirmationId;
    return { name: operation.name, input };
  }
  async prepareConfirmation(actor: Actor, raw: unknown) {
    const operation = operationSchema.parse(raw);
    if (!(confirmationNames as readonly string[]).includes(operation.name)) throw new HeatingError("confirmation_not_required", 400);
    return this.transaction(actor.sandboxId, actor, (state, now) => {
      const action = this.withoutConfirmation(operation);
      // A payment/submit card is prepared against the exact current records and material list.
      const binding = this.confirmationBinding(state, actor, operation);
      const id = newId("confirmation");
      const expiresAt = nowISO(now + 5 * 60000);
      if (state.confirmations.length >= 50) throw new HeatingError("too_many_confirmations", 429);
      state.confirmations.push({ id, fingerprint: fingerprint({ action, binding }), identityVersion: actor.identityVersion, expiresAt });
      return { confirmationId: id, expiresAt, operation: action, summary: binding, demo: true };
    });
  }
  private confirmationBinding(state: HeatingState, actor: Actor, operation: Operation): unknown {
    switch (operation.name) {
      case "create_payment": {
        const bill = this.owned(state.bills, actor, operation.input.billId);
        this.house(state, actor, bill.houseId);
        const { signedAt: _at, source: _source, ...agreement } = this.agreementView(state, actor, bill);
        void _at; void _source;
        return { bill, house: state.houses.find(h => h.id === bill.houseId), policy: state.policy.id, agreement };
      }
      case "simulate_payment": {
        const order = this.owned(state.orders, actor, operation.input.orderId);
        return { order, bill: this.owned(state.bills, actor, order.billId) };
      }
      case "submit_application": case "resubmit_application": {
        const application = this.owned(state.applications, actor, operation.input.applicationId);
        return { application, materialIds: state.materials.filter(m => m.applicationId === application.id).map(m => m.id), house: this.house(state, actor, application.houseId) };
      }
      case "bind_house": return { user: state.users.find(u => u.id === actor.userId), account: operation.input.account };
      default: throw new HeatingError("confirmation_not_required", 400);
    }
  }
  private consumeConfirmation(state: HeatingState, actor: Actor, operation: Operation, now: number) {
    if (!(confirmationNames as readonly string[]).includes(operation.name)) return;
    const confirmationId = "confirmationId" in operation.input ? operation.input.confirmationId : undefined;
    const index = state.confirmations.findIndex(c => c.id === confirmationId);
    const confirmation = state.confirmations[index];
    if (!confirmation || confirmation.identityVersion !== actor.identityVersion || Date.parse(confirmation.expiresAt) <= now || confirmation.fingerprint !== fingerprint({ action: this.withoutConfirmation(operation), binding: this.confirmationBinding(state, actor, operation) })) throw new HeatingError("confirmation_required", 403);
    state.confirmations.splice(index, 1);
  }
  async execute(actor: Actor, raw: unknown): Promise<unknown> {
    const operation = operationSchema.parse(raw);
    return this.transaction(actor.sandboxId, actor, (state, now) => {
      let receiptKey: string | undefined;
      const signature = fingerprint(this.withoutConfirmation(operation));
      if ("idempotencyKey" in operation.input) {
        receiptKey = `${actor.userId}:${actor.identityVersion}:${operation.name}:${operation.input.idempotencyKey}`;
        const receipt = state.receipts.find(r => r.key === receiptKey);
        if (receipt) {
          if (receipt.fingerprint !== signature) throw new HeatingError("idempotency_conflict");
          return receipt.result;
        }
        if (state.receipts.length >= 2000) throw new HeatingError("sandbox_capacity", 413);
      }
      this.consumeConfirmation(state, actor, operation, now);
      const result = this.run(state, actor, operation, now);
      if (receiptKey) state.receipts.push({ key: receiptKey, fingerprint: signature, result });
      return result;
    });
  }
  /** Validate a proposal with the same business code on a discarded copy. No write is executed. */
  async preview(actor: Actor, raw: unknown): Promise<unknown> {
    const operation = operationSchema.parse(raw);
    return this.transaction(actor.sandboxId, actor, (state, now) => {
      const copy = structuredClone(state);
      const result = this.run(copy, actor, operation, now, true);
      assertConsistent(copy);
      return result;
    });
  }
  private run(state: HeatingState, actor: Actor, operation: Operation, now: number, preview = false): unknown {
    switch (operation.name) {
      case "list_houses": return state.bindings.filter(b => b.userId === actor.userId).map(b => this.house(state, actor, b.houseId));
      case "query_policy": {
        const question = operation.input.question.replace(/\s+/g, "");
        const matches = state.policy.knowledge.filter(k => k.keywords.some(word => question.includes(word)));
        const wantsDirectory = /^(?:你好[，,！!。]?|请问|我想|想|我要|要|帮我|请|了解一下|了解|咨询一下|咨询|问一下|问问|问|一下|看看|看|关于|供暖|暖气|的|演示|模拟|政策|规则|规定|知识|目录|有哪些|有什么|哪些|什么|可以|能|回答|问题|内容|[，,。？！?!：:])*$/u.test(question);
        const answers = wantsDirectory
          ? [{ topic: "政策咨询目录", answer: `您想了解哪方面？可以直接说，也可以告诉我序号：\n${state.policy.knowledge.map((item, index) => `${index + 1}. ${item.topic}`).join("\n")}\n以上为本 Demo 的模拟规则，不代表当地正式政策。` }]
          : matches.length ? matches : [{ topic: "未收录", answer: "演示资料未包含这项规定。您可以问“有哪些政策”查看可咨询的内容，请勿将演示规则作为当地正式政策。" }];
        return { policyId: state.policy.id, label: state.policy.label, requiredMaterials: state.policy.requiredMaterials, rules: { unitPriceCents: state.policy.unitPriceCents, disconnectionBasisPoints: state.policy.disconnectionBasisPoints }, answers };
      }
      case "query_records": {
        state.applications.filter(a => a.userId === actor.userId).forEach(a => this.advanceReview(state, actor, a, now));
        return { profile: state.users.find(u => u.id === actor.userId), houses: state.bindings.filter(b => b.userId === actor.userId).map(b => this.house(state, actor, b.houseId)), bills: state.bills.filter(b => b.userId === actor.userId && state.bindings.some(binding => binding.userId === actor.userId && binding.houseId === b.houseId)), agreements: state.bills.filter(b => b.userId === actor.userId && state.bindings.some(binding => binding.userId === actor.userId && binding.houseId === b.houseId)).map(b => this.agreementView(state, actor, b)), orders: state.orders.filter(o => o.userId === actor.userId), applications: state.applications.filter(a => a.userId === actor.userId).map(a => this.applicationView(state, a)), invoices: state.invoices.filter(i => i.userId === actor.userId), events: state.events.filter(e => e.userId === actor.userId), demo: true };
      }
      case "query_bill": {
        const house = this.house(state, actor, operation.input.houseId);
        const application = state.applications.find(a => a.userId === actor.userId && a.houseId === house.id && a.year === operation.input.year);
        return { house, bills: state.bills.filter(b => b.userId === actor.userId && b.houseId === house.id && b.year === operation.input.year), blockedByApplication: application && application.status !== "draft" ? application.id : null, demo: true };
      }
      case "query_application": {
        const application = this.owned(state.applications, actor, operation.input.applicationId);
        this.advanceReview(state, actor, application, now);
        return this.applicationView(state, application);
      }
      case "query_invoice": return { ...this.owned(state.invoices, actor, operation.input.invoiceId), notice: "模拟发票，不具备真实票据效力；没有发送真实短信" };
      case "bind_house": {
        const input = operation.input;
        const user = state.users.find(u => u.id === actor.userId)!;
        const house = state.houses.find(h => h.account === input.account && h.ownerId === actor.userId);
        if (!house || user.name !== input.name || user.phone !== input.phone) throw new HeatingError("demo_identity_mismatch", 422);
        if (!state.bindings.some(b => b.houseId === house.id && b.userId === actor.userId)) {
          state.bindings.push({ houseId: house.id, userId: actor.userId });
          this.event(state, actor, "binding", house.id, "unbound", "bound", "匹配虚构演示身份并绑定", now);
        }
        return house;
      }
      case "create_draft": {
        const { houseId, year } = operation.input;
        this.house(state, actor, houseId);
        const bill = state.bills.find(b => b.houseId === houseId && b.year === year && b.kind === "heating")!;
        if (bill.status !== "unpaid") throw new HeatingError("heating_payment_conflict");
        const existing = state.applications.find(a => a.userId === actor.userId && a.houseId === houseId && a.year === year);
        if (existing) return this.applicationView(state, existing);
        const application: Application = { id: newId("application"), userId: actor.userId, houseId, year, status: "draft", createdAt: nowISO(now), reviewScenario: houseId === "house-F2" ? "supplement_once" : "approve", returnedOnce: false, requiredReplacements: [], returnedMaterialIds: [] };
        state.applications.push(application);
        this.event(state, actor, "application", application.id, "none", "draft", "建立演示断暖草稿，尚未提交", now);
        return this.applicationView(state, application);
      }
      case "submit_application": case "resubmit_application": {
        const application = this.owned(state.applications, actor, operation.input.applicationId);
        const expected = operation.name === "submit_application" ? "draft" : "needs_more_materials";
        if (application.status !== expected) throw new HeatingError("application_already_submitted");
        const bill = state.bills.find(b => b.houseId === application.houseId && b.year === application.year && b.kind === "heating")!;
        if (bill.status !== "unpaid") throw new HeatingError("heating_payment_conflict");
        this.checkMaterials(state, application);
        this.applicationTransition(state, actor, application, expected === "draft" ? "submitted" : "resubmitted", "用户确认材料摘要并提交（模拟）", now);
        application.submittedAt = nowISO(now);
        application.nextReviewAt = nowISO(now + state.policy.reviewIntervalMs);
        application.requiredReplacements = [];
        return this.applicationView(state, application);
      }
      case "create_payment": {
        const bill = this.owned(state.bills, actor, operation.input.billId);
        this.house(state, actor, bill.houseId);
        if (bill.status === "paid") throw new HeatingError("bill_already_paid");
        if (bill.kind === "heating" && state.applications.some(a => a.userId === actor.userId && a.houseId === bill.houseId && a.year === bill.year && a.status !== "draft")) throw new HeatingError("disconnection_conflict");
        if (bill.kind === "disconnection") {
          const application = this.owned(state.applications, actor, bill.applicationId!);
          if (application.status !== "fee_pending") throw new HeatingError("approval_required");
        }
        if (!preview) this.requireAgreement(state, actor, bill);
        const existing = state.orders.find(o => o.billId === bill.id && o.status === "pending");
        if (existing) return existing;
        const order = { id: newId("order"), userId: actor.userId, billId: bill.id, amountCents: bill.amountCents, status: "pending" as const, createdAt: nowISO(now) };
        state.orders.push(order);
        this.billTransition(state, actor, bill, "payment_pending", "用户确认创建模拟支付订单", now);
        this.event(state, actor, "order", order.id, "none", "pending", "创建模拟订单", now);
        return order;
      }
      case "simulate_payment": {
        const order = this.owned(state.orders, actor, operation.input.orderId);
        const bill = this.owned(state.bills, actor, order.billId);
        if (!preview) this.requireAgreement(state, actor, bill);
        if (order.status === "paid") return { order, bill, invoice: state.invoices.find(i => i.orderId === order.id), simulatedSms: "模拟通知记录，无真实短信发送" };
        if (order.status !== "pending" || bill.status !== "payment_pending" || bill.amountCents !== order.amountCents) throw new HeatingError("payment_not_pending");
        const next = operation.input.outcome === "success" ? "paid" : operation.input.outcome === "failure" ? "failed" : "cancelled";
        this.event(state, actor, "order", order.id, order.status, next, "确定性模拟支付接口返回结果", now);
        order.status = next;
        order.settledAt = nowISO(now);
        this.billTransition(state, actor, bill, next === "paid" ? "paid" : "unpaid", `模拟支付${next}`, now);
        if (next !== "paid") return { order, bill, invoice: null };
        const invoice = { id: newId("invoice"), userId: actor.userId, orderId: order.id, billId: bill.id, amountCents: bill.amountCents, label: "模拟发票" as const, issuedAt: nowISO(now) };
        state.invoices.push(invoice);
        if (bill.kind === "disconnection") this.applicationTransition(state, actor, this.owned(state.applications, actor, bill.applicationId!), "fee_paid", "断暖费用模拟支付成功，演示办结", now);
        return { order, bill, invoice, simulatedSms: "模拟通知记录，无真实短信发送" };
      }
    }
  }
  async createDisconnectionBill(actor: Actor, applicationId: unknown) {
    const id = idSchema.parse(applicationId);
    return this.transaction(actor.sandboxId, actor, (state, now) => {
      const application = this.owned(state.applications, actor, id);
      this.advanceReview(state, actor, application, now);
      if (application.feeBillId) return this.owned(state.bills, actor, application.feeBillId);
      if (application.status !== "approved") throw new HeatingError("approval_required");
      const house = this.house(state, actor, application.houseId);
      const normalAmount = Math.round(house.areaHundredths * state.policy.unitPriceCents / 100);
      const bill: Bill = { id: newId("bill"), userId: actor.userId, houseId: house.id, year: application.year, kind: "disconnection", amountCents: Math.round(normalAmount * state.policy.disconnectionBasisPoints / 10000), unitPriceCents: state.policy.unitPriceCents, status: "unpaid", applicationId: application.id };
      state.bills.push(bill);
      application.feeBillId = bill.id;
      this.applicationTransition(state, actor, application, "fee_pending", "审核已通过，生成演示断暖费用账单，待缴费", now);
      this.event(state, actor, "bill", bill.id, "none", "unpaid", "按种子政策计算断暖费用", now);
      return bill;
    });
  }
  async uploadMaterial(actor: Actor, applicationId: unknown, type: unknown, file: File) {
    const id = idSchema.parse(applicationId);
    const materialType = materialTypeSchema.parse(type);
    if (!(file instanceof File) || file.size <= 0 || file.size > 5 * 1024 * 1024) throw new HeatingError("invalid_file_size", 422);
    const bytes = Buffer.from(await file.arrayBuffer());
    const valid = file.type === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && /\.png$/i.test(file.name)
      || file.type === "image/jpeg" && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) && /\.jpe?g$/i.test(file.name)
      || file.type === "application/pdf" && bytes.subarray(0, 5).toString() === "%PDF-" && /\.pdf$/i.test(file.name);
    if (!valid) throw new HeatingError("invalid_file_type", 422);
    const hash = createHash("sha256").update(bytes).digest("hex");
    // Only a display name is persisted; bytes are used for validation/hash and discarded.
    const fileName = file.name.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 160) || "演示材料";
    return this.transaction(actor.sandboxId, actor, (state, now) => this.registerMaterial(state, actor, id, materialType, { fileName, mime: file.type as "image/png" | "image/jpeg" | "application/pdf", size: file.size, sha256: hash }, now));
  }
  private registerMaterial(state: HeatingState, actor: Actor, id: string, materialType: MaterialType, metadata: Pick<HeatingState["materials"][number], "fileName" | "mime" | "size" | "sha256">, now: number) {
    const application = this.owned(state.applications, actor, id);
    if (!["draft", "needs_more_materials"].includes(application.status)) throw new HeatingError("materials_locked");
    const existing = state.materials.find(m => m.applicationId === id && m.type === materialType && m.sha256 === metadata.sha256 && !application.returnedMaterialIds.includes(m.id));
    if (existing) { existing.fileName = metadata.fileName; return existing; }
    if (state.materials.filter(m => m.applicationId === id).length >= 20) throw new HeatingError("too_many_materials", 413);
    const material = { id: newId("material"), userId: actor.userId, applicationId: id, type: materialType, ...metadata, storageMode: "demo_placeholder" as const, uploadedAt: nowISO(now) };
    state.materials.push(material);
    this.event(state, actor, "application", application.id, application.status, application.status, `登记${materialType}演示材料元数据与模拟占位（无原始文件存储）`, now);
    return material;
  }
  async simulateMaterial(actor: Actor, input: unknown) {
    const parsed = simulatedMaterialInputSchema.parse(input);
    return this.transaction(actor.sandboxId, actor, (state, now) => {
      const application = this.owned(state.applications, actor, parsed.applicationId);
      const receiptKey = `${actor.userId}:${actor.identityVersion}:simulate_material:${parsed.idempotencyKey}`;
      const signature = fingerprint(parsed);
      const receipt = state.receipts.find(r => r.key === receiptKey);
      if (receipt) {
        if (receipt.fingerprint !== signature) throw new HeatingError("idempotency_conflict");
        return receipt.result;
      }
      if (state.receipts.length >= 2000) throw new HeatingError("sandbox_capacity", 413);
      const returned = state.materials.filter(m => m.applicationId === application.id && m.type === parsed.type && application.returnedMaterialIds.includes(m.id)).map(m => m.id);
      const label = parsed.type === "ownership" ? "产权证明" : "断暖施工照片";
      // Metadata describes a synthetic placeholder, never an uploaded or reviewed file.
      const result = this.registerMaterial(state, actor, application.id, parsed.type, {
        fileName: `${label}（演示${returned.length ? "补件" : "材料"}）.${parsed.type === "ownership" ? "pdf" : "png"}`,
        mime: parsed.type === "ownership" ? "application/pdf" : "image/png", size: 1,
        sha256: fingerprint({ simulation: true, applicationId: application.id, type: parsed.type, returned }),
      }, now);
      state.receipts.push({ key: receiptKey, fingerprint: signature, result });
      return result;
    });
  }
  async material(actor: Actor, materialId: unknown) {
    const id = idSchema.parse(materialId);
    return this.transaction(actor.sandboxId, actor, state => this.owned(state.materials, actor, id));
  }
}
