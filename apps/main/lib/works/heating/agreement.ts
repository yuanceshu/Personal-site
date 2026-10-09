import { z } from "zod";
import { idSchema, yearSchema, type Bill, type HeatingState } from "./schema";

export const AGREEMENT_VERSION = "demo-2026-v1";
export const agreementSchema = z.object({ billId: idSchema, version: z.string().max(40), contentHash: z.string().regex(/^[a-f0-9]{64}$/), title: z.string(), year: yearSchema, kind: z.enum(["heating", "disconnection"]), address: z.string(), areaHundredths: z.number().int().positive(), amountCents: z.number().int().nonnegative(), clauses: z.array(z.string()).max(8), signedAt: z.string().datetime().optional(), source: z.enum(["handwritten_demo", "preset_demo"]).optional(), demo: z.literal(true) }).strict();
export type Agreement = z.infer<typeof agreementSchema>;
export const signatureSchema = z.array(z.array(z.tuple([z.number().finite().min(0).max(1), z.number().finite().min(0).max(1)])).min(2).max(2048)).min(1).max(64).superRefine((strokes, ctx) => {
  if (strokes.reduce((n, stroke) => n + stroke.length, 0) > 2048) ctx.addIssue({ code: "custom", message: "笔迹过多，请清除重签" });
  const distance = strokes.reduce((sum, stroke) => sum + stroke.slice(1).reduce((length, point, index) => length + Math.hypot(point[0] - stroke[index][0], point[1] - stroke[index][1]), 0), 0);
  if (distance < 0.08) ctx.addIssue({ code: "custom", message: "请在签名区域写下演示笔迹" });
});
export type Signature = z.infer<typeof signatureSchema>;
export const signAgreementInputSchema = z.object({ proposalId: z.string().uuid(), version: z.string().max(40), signature: signatureSchema, idempotencyKey: z.string().uuid() }).strict();
/** Fixed fictional clauses, with all variable fields resolved by TypeScript business records. */
export function agreementContent(bill: Bill, house: HeatingState["houses"][number]) {
  return {
    billId: bill.id, version: AGREEMENT_VERSION, title: bill.kind === "heating" ? "供暖服务协议（演示）" : "断暖服务与费用协议（演示）", year: bill.year, kind: bill.kind,
    address: house.address, areaHundredths: house.areaHundredths, amountCents: bill.amountCents,
    clauses: [
      `本协议仅用于虚构和煦供暖售前演示，办理房屋为${house.address}，年度为${bill.year}，计费面积为${house.areaHundredths / 100}平方米。`,
      `本次${bill.kind === "heating" ? "供暖" : "断暖基础"}费用为人民币${(bill.amountCents / 100).toFixed(2)}元，以本次核实账单为准；本演示不收取真实资金。`,
      bill.kind === "heating" ? "演示供暖期为11月15日至次年3月15日。服务内容、供暖质量和双方责任仅用于流程展示，不代表任何地方正式服务承诺。" : "本次断暖申请以模拟审核通过的工单为准。断暖基础费用按演示规则计收，模拟支付完成后显示业务办结，不执行真实停暖施工。",
      "住户可在对话中查询办理状态及模拟票据。支付失败或取消不代表已缴清，可继续办理；服务方仅展示虚构业务状态。",
      "手写笔迹仅用于本次模拟签署校验，不进行身份认证或司法存证，不具备真实电子合同效力。请勿使用真实签名；刷新页面即清除本次签署及业务数据。",
    ], demo: true as const,
  };
}
