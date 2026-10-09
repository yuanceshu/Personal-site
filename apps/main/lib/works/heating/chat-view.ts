import type { z } from "zod";
import type { finalSchema, focusSchema, ProposalView, Records } from "./client-contract";
export type Focus = z.infer<typeof focusSchema>;
export type ChatReply = z.infer<typeof finalSchema>;
export type ChatEntry = { id: string; role: "user" | "assistant"; content: string; records?: Records; focus?: Focus; mode?: ChatReply["replyMode"]; proposal?: ProposalView | null; outcome?: string };
export const emptyFocus = (): Focus => ({ houseIds: [], billIds: [], applicationIds: [], invoiceIds: [] });
/** Evidence references only; bootstrap query_records must never reveal every bill. */
export function replyFocus(reply: ChatReply, records: Records): Focus {
  const focus = structuredClone(reply.focus);
  const add = (key: keyof Focus, id: unknown) => { if (typeof id === "string" && !focus[key].includes(id)) focus[key].push(id); };
  for (const card of reply.cards.filter(card => card.name !== "query_records" && card.name !== "query_policy")) {
    add("houseIds", card.input.houseId); add("billIds", card.input.billId); add("applicationIds", card.input.applicationId); add("invoiceIds", card.input.invoiceId);
    // Old Agent versions may omit focus. Only exact structured identifiers are used;
    // amounts, statuses and names always come from the validated snapshot.
    const visit = (value: unknown) => {
      if (Array.isArray(value)) { value.forEach(visit); return; }
      if (!value || typeof value !== "object") return;
      const object = value as Record<string, unknown>;
      for (const bill of records.bills) if (object.id === bill.id || object.billId === bill.id) add("billIds", bill.id);
      for (const app of records.applications) if (object.id === app.id || object.applicationId === app.id) add("applicationIds", app.id);
      for (const invoice of records.invoices) if (object.id === invoice.id || object.invoiceId === invoice.id) add("invoiceIds", invoice.id);
      Object.values(object).forEach(visit);
    };
    if (!Object.values(reply.focus).some(ids => ids.length)) visit(card.result);
  }
  if (reply.proposal) mergeOperationFocus(focus, reply.proposal.operation.input, records);
  for (const invoice of records.invoices) if (focus.invoiceIds.includes(invoice.id)) add("billIds", invoice.billId);
  return { houseIds: focus.houseIds.filter(id => records.houses.some(h => h.id === id)).slice(0,8), billIds: focus.billIds.filter(id => records.bills.some(b => b.id === id)).slice(0,8), applicationIds: focus.applicationIds.filter(id => records.applications.some(a => a.id === id)).slice(0,8), invoiceIds: focus.invoiceIds.filter(id => records.invoices.some(i => i.id === id)).slice(0,8) };
}
export function mergeOperationFocus(focus: Focus, input: Record<string, unknown>, records: Records) {
  const order = records.orders.find(o => o.id === input.orderId);
  const bill = records.bills.find(b => b.id === input.billId || b.id === order?.billId);
  const app = records.applications.find(a => a.id === input.applicationId);
  if (bill) { focus.billIds = [bill.id]; if (bill.applicationId) focus.applicationIds = [bill.applicationId]; }
  if (app) focus.applicationIds = [app.id];
  if (typeof input.houseId === "string") focus.houseIds = [input.houseId];
}
export function confirmedFocus(before: Records | undefined, after: Records, proposal: ProposalView): Focus {
  const focus = emptyFocus(); mergeOperationFocus(focus, proposal.operation.input, after);
  for (const app of after.applications) if (!before?.applications.some(a => a.id === app.id)) focus.applicationIds.push(app.id);
  for (const bill of after.bills) if (!before?.bills.some(b => b.id === bill.id)) focus.billIds.push(bill.id);
  if (proposal.operation.name === "bind_house") focus.houseIds = after.houses.map(h => h.id);
  return focus;
}
