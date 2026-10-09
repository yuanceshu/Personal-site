import { expect, test } from "@playwright/test";
import { watchPage, pageSnapshot, repeatConfirm, signInPage } from "./browser-client";

test.use({ actionTimeout: 30000 });

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
  await expect(page.getByRole("button", { name: "绑定房屋", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "房屋与费用", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/heating/live-mobile-home.png", fullPage: false });
  async function ask(text: string) { await input.fill(text); await page.getByRole("button", { name: /^发送/ }).click(); await ready(); }
  await ask("我想交今年的暖气费。");
  const order = page.getByRole("button", { name: "确认账单，去付款", exact: true }).last();
  if (!(await page.getByRole("button", { name: "手写签署", exact: true }).count()) && !(await order.count())) await ask("请继续为我这套已绑定的房屋办理今年供暖缴费，生成待确认的缴费订单。执行前由我点击确认。");
  await signInPage(page); await expect(order).toBeVisible(); await order.click(); await ready();
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

test("真实多房屋断暖：卡片选择承接、预设材料登记和用户确认提审", async ({ page }) => {
  watchPage(page); await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/works/demos/heating");
  const input = page.getByRole("textbox", { name: "说说您想办理什么" });
  async function ready() { await expect(input).toBeEnabled({ timeout: 30000 }); await expect(page.locator(".heat-wait")).toHaveCount(0, { timeout: 100000 }); }
  async function ask(text: string) { await input.fill(text); await page.getByRole("button", { name: /^发送/ }).click(); await ready(); }
  await ready(); await page.getByRole("button", { name: "演示设置", exact: true }).click(); await page.getByLabel("切换演示住户").selectOption("F"); await ready();
  await ask("今年没人住，想断暖");
  await expect(page.locator(".heat-house-choices button")).toHaveCount(2);
  await page.getByRole("button", { name: /第2套/ }).last().click(); await ready();
  await expect(page.locator(".heat-proposal").last()).toContainText("7号楼202室");
  await page.getByRole("button", { name: "为这套房屋开始申请", exact: true }).last().click(); await ready();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await ask("先不提交，供暖时间和费用怎么算？只咨询演示政策。");
  expect((await pageSnapshot(page)).conversation.proposal).toBeNull();
  expect((await pageSnapshot(page)).records.applications[0].status).toBe("draft");
  // Prior cards become inactive history after a topic change; query the original work order to resume.
  await ask("回到刚才那个断暖申请，帮我查询当前材料状态和下一步。");
  await expect(page.getByTestId("application-card").last()).toBeVisible();
  const app = () => page.getByTestId("application-card").last();
  for (const index of [1, 0]) { await app().getByRole("button", { name: "模拟提交", exact: true }).nth(index).click(); await ready(); }
  await expect(app().getByText("已登记", { exact: true })).toHaveCount(2);
  expect((await pageSnapshot(page)).records.applications[0].status).toBe("draft");
  await app().getByRole("button", { name: "核对材料并提交", exact: true }).click(); await ready();
  await page.getByRole("button", { name: "确认提交断暖申请", exact: true }).last().click(); await ready();
  expect((await pageSnapshot(page)).records.applications[0].status).toBe("submitted");
  await page.screenshot({ path: "test-results/heating/live-disconnection-submitted.png", fullPage: false });
});

test("真实 H5：退回补件恢复原工单、支付取消与重复确认、关闭重开和独立会话", async ({ page, context, browser, baseURL }) => {
  let active = page;
  const ready = async (target = active) => {
    await expect(target.getByRole("textbox", { name: "说说您想办理什么" })).toBeEnabled({ timeout: 30000 });
    await expect(target.locator(".heat-wait")).toHaveCount(0, { timeout: 100000 });
    await expect(target.locator(".heat-error")).toHaveCount(0);
  };
  const ask = async (text: string) => {
    await active.getByRole("textbox", { name: "说说您想办理什么" }).fill(text);
    await active.getByRole("button", { name: /^发送/ }).click(); await ready();
  };
  const switchUser = async (userId: string) => {
    await active.getByRole("button", { name: "演示设置", exact: true }).click();
    await active.getByLabel("切换演示住户").selectOption(userId); await ready();
  };
  const confirm = async (name: string) => { if (name === "确认账单，去付款") await signInPage(active); await active.getByRole("button", { name, exact: true }).last().click(); await ready(); };
  watchPage(active); await active.goto("/works/demos/heating"); await ready(); await switchUser("D");
  await ask("为什么我的申请被退回了？");
  const before = (await pageSnapshot(active)).records.applications[0];
  await active.getByTestId("application-card").last().getByRole("button", { name: "模拟提交", exact: true }).nth(1).click(); await ready();
  const supplemented = (await pageSnapshot(active)).records.applications[0];
  expect(supplemented.id).toBe(before.id); expect(supplemented.materials).toHaveLength(before.materials.length + 1);
  await active.getByTestId("application-card").last().getByRole("button", { name: "核对补件并重新提审", exact: true }).click(); await ready();
  const resubmit = (await pageSnapshot(active)).conversation.proposal;
  await confirm("确认补件后重新提审"); expect(await repeatConfirm(active, resubmit.id)).toBe(200);
  const resumed = (await pageSnapshot(active)).records.applications;
  expect(resumed).toHaveLength(1); expect(resumed[0].id).toBe(before.id); expect(resumed[0].status).toBe("resubmitted");
  await ask("刚才那个申请现在到哪了？");
  expect((await pageSnapshot(active)).records.applications[0].id).toBe(before.id);
  await switchUser("A"); await ask("我想交今年的暖气费。"); await confirm("确认账单，去付款");
  const oldPayment = (await pageSnapshot(active)).conversation.proposal;
  await active.getByRole("button", { name: "演示设置", exact: true }).click();
  await active.getByRole("dialog").getByText("模拟异常", { exact: true }).click();
  await active.getByRole("button", { name: "取消这次支付", exact: true }).click(); await ready();
  const cancellation = (await pageSnapshot(active)).conversation.proposal;
  expect(await repeatConfirm(active, oldPayment.id)).toBe(409);
  await confirm("确认模拟取消支付"); expect(await repeatConfirm(active, cancellation.id)).toBe(200);
  const cancelled = await pageSnapshot(active);
  expect(cancelled.records.orders).toHaveLength(1); expect(cancelled.records.orders[0].status).toBe("cancelled");
  expect(cancelled.records.bills[0].status).toBe("unpaid"); expect(cancelled.records.invoices).toHaveLength(0);
  const independent = await browser.newContext({ baseURL });
  try {
    const separate = await independent.newPage(); watchPage(separate); await separate.goto("/works/demos/heating"); await ready(separate);
    const fresh = await pageSnapshot(separate); expect(fresh.records.orders).toHaveLength(0); expect(fresh.conversation.history).toHaveLength(0);
    expect((await pageSnapshot(active)).records.orders[0].status).toBe("cancelled");
  } finally { await independent.close(); }
  await active.close(); active = await context.newPage(); watchPage(active); await active.goto("/works/demos/heating"); await ready();
  const reopened = await pageSnapshot(active); expect(reopened.records.profile.id).toBe("A");
  expect(reopened.records.orders).toHaveLength(0); expect(reopened.records.invoices).toHaveLength(0); expect(reopened.records.applications).toHaveLength(0); expect(reopened.conversation.history).toHaveLength(0);
  await switchUser("D"); const resetD = (await pageSnapshot(active)).records.applications;
  expect(resetD).toHaveLength(1); expect(resetD[0].status).toBe("needs_more_materials"); expect(resetD[0].materials).toHaveLength(before.materials.length);
});


test("真实模型：演示失败始终针对已确认订单，不回到新账单或成功支付", async ({ page }) => {
  watchPage(page); await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/works/demos/heating");
  const ready = async () => { await expect(page.getByRole("textbox", { name: "说说您想办理什么" })).toBeEnabled({ timeout: 30000 }); await expect(page.locator(".heat-wait")).toHaveCount(0, { timeout: 100000 }); };
  await ready(); await page.getByRole("button", { name: "供暖缴费", exact: true }).click(); await ready();
  await signInPage(page); await page.getByRole("button", { name: "确认账单，去付款", exact: true }).last().click(); await ready();
  const before = await pageSnapshot(page); expect(before.records.orders).toHaveLength(1); expect(before.records.orders[0].status).toBe("pending");
  await page.getByRole("button", { name: "演示设置", exact: true }).click(); await page.getByRole("dialog").getByText("模拟异常", { exact: true }).click();
  await page.getByRole("button", { name: "演示支付失败", exact: true }).click(); await ready();
  await expect(page.locator(".heat-error")).toHaveCount(0);
  const proposed = (await pageSnapshot(page)).conversation.proposal;
  expect(proposed.operation.name).toBe("simulate_payment"); expect(proposed.operation.input.orderId).toBe(before.records.orders[0].id); expect(proposed.operation.input.outcome).toBe("failure");
  await page.getByRole("button", { name: "确认模拟支付失败", exact: true }).last().click(); await ready();
  const after = await pageSnapshot(page); expect(after.records.orders).toHaveLength(1); expect(after.records.orders[0].status).toBe("failed"); expect(after.records.bills[0].status).toBe("unpaid"); expect(after.records.invoices).toHaveLength(0);
  expect(await repeatConfirm(page, proposed.id)).toBe(200);
  await page.getByTestId("bill-card").last().scrollIntoViewIfNeeded(); await page.screenshot({ path: "test-results/heating/live-payment-failure.png", fullPage: false });
});

test("真实断暖协议：审核通过后签署、两次付款确认及模拟发票", async ({ page }) => {
  watchPage(page); await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/works/demos/heating");
  const ready = async () => { await expect(page.getByRole("textbox", { name: "说说您想办理什么" })).toBeEnabled({ timeout: 30000 }); await expect(page.locator(".heat-wait")).toHaveCount(0, { timeout: 100000 }); await expect(page.locator(".heat-error")).toHaveCount(0); };
  const ask = async (text: string) => { await page.getByRole("textbox", { name: "说说您想办理什么" }).fill(text); await page.getByRole("button", { name: /^发送/ }).click(); await ready(); };
  const confirm = async (text: string) => { await page.getByRole("button", { name: text, exact: true }).last().click(); await ready(); };
  await ready(); await page.getByRole("button", { name: "演示设置", exact: true }).click(); await page.getByLabel("切换演示住户").selectOption("C"); await ready();
  await expect.poll(async () => (await pageSnapshot(page)).records.applications[0].status, { timeout: 40000, intervals: [2000] }).toBe("approved");
  await ask("我的断暖申请 application-C 审核通过了，请继续办理对应断暖费用。"); await confirm("确认断暖费用");
  await page.getByTestId("bill-card").last().getByRole("button", { name: "请助手办理缴费", exact: true }).click(); await ready();
  await expect(page.getByTestId("agreement-card").last()).toContainText("断暖服务与费用协议");
  await expect(page.getByTestId("agreement-card").last()).toContainText("831.25");
  await signInPage(page); expect((await pageSnapshot(page)).records.orders).toHaveLength(0);
  await confirm("确认账单，去付款"); await confirm("确认模拟支付");
  const result = await pageSnapshot(page); expect(result.records.applications[0].status).toBe("fee_paid"); expect(result.records.invoices).toHaveLength(1);
  expect(result.records.agreements.find((a: { kind: string }) => a.kind === "disconnection").signedAt).toBeTruthy();
});

test("真实政策咨询：目录、序号、口语追问和跨业务查询", async ({ page }) => {
  watchPage(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/works/demos/heating");
  const input = page.getByRole("textbox", { name: "说说您想办理什么" });
  const replies = () => page.locator(".heat-message.assistant .heat-bubble");
  async function ready() {
    await expect(input).toBeEnabled({ timeout: 30000 });
    await expect(page.locator(".heat-wait")).toHaveCount(0, { timeout: 100000 });
    await expect(page.locator(".heat-error")).toHaveCount(0);
  }
  async function ask(message: string) {
    await input.fill(message); await page.getByRole("button", { name: /^发送/ }).click(); await ready();
    await expect(replies().last()).not.toContainText("回复未完整完成");
  }
  await ready();
  await page.getByRole("button", { name: "供暖政策", exact: true }).click(); await ready();
  await expect(replies().last()).toContainText("1. 供暖时间");
  await expect(replies().last()).toContainText("9. 暖气不热与维修");
  await page.screenshot({ path: "test-results/heating/live-policy-directory.png", fullPage: false });
  await ask("第四项"); await expect(replies().last()).toContainText("不设置办理截止日期");
  await ask("那需要什么材料？"); await expect(replies().last()).toContainText("产权证明或合同、断暖施工照片");
  await ask("几月开始烧暖气？"); await expect(replies().last()).toContainText("11月15日");
  await ask("暖气一直不热，你能上门修吗？"); await expect(replies().last()).toContainText("不支持报修派单");
  await ask("当地室温必须达到多少度？"); await expect(replies().last()).toContainText("演示资料未包含");
  let snapshot = await pageSnapshot(page);
  expect(snapshot.conversation.proposal).toBeNull(); expect(snapshot.records.orders).toHaveLength(0); expect(snapshot.records.applications).toHaveLength(0);
  await ask("先不问政策了，查我家今年需要交多少供暖费，只查询。");
  await expect(page.getByTestId("bill-card").last()).toContainText("2,125.00");
  snapshot = await pageSnapshot(page); expect(snapshot.conversation.proposal).toBeNull();
  await page.screenshot({ path: "test-results/heating/live-policy.png", fullPage: false });
});
