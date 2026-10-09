import { randomUUID } from "node:crypto";
import { stateSchema, type HeatingState, type UserId } from "./schema";

export const SANDBOX_TTL_SECONDS = 7 * 24 * 60 * 60;
export const demoPolicy = {
  id: "demo-policy-2026", year: "2026-2027" as const, label: "虚构的和煦供暖演示规则，不代表任何地方正式政策",
  unitPriceCents: 2500, disconnectionBasisPoints: 3500, requiredMaterials: ["ownership", "construction"] as const,
  reviewIntervalMs: 10_000,
  knowledge: [
    { topic: "断暖材料", keywords: ["材料", "条件", "断暖", "停暖", "报停"], answer: "演示要求房屋产权证明或合同、断暖施工照片；点击“模拟提交”登记预设材料，无需选择或上传真实文件。两级模拟审核通过后再缴断暖费用，缴费后才显示演示办结。" },
    { topic: "收费规则", keywords: ["费", "面积", "比例", "单价"], answer: "本演示按种子计费面积和每平方米25元计算正常供暖费；断暖费按正常供暖费的35%计算。金额均由服务端计算；这些不是地方正式政策。" },
    { topic: "供暖期间", keywords: ["供暖期", "时间", "期间"], answer: "虚构演示年度为2026—2027，演示供暖期为11月15日至次年3月15日，不代表当地正式安排。" },
    { topic: "审核流程", keywords: ["审核", "进度", "补件"], answer: "演示有两级审核，查询时按固定时间推进本页状态。退回补件须更新同一工单并再次确认提审；AI不能审批。" },
    { topic: "模拟发票", keywords: ["发票", "短信"], answer: "模拟支付成功后生成站内模拟发票记录，不具备真实票据效力，也不发送真实短信。" },
  ],
};

export function createSeed(now: Date = new Date()): HeatingState {
  const at = now.toISOString();
  const labels = ["已绑定待缴", "首次绑定", "审核中", "需补件", "已缴费", "多套房屋"];
  const ids: UserId[] = ["A", "B", "C", "D", "E", "F"];
  const users = ids.map((id, index) => ({ id, name: `演示住户${id}`, phone: `DEMO-PHONE-${id}`, scenario: labels[index] }));
  const houses = ids.map((id, index) => ({ id: `house-${id}`, ownerId: id, account: `DEMO-H00${index + 1}`, address: `虚构和煦小区${index + 1}号楼101室（演示）`, areaHundredths: 8500 + index * 500 }));
  houses.push({ id: "house-F2", ownerId: "F", account: "DEMO-H007", address: "虚构和煦小区7号楼202室（演示）", areaHundredths: 7600 });
  const state: HeatingState = {
    schemaVersion: 1, generation: randomUUID(), activeUserId: "A", identityVersion: 0,
    expiresAt: new Date(now.getTime() + SANDBOX_TTL_SECONDS * 1000).toISOString(), users, houses,
    bindings: houses.filter(h => h.ownerId !== "B").map(h => ({ userId: h.ownerId, houseId: h.id })),
    bills: houses.map(h => ({ id: `bill-${h.id}`, userId: h.ownerId, houseId: h.id, year: "2026-2027", kind: "heating", amountCents: Math.round(h.areaHundredths * demoPolicy.unitPriceCents / 100), unitPriceCents: demoPolicy.unitPriceCents, status: h.ownerId === "E" ? "paid" : "unpaid" })),
    orders: [], materials: [], applications: [], events: [], invoices: [], confirmations: [], receipts: [],
    policy: { ...demoPolicy, requiredMaterials: [...demoPolicy.requiredMaterials] },
  };
  for (const userId of ["C", "D"] as const) {
    const appId = `application-${userId}`;
    state.applications.push({ id: appId, userId, houseId: `house-${userId}`, year: "2026-2027", status: userId === "C" ? "review_level_1" : "needs_more_materials", createdAt: at, submittedAt: at, ...(userId === "C" ? { nextReviewAt: new Date(now.getTime() + demoPolicy.reviewIntervalMs).toISOString() } : {}), reviewScenario: userId === "C" ? "approve" : "supplement_once", returnedOnce: userId === "D", requiredReplacements: userId === "D" ? ["construction"] : [], returnedMaterialIds: userId === "D" ? ["material-D-construction"] : [] });
    for (const type of demoPolicy.requiredMaterials) state.materials.push({ id: `material-${userId}-${type}`, userId, applicationId: appId, type, fileName: type === "ownership" ? "预设演示产权.png" : "预设演示施工.png", mime: "image/png", size: 68, sha256: "0".repeat(64), storageMode: "demo_placeholder", uploadedAt: at });
    const steps = userId === "C" ? ["draft", "submitted", "review_level_1"] : ["draft", "submitted", "review_level_1", "needs_more_materials"];
    steps.forEach((to, index) => state.events.push({ id: `event-${userId}-${index}`, userId, entityId: appId, entityType: "application", from: steps[index - 1] ?? "none", to, reason: to === "needs_more_materials" ? "预设模拟退回：请模拟提交断暖施工照片补件；不是图像审核结论" : "预设演示场景", at }));
  }
  const paidBill = state.bills.find(b => b.userId === "E")!;
  state.orders.push({ id: "order-E", userId: "E", billId: paidBill.id, amountCents: paidBill.amountCents, status: "paid", createdAt: at, settledAt: at });
  state.invoices.push({ id: "invoice-E", userId: "E", orderId: "order-E", billId: paidBill.id, amountCents: paidBill.amountCents, label: "模拟发票", issuedAt: at });
  state.events.push({ id: "event-E", userId: "E", entityId: paidBill.id, entityType: "bill", from: "unpaid", to: "paid", reason: "预设模拟支付成功", at });
  return stateSchema.parse(state);
}
