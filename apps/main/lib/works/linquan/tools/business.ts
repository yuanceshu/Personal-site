import { pickupOrders } from "@/lib/works/linquan/data";
import { scenicSpotMap } from "@/lib/works/linquan/data";
import { pickupOrderInputSchema, staffHelpInputSchema } from "@/lib/works/linquan/schemas/domain";
import { pickupOrderOutputSchema, staffHelpOutputSchema } from "@/lib/works/linquan/schemas/tool";

export function pickupCreative(rawInput: unknown) {
  const input = pickupOrderInputSchema.parse(rawInput);
  const order = pickupOrders.find((item) => item.orderCode.toLowerCase() === input.orderCode.toLowerCase());
  if (!order) throw new Error("没有找到这个取货码，请确认是类似 LQ-2048 的 Demo 取货码。");
  if (order.status !== "ready") throw new Error(`订单 ${order.orderCode} 还在准备中，请稍后再来游客中心。`);
  return pickupOrderOutputSchema.parse({ success: true, orderCode: order.orderCode, itemName: order.itemName, pickupSpotId: order.pickupSpotId, message: `已为你保留 ${order.itemName}，请到林泉游客中心人工服务台出示取货码。` });
}

export function requestStaffHelp(rawInput: unknown) {
  const input = staffHelpInputSchema.parse(rawInput);
  if (!scenicSpotMap[input.currentSpotId]) throw new Error("当前位置不存在，无法创建人工求助单");
  return staffHelpOutputSchema.parse({ success: true, ticketId: `HELP-${Math.floor(1000 + Math.random() * 9000)}`, currentSpotId: input.currentSpotId, message: "已创建 Demo 人工求助单，工作人员会在当前位置附近联系你。紧急情况请先拨打景区现场电话。" });
}
