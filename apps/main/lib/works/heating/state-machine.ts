import { HeatingError } from "./errors";
import type { ApplicationStatus, HeatingState } from "./schema";
const transitions: Record<ApplicationStatus, ApplicationStatus[]> = {
  draft: ["submitted"], submitted: ["review_level_1"], resubmitted: ["review_level_1"],
  review_level_1: ["review_level_2", "needs_more_materials"], review_level_2: ["approved", "needs_more_materials"],
  needs_more_materials: ["resubmitted"], approved: ["fee_pending"], fee_pending: ["fee_paid"], fee_paid: [],
};
export function assertApplicationTransition(from: ApplicationStatus, to: ApplicationStatus) {
  if (!transitions[from].includes(to)) throw new HeatingError("invalid_application_transition");
}
export function assertConsistent(state: HeatingState) {
  const fail = () => { throw new HeatingError("inconsistent_state", 503); };
  for (const records of [state.houses, state.bills, state.orders, state.applications, state.materials, state.invoices, state.events]) {
    if (new Set(records.map(r => r.id)).size !== records.length) fail();
  }
  for (const binding of state.bindings) if (!state.houses.some(h => h.id === binding.houseId && h.ownerId === binding.userId)) fail();
  if (new Set(state.bindings.map(b => b.houseId)).size !== state.bindings.length) fail();
  for (const bill of state.bills) {
    if (!state.houses.some(h => h.id === bill.houseId && h.ownerId === bill.userId)) fail();
    const pending = state.orders.filter(o => o.billId === bill.id && o.status === "pending");
    const paid = state.orders.filter(o => o.billId === bill.id && o.status === "paid");
    if (pending.length > 1 || paid.length > 1 || (bill.status === "payment_pending") !== (pending.length === 1) || (bill.status === "paid") !== (paid.length === 1)) fail();
    if (bill.kind === "disconnection" && !state.applications.some(a => a.id === bill.applicationId && a.feeBillId === bill.id && a.houseId === bill.houseId && a.userId === bill.userId && a.year === bill.year && ["fee_pending", "fee_paid"].includes(a.status))) fail();
  }
  const appKeys = state.applications.map(a => `${a.userId}:${a.houseId}:${a.year}`);
  const billKeys = state.bills.map(b => `${b.userId}:${b.houseId}:${b.year}:${b.kind}`);
  if (new Set(appKeys).size !== appKeys.length || new Set(billKeys).size !== billKeys.length) fail();
  for (const application of state.applications) {
    if (!state.bindings.some(b => b.userId === application.userId && b.houseId === application.houseId)) fail();
    const bill = state.bills.find(b => b.id === application.feeBillId);
    if (["fee_pending", "fee_paid"].includes(application.status) && (!bill || (application.status === "fee_paid") !== (bill.status === "paid"))) fail();
  }
  for (const order of state.orders) {
    if (!state.bills.some(b => b.id === order.billId && b.userId === order.userId && b.amountCents === order.amountCents)) fail();
    if ((order.status === "paid") !== (state.invoices.filter(i => i.orderId === order.id).length === 1)) fail();
  }
  for (const material of state.materials) if (!state.applications.some(a => a.id === material.applicationId && a.userId === material.userId)) fail();
  for (const invoice of state.invoices) if (!state.orders.some(o => o.id === invoice.orderId && o.userId === invoice.userId && o.billId === invoice.billId && o.amountCents === invoice.amountCents && o.status === "paid")) fail();
}
