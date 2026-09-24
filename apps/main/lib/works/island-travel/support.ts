import type { Order } from "./domain";
import type { ProductOrder } from "./products";
import { containsIdentity } from "./schema";

export type SupportKind = "lost" | "feedback" | "human" | "accessibility";
export type SupportStatus = "submitted" | "processing" | "completed";
export type SupportTicket = { id: string; key: string; orderId: string; kind: SupportKind; description: string; status: SupportStatus };
export const supportLabels: Record<SupportKind, string> = { lost: "失物招领", feedback: "投诉建议", human: "人工协助", accessibility: "无障碍协助" };
export const supportStatusLabels: Record<SupportStatus, string> = { submitted: "模拟已提交", processing: "模拟处理中", completed: "模拟已完成" };
export const supportResults: Record<SupportKind, string> = {
  lost: "演示失物登记已完成；没有真实查找或寄送服务。",
  feedback: "演示意见已记录；没有提交给真实客服。",
  human: "演示人工协助工单已完成；没有接通真实客服。",
  accessibility: "演示无障碍需求已记录；没有安排真实工作人员。",
};

export function containsContactIdentity(value: string) {
  const compact = value.replace(/[\s+()（）-]/g, "");
  return containsIdentity(value) || /(?<!\d)1[3-9]\d{9}(?!\d)|(?<!\d)\d{17}[\dXx](?!\d)|(?<!\d)\d{15}(?!\d)/.test(compact);
}
export function submitSupport(tickets: SupportTicket[], orders: Order[], products: ProductOrder[], draft: { key: string; orderId: string; kind: SupportKind; description: string }, confirmed: boolean): SupportTicket[] {
  if (tickets.some(ticket => ticket.key === draft.key)) return tickets;
  if (!confirmed) throw new Error("请先核对并确认提交演示工单。");
  if (!orders.some(order => order.id === draft.orderId) && !products.some(order => order.id === draft.orderId)) throw new Error("关联订单不在当前会话中，请返回订单列表。");
  const description = draft.description.trim();
  if (!description || description.length > 500) throw new Error("描述须为 1–500 字。");
  if (containsContactIdentity(description)) throw new Error("请移除手机号、证件号码或住址，不要填写真实个人资料。");
  if (!(draft.kind in supportLabels)) throw new Error("请选择工单类别。");
  return [...tickets, { id: `DS-${String(tickets.length + 1).padStart(4, "0")}`, key: draft.key, orderId: draft.orderId, kind: draft.kind, description, status: "submitted" }];
}
export function advanceSupport(tickets: SupportTicket[], id: string, next: SupportStatus, confirmed: boolean): SupportTicket[] {
  if (!confirmed) throw new Error("请先确认模拟处理操作。");
  const ticket = tickets.find(item => item.id === id);
  if (!ticket) throw new Error("没有找到演示工单。");
  if (ticket.status === next) return tickets;
  if (!(ticket.status === "submitted" && next === "processing" || ticket.status === "processing" && next === "completed")) throw new Error("请按提交、处理中、完成的顺序体验。");
  return tickets.map(item => item.id === id ? { ...item, status: next } : item);
}
export function reminderTime(order: Order) {
  const [hour, minute] = order.trip.depart.split(":").map(Number);
  const utc = Date.parse(`${order.trip.date}T00:00:00Z`) + (hour * 60 + minute - 120) * 60000;
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "UTC", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(utc));
}
