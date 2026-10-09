import { z } from "zod";
import { RequestHeatingStore } from "@/lib/works/heating/store";
import { HeatingService } from "@/lib/works/heating/service";
import { applicationSchema, billSchema, eventSchema, houseSchema, invoiceSchema, orderSchema, type Actor, type Operation } from "@/lib/works/heating/schema";

export async function fixture() {
  const store = new RequestHeatingStore();
  let now = Date.now();
  const clock = () => now;
  const service = new HeatingService(store, "test", clock);
  const session = await service.open();
  return { store, service, session, clock, advance(ms: number) { now += ms; }, close() {} };
}
export const recordsSchema = z.object({ houses: z.array(houseSchema), bills: z.array(billSchema), orders: z.array(orderSchema), applications: z.array(applicationSchema.loose()), invoices: z.array(invoiceSchema), events: z.array(eventSchema) }).loose();
export async function records(service: HeatingService, actor: Actor) { return recordsSchema.parse(await service.execute(actor, { name: "query_records", input: {} })); }
export async function confirm(service: HeatingService, actor: Actor, operation: Operation) {
  const card = await service.prepareConfirmation(actor, operation);
  return service.execute(actor, { ...operation, input: { ...operation.input, confirmationId: card.confirmationId } });
}
export async function draft(service: HeatingService, actor: Actor, houseId = `house-${actor.userId}`) {
  return applicationSchema.loose().parse(await service.execute(actor, { name: "create_draft", input: { houseId, year: "2026-2027", idempotencyKey: `draft-${houseId}` } }));
}
export const png = () => new File([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfS8AAAAASUVORK5CYII=", "base64")], "虚构演示材料.png", { type: "image/png" });
export async function materials(service: HeatingService, actor: Actor, applicationId: string) {
  await service.uploadMaterial(actor, applicationId, "ownership", png());
  await service.uploadMaterial(actor, applicationId, "construction", png());
}
export async function pay(service: HeatingService, actor: Actor, billId: string, key = "pay") {
  const order = orderSchema.parse(await confirm(service, actor, { name: "create_payment", input: { billId, idempotencyKey: `${key}-order` } }));
  return confirm(service, actor, { name: "simulate_payment", input: { orderId: order.id, outcome: "success", idempotencyKey: `${key}-success` } });
}
