import { expect, test } from "@playwright/test";
import { watchPage, pageSnapshot } from "./browser-client";

test("真实 H5 → Next SSE → Agno/MiniMax → TS Tool：缴费确认、发票和刷新重置", async ({ page }) => {
  watchPage(page); await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [], browserAuthorizations: boolean[] = [];
  page.on("pageerror", problem => errors.push(problem.name));
  page.on("request", request => { if (request.url().includes("/api/experiments/heating/")) browserAuthorizations.push(Boolean(request.headers().authorization)); });
  await page.addInitScript(() => {
    type Event = { tools: string[]; invoiceIds: string[]; error?: string };
    const observed = window as unknown as Window & { heatingTestEvents: Event[] };
    observed.heatingTestEvents = [];
    const fetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await fetch(...args);
      const target = args[0];
      const url = typeof target === "string" ? target : target instanceof Request ? target.url : target.toString();
      if (url.endsWith("/heating/chat")) {
        // A cloned test-only stream observes final evidence even when the UI cancels its reader.
        void response.clone().text().then(body => {
          for (const event of body.split("\n\n")) {
            if (!event.startsWith("event: final") && !event.startsWith("event: error")) continue;
            const value = JSON.parse(event.match(/^data: (.+)/m)?.[1] ?? "{}");
            observed.heatingTestEvents.push({ tools: value.usedTools ?? [], invoiceIds: value.focus?.invoiceIds ?? [], error: value.error });
          }
        }).catch(() => undefined);
      }
      return response;
    };
  });
  await page.goto("/works/demos/heating");
  const input = page.getByRole("textbox", { name: "说说您想办理什么" });
  async function ready() { await expect(input).toBeEnabled({ timeout: 30000 }); await expect(page.locator(".heat-wait")).toHaveCount(0, { timeout: 100000 }); }
  await ready(); await expect(page.getByTestId("bill-card")).toHaveCount(0);
  await page.screenshot({ path: "test-results/heating/live-mobile-home.png", fullPage: false });
  async function ask(text: string) { await input.fill(text); await page.getByRole("button", { name: /^发送/ }).click(); await ready(); }
  await ask("我想交今年的暖气费。");
  const order = page.getByRole("button", { name: "确认账单，去付款", exact: true }).last();
  if (!(await order.count())) await ask("请继续为我这套已绑定的房屋办理今年供暖缴费，生成待确认的缴费订单。执行前由我点击确认。");
  await expect(order).toBeVisible(); await order.click(); await ready();
  const pay = page.getByRole("button", { name: "确认模拟支付", exact: true }).last();
  if (!(await pay.count())) await ask("请为刚才的待支付订单准备模拟支付成功的确认卡片。我会另行点击确认。");
  await expect(pay).toBeVisible(); await pay.click(); await ready();
  await expect(page.getByTestId("bill-card").last()).toContainText("已缴费");
  await page.getByRole("button", { name: "查看模拟电子发票" }).last().click(); await expect(page.getByRole("dialog")).toContainText("不具备真实票据效力"); await page.getByRole("button", { name: "关闭", exact: true }).click();
  const state = await pageSnapshot(page);
  expect(state.records.orders).toHaveLength(1); expect(state.records.invoices).toHaveLength(1); expect(state.records.bills[0].status).toBe("paid"); expect(errors).toHaveLength(0); expect(browserAuthorizations.every(value => !value)).toBe(true);
  await page.screenshot({ path: "test-results/heating/live-mobile-paid.png", fullPage: false });
  await ask("刚刚支付成功了吗？发票在哪？"); await expect(page.locator(".heat-error")).toHaveCount(0); await expect(page.getByTestId("bill-card").last()).toContainText("已缴费");
  await expect.poll(() => page.evaluate(() => {
    const observed = window as unknown as Window & { heatingTestEvents: { tools: string[]; invoiceIds: string[]; error?: string }[] };
    return observed.heatingTestEvents.some(reply => reply.tools.includes("query_invoice") || reply.invoiceIds.length > 0);
  })).toBe(true);
  await page.reload(); await ready(); const fresh = await pageSnapshot(page); expect(fresh.records.orders).toHaveLength(0); expect(fresh.records.invoices).toHaveLength(0); expect(fresh.conversation.history).toHaveLength(0); await expect(page.locator(".heat-message")).toHaveCount(0);
});
