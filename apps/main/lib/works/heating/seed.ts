import { createHash, randomUUID } from "node:crypto";
import { agreementContent } from "./agreement";
import { stateSchema, type HeatingState, type UserId } from "./schema";

export const SANDBOX_TTL_SECONDS = 7 * 24 * 60 * 60;
export const demoPolicy = {
  id: "demo-policy-2026", year: "2026-2027" as const, label: "虚构的和煦供暖演示规则，不代表任何地方正式政策",
  unitPriceCents: 2500, disconnectionBasisPoints: 3500, requiredMaterials: ["ownership", "construction"] as const,
  reviewIntervalMs: 10_000,
  knowledge: [
    { topic: "供暖时间", keywords: ["供暖时间", "供暖期", "供暖期间", "时间", "期间", "几月", "几号", "什么时候供暖", "什么时候停暖", "开始烧", "开始供", "结束供"], answer: "本 Demo 的模拟供暖期为每年11月15日至次年3月15日，当前演示年度为2026—2027，不代表当地正式安排。" },
    { topic: "供暖费怎么算", keywords: ["供暖费", "暖气费", "收费", "费用", "计费", "面积", "单价", "多少钱", "费用怎么算"], answer: "本演示正常供暖费按系统登记的计费面积×每平方米25元计算。个人房屋面积、应缴金额及缴费状态必须查询业务记录，不能仅凭咨询内容确定。" },
    { topic: "房屋绑定与多套房屋", keywords: ["绑定", "户号", "手机号", "身份证", "多套", "多房", "两套", "第二套"], answer: "使用预设演示户号、演示姓名和模拟手机号（DEMO-PHONE-X）匹配房屋，不收集真实身份证或手机号，不需要人脸识别。一人多套房屋时分别办理，缴费或申请前需要明确目标房屋。" },
    { topic: "断暖条件与办理时间", keywords: ["断暖条件", "停暖条件", "报停条件", "条件", "申请条件", "办理时间", "截止", "期限", "没人住", "能不能断暖"], answer: "本供暖年度不需要供暖的房屋可申请断暖。演示暂不设置办理截止日期，是否可继续办理以查询到的当前业务状态为准；材料齐全并经用户确认后提审，两级模拟审核通过后再缴断暖费用。" },
    { topic: "断暖材料要求", keywords: ["材料", "资料", "证明", "合同", "照片", "断暖", "停暖", "报停"], answer: "断暖需要两类材料：房屋产权证明或合同、断暖施工照片。点击页面“模拟提交”登记预设材料，无需选择或上传真实文件。材料缺失时不能提交完整申请，实际是否齐全以业务记录为准。" },
    { topic: "审核进度与退回补件", keywords: ["审核", "进度", "补件", "补交", "退回", "审批", "工单"], answer: "本演示有两级模拟审核，查询时按固定时间推进本页状态。被退回后，按工单提示重新模拟提供指定材料，再明确确认提审，继续原工单，不新建申请。具体节点和退回原因必须查询工单，AI不能审批。" },
    { topic: "断暖费用怎么算", keywords: ["断暖费", "停暖费", "报停费", "比例", "35%", "为什么还", "断暖怎么收费"], answer: "本演示断暖费按正常供暖费的35%计算，由服务端确定金额；审核通过后才允许进入断暖缴费，模拟支付成功后才显示办结。这是演示规则，不代表地方正式政策。" },
    { topic: "缴费与模拟电子发票", keywords: ["缴费", "付款", "支付", "重复缴", "发票", "短信", "退费", "退款", "补贴", "优惠", "减免", "滞纳金"], answer: "缴费须由用户核对并确认，已缴账单不能重复缴费；模拟支付失败或取消不表示缴清。模拟支付成功后可查询站内模拟电子发票，不具备真实票据效力，不发送真实短信。演示资料未包含退费、补贴、优惠减免或滞纳金规则，也不提供这些办理能力。" },
    { topic: "暖气不热与维修", keywords: ["不热", "不暖", "维修", "报修", "漏水", "温控", "温度", "室温", "多少度", "太冷"], answer: "可先查看温控设置，观察有无漏水。漏水或持续不热时，请联系物业或供暖服务人员处理。本 Demo 不支持报修派单，也不承诺处理时限。演示资料未包含当地正式室温标准，请向当地供暖服务方核实。请勿自行拆卸供暖设备。" },
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
    agreements: [], orders: [], materials: [], applications: [], events: [], invoices: [], confirmations: [], receipts: [],
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
  const content = agreementContent(paidBill, houses.find(h => h.id === paidBill.houseId)!);
  state.agreements.push({ id: "agreement-E", userId: "E", billId: paidBill.id, houseId: paidBill.houseId, year: paidBill.year, kind: paidBill.kind, amountCents: paidBill.amountCents, version: content.version, contentHash: createHash("sha256").update(JSON.stringify(content)).digest("hex"), signedAt: at, source: "preset_demo" });
  state.orders.push({ id: "order-E", userId: "E", billId: paidBill.id, amountCents: paidBill.amountCents, status: "paid", createdAt: at, settledAt: at });
  state.invoices.push({ id: "invoice-E", userId: "E", orderId: "order-E", billId: paidBill.id, amountCents: paidBill.amountCents, label: "模拟发票", issuedAt: at });
  state.events.push({ id: "event-E", userId: "E", entityId: paidBill.id, entityType: "bill", from: "unpaid", to: "paid", reason: "预设模拟支付成功", at });
  return stateSchema.parse(state);
}
