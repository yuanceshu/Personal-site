import { expect, test, type Page } from "@playwright/test";
import { watchPage, pageSnapshot as snapshot, repeatConfirm } from "./browser-client";
const input = (page: Page) => page.getByRole("textbox", { name: "说说您想办理什么" });
const app = (page: Page) => page.getByTestId("application-card").last();
async function ready(page: Page) { await expect(input(page)).toBeEnabled({ timeout: 20000 }); await expect(page.locator(".heat-wait")).toHaveCount(0, { timeout: 20000 }); }
async function send(page: Page, text: string) { await ready(page); await input(page).fill(text); await page.getByRole("button", { name: /^发送/ }).click(); await ready(page); }
async function confirm(page: Page, text: string) { await page.getByRole("button", { name: text, exact: true }).last().click(); await ready(page); }
async function settings(page: Page) { await ready(page); await page.getByRole("button", { name: "演示设置", exact: true }).click(); }
async function switchUser(page: Page, user: string) { await settings(page); await page.getByLabel("切换演示住户").selectOption(user); await ready(page); await expect(page.getByRole("dialog")).toHaveCount(0); }
async function pay(page: Page) { await send(page, "我想交今年的暖气费。"); await confirm(page, "确认账单，去付款"); await expect(page.getByRole("button", { name: "确认模拟支付", exact: true }).last()).toBeEnabled(); await confirm(page, "确认模拟支付"); }
async function material(page: Page, index: number) { await app(page).getByRole("button", { name: "模拟提交", exact: true }).nth(index).click(); await ready(page); }
test.use({ actionTimeout: 20000 });
test.beforeEach(({ page }) => { watchPage(page); });

test("桌面：同页缴费、明确确认、重复确认与发票；刷新清空全部对话和业务", async ({ page }) => {
  await page.goto("/works/demos/heating"); await ready(page);
  await expect(page.getByTestId("bill-card")).toHaveCount(0); await expect(page.locator(".heat-shortcuts button")).toHaveCount(6);
  for (const prompt of ["我想交暖气费", "今年没人住，想断暖", "我想绑定房屋", "查房屋面积和供暖费", "查申请进度", "问供暖政策"]) {
    await expect(page.getByRole("button", { name: prompt, exact: true })).toBeVisible();
  }
  await page.screenshot({ path: "test-results/heating/desktop-home.png", fullPage: true });
  await page.getByRole("button", { name: "查房屋面积和供暖费", exact: true }).click(); await ready(page);
  await expect(page.getByTestId("bill-card").last()).toContainText("2,125.00");
  await page.reload(); await ready(page); await expect(page.getByTestId("bill-card")).toHaveCount(0);
  await page.getByRole("button", { name: "我想交暖气费", exact: true }).click(); await ready(page); const proposed = (await snapshot(page)).conversation.proposal;
  expect((await snapshot(page)).records.orders).toHaveLength(0); await expect(page.locator(".heat-shortcuts")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".heat-proposal").last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/heating/payment-confirm.png", fullPage: false });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await confirm(page, "确认账单，去付款"); await expect(page.getByRole("button", { name: "确认模拟支付", exact: true }).last()).toBeEnabled();
  expect(await repeatConfirm(page, proposed.id)).toBe(200); expect((await snapshot(page)).records.orders).toHaveLength(1);
  const paymentProposal = (await snapshot(page)).conversation.proposal;
  await confirm(page, "确认模拟支付"); await expect(page.getByTestId("bill-card").last()).toContainText("已缴费");
  expect(await repeatConfirm(page, paymentProposal.id)).toBe(200);
  expect((await snapshot(page)).records.orders).toHaveLength(1); expect((await snapshot(page)).records.invoices).toHaveLength(1);
  await page.getByRole("button", { name: "查看模拟电子发票" }).last().click(); await expect(page.getByRole("dialog")).toContainText("不具备真实票据效力"); await page.getByRole("button", { name: "关闭", exact: true }).click();
  await send(page, "刚刚支付成功了吗？发票在哪？"); expect((await snapshot(page)).records.invoices).toHaveLength(1);
  await page.screenshot({ path: "test-results/heating/desktop.png", fullPage: true });
  await page.reload(); await ready(page); const reset = await snapshot(page); expect(reset.records.orders).toHaveLength(0); expect(reset.records.invoices).toHaveLength(0); expect(reset.conversation.history).toHaveLength(0); expect(reset.records.bills[0].status).toBe("unpaid"); await expect(page.locator(".heat-message")).toHaveCount(0);
});

test("手机：材料完整性、断暖提审、服务端模拟审核与对应费用支付", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/works/demos/heating"); await ready(page);
  await page.screenshot({ path: "test-results/heating/mobile-home.png", fullPage: false });
  await send(page, "今年房子没人住，想办断暖。"); await confirm(page, "为这套房屋开始申请");
  await expect(app(page).getByText("还需提供", { exact: true })).toHaveCount(2); await page.screenshot({ path: "test-results/heating/material-list.png", fullPage: false });
  await app(page).getByRole("button", { name: "核对材料并提交", exact: true }).click(); await ready(page); await expect(page.getByRole("button", { name: "确认提交断暖申请" })).toHaveCount(0);
  for (const index of [1, 0]) await material(page, index);
  await app(page).getByRole("button", { name: "核对材料并提交", exact: true }).click(); await ready(page); await confirm(page, "确认提交断暖申请");
  await expect.poll(async () => (await snapshot(page)).records.applications[0].status, { timeout: 45000, intervals: [2000] }).toBe("approved");
  await send(page, "我刚才那个申请审核到哪一步了？"); await app(page).getByRole("button", { name: "继续办理断暖缴费", exact: true }).click(); await ready(page); await confirm(page, "确认断暖费用");
  await expect(page.getByTestId("bill-card").last()).toContainText("743.75");
  await page.getByTestId("bill-card").last().getByRole("button", { name: "请助手办理缴费" }).click(); await ready(page); await confirm(page, "确认账单，去付款"); await expect(page.getByRole("button", { name: "确认模拟支付", exact: true }).last()).toBeEnabled(); await confirm(page, "确认模拟支付");
  await send(page, "我刚才那个申请审核到哪一步了？"); await expect(app(page)).toContainText("断暖已办结"); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await app(page).scrollIntoViewIfNeeded(); await page.screenshot({ path: "test-results/heating/mobile.png", fullPage: false });
});

test("同页住户切换、首次绑定缴费、多房屋、支付失败与取消、补件同一工单", async ({ page }) => {
  await page.goto("/works/demos/heating"); await ready(page); await switchUser(page, "B");
  await send(page, "我还没有绑定房子。"); await page.getByRole("button", { name: "使用演示资料绑定" }).click(); await ready(page); await confirm(page, "绑定这套房屋"); await pay(page);
  expect((await snapshot(page)).records.invoices).toHaveLength(1);
  await switchUser(page, "F"); await send(page, "我想交今年的暖气费。"); await expect(page.locator(".heat-message.assistant").last()).toContainText("哪一套");
  await page.getByRole("button", { name: /第2套/ }).last().click(); await ready(page); await expect(page.getByTestId("bill-card").last()).toContainText("1,900.00");
  await confirm(page, "确认账单，去付款"); await expect(page.getByRole("button", { name: "确认模拟支付", exact: true }).last()).toBeEnabled();
  await settings(page); await page.getByRole("dialog").getByText("模拟异常", { exact: true }).click(); await page.getByRole("button", { name: "演示支付失败", exact: true }).click(); await ready(page); await confirm(page, "确认模拟支付失败");
  expect((await snapshot(page)).records.orders[0].status).toBe("failed");
  await page.getByTestId("bill-card").last().getByRole("button", { name: "请助手办理缴费", exact: true }).click(); await ready(page); await confirm(page, "确认账单，去付款"); await expect(page.getByRole("button", { name: "确认模拟支付", exact: true }).last()).toBeEnabled();
  await settings(page); await page.getByRole("dialog").getByText("模拟异常", { exact: true }).click(); await page.getByRole("button", { name: "取消这次支付", exact: true }).click(); await ready(page); await confirm(page, "确认模拟取消支付"); expect((await snapshot(page)).records.orders[1].status).toBe("cancelled");
  await switchUser(page, "D"); await send(page, "为什么我的申请被退回了？"); await expect(app(page)).toContainText("请模拟提交补件"); await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: "test-results/heating/review-supplement.png", fullPage: false }); await page.setViewportSize({ width: 1440, height: 1000 }); await material(page, 1);
  await app(page).getByRole("button", { name: "核对补件并重新提审", exact: true }).click(); await ready(page); const supplement = (await snapshot(page)).conversation.proposal;
  await confirm(page, "确认补件后重新提审"); expect(await repeatConfirm(page, supplement.id)).toBe(200);
  const resumed = (await snapshot(page)).records.applications; expect(resumed).toHaveLength(1); expect(resumed[0].id).toBe("application-D"); expect(resumed[0].status).toBe("resubmitted");
  await switchUser(page, "B"); expect((await snapshot(page)).records.invoices).toHaveLength(1);
});

test("多个标签页各自独立；关闭重开及浏览器 BFCache 返回都初始化", async ({ page, context, browser }) => {
  await page.goto("/works/demos/heating"); await ready(page); await send(page, "我想交今年的暖气费。");
  const other = await context.newPage(); watchPage(other); await other.goto("/works/demos/heating"); await ready(other); await switchUser(other, "B");
  await confirm(page, "确认账单，去付款"); await expect(page.getByRole("button", { name: "确认模拟支付", exact: true }).last()).toBeEnabled(); expect((await snapshot(page)).records.profile.id).toBe("A"); expect((await snapshot(other)).records.profile.id).toBe("B"); expect((await snapshot(other)).records.orders).toHaveLength(0);
  const isolated = await browser.newContext({ baseURL: "http://127.0.0.1:3216" });
  try { const independent = await isolated.newPage(); watchPage(independent); await independent.goto("/works/demos/heating"); await ready(independent); expect((await snapshot(independent)).records.orders).toHaveLength(0); expect((await snapshot(page)).records.orders).toHaveLength(1); } finally { await isolated.close(); }
  await other.close(); const reopened = await context.newPage(); watchPage(reopened); await reopened.goto("/works/demos/heating"); await ready(reopened); expect((await snapshot(reopened)).records.profile.id).toBe("A");
  await page.evaluate(() => { dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })); dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })); }); await ready(page); expect((await snapshot(page)).records.orders).toHaveLength(0); await reopened.close();
  expect((await context.cookies()).some(cookie => cookie.name === "heating_demo_session")).toBe(false);
});

test("BFCache 恢复时忽略旧住户响应，旧请求不得解锁新的初始化", async ({ page }) => {
  await page.goto("/works/demos/heating"); await ready(page);
  let releaseOld!: () => void, releaseFresh!: () => void;
  let oldReceived!: () => void, freshReceived!: () => void;
  const oldReady = new Promise<void>(resolve => { oldReceived = resolve; }); const freshReady = new Promise<void>(resolve => { freshReceived = resolve; });
  const oldGate = new Promise<void>(resolve => { releaseOld = resolve; }); const freshGate = new Promise<void>(resolve => { releaseFresh = resolve; });
  await page.route("**/api/experiments/heating/session", async route => { const response = await route.fetch(); if (route.request().postDataJSON().userId === "B") { oldReceived(); await oldGate; } else { freshReceived(); await freshGate; } await route.fulfill({ response }); });
  await settings(page); await page.getByLabel("切换演示住户").selectOption("B"); await oldReady;
  await page.evaluate(() => { dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })); dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })); }); await freshReady;
  const oldDelivered = page.waitForResponse(response => response.url().endsWith("/heating/session") && response.request().postDataJSON().userId === "B"); releaseOld(); await oldDelivered;
  await page.waitForTimeout(100); await expect(input(page)).toBeDisabled(); await expect(page.getByRole("dialog")).toHaveCount(0);
  releaseFresh(); await ready(page); await settings(page); await expect(page.getByLabel("切换演示住户")).toHaveValue("A"); expect((await snapshot(page)).records.profile.id).toBe("A"); expect((await snapshot(page)).records.orders).toHaveLength(0);
});

test("材料一键模拟登记，无文件选择或传输；重复点击、失败和刷新", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/works/demos/heating"); await ready(page); await switchUser(page, "D"); await send(page, "为什么我的申请被退回了？");
  const requests: string[] = []; let fileChoosers = 0;
  page.on("filechooser", () => { fileChoosers++; });
  page.on("request", request => { if (request.url().includes("/heating/")) requests.push(request.headers()["content-type"] ?? ""); });
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await page.route("**/heating/simulate-material", route => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"heating_unavailable"}' }));
  await material(page, 1); await expect(app(page)).toContainText("请模拟提交补件"); expect((await snapshot(page)).records.applications[0].materials).toHaveLength(2);
  await page.unroute("**/heating/simulate-material"); await material(page, 1);
  await expect(app(page)).toContainText("断暖施工照片（演示补件）.png");
  await expect(app(page).getByRole("button", { name: "模拟提交", exact: true }).nth(1)).toBeDisabled();
  expect((await snapshot(page)).records.applications[0].materials).toHaveLength(3);
  expect(fileChoosers).toBe(0); expect(requests.every(type => !type.includes("multipart"))).toBe(true);
  await page.screenshot({ path: "test-results/heating/material-simulated.png", fullPage: false });
  await page.reload(); await ready(page); await switchUser(page, "D"); expect((await snapshot(page)).records.applications[0].materials).toHaveLength(2); await expect(page.getByTestId("application-card")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
});

test("明确账单需求、缴费记录、已绑定提示和断暖多房屋卡片承接", async ({ page }) => {
  await page.goto("/works/demos/heating"); await ready(page);
  await send(page, "我要缴纳房屋 虚构和煦小区1号楼101室（演示）（house-A）的正常供暖费，账单 bill-house-A，请先核对并让我确认。");
  await expect(page.getByRole("button", { name: "确认账单，去付款", exact: true }).last()).toBeVisible();
  await confirm(page, "确认账单，去付款"); await confirm(page, "确认模拟支付");
  await send(page, "查我的缴费记录"); await expect(page.getByTestId("bill-card").last()).toContainText("已缴费");
  await send(page, "我想绑定房屋"); await expect(page.locator(".heat-message.assistant").last()).toContainText("已经绑定"); await expect(page.locator(".heat-binding")).toHaveCount(0);
  await switchUser(page, "F"); await send(page, "今年没人住，想断暖");
  await expect(page.locator(".heat-house-choices button")).toHaveCount(2);
  await page.getByRole("button", { name: /第2套/ }).last().click(); await ready(page);
  await expect(page.locator(".heat-proposal").last()).toContainText("7号楼202室");
  await expect(page.getByRole("button", { name: "为这套房屋开始申请", exact: true }).last()).toBeVisible();
});

test("合集入口、返回与小屏；模型和业务错误不伪造结果，可继续同页业务", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/works/demos"); await expect(page.locator('.demo-card a[href="/works/demos/heating"]')).toHaveCount(1);
  await page.locator('.demo-card a[href="/works/demos/heating"]').click(); await ready(page); await pay(page);
  await send(page, "演示工具成功后模型未完成"); await expect(page.locator(".heat-notice")).toContainText("已保留工具核实的结果");
  await expect(page.getByTestId("bill-card").last()).toContainText("已缴费"); await expect(page.locator(".heat-error")).toHaveCount(0);
  await page.getByRole("button", { name: "重试刚才的需求", exact: true }).click(); await ready(page);
  expect((await snapshot(page)).records.orders).toHaveLength(1); expect((await snapshot(page)).records.invoices).toHaveLength(1);
  await send(page, "演示模型异常"); await expect(page.locator(".heat-error")).toBeVisible(); expect((await snapshot(page)).records.invoices).toHaveLength(1);
  await send(page, "断暖为什么还需要缴费？"); await expect(page.locator(".heat-error")).toHaveCount(0);
  await page.route("**/api/experiments/heating/snapshot", route => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"heating_unavailable"}' })); await send(page, "问供暖政策"); await expect(page.locator(".heat-error")).toBeVisible();
  await page.unroute("**/api/experiments/heating/snapshot"); await page.getByRole("button", { name: "重新连接", exact: true }).click(); await ready(page); expect((await snapshot(page)).records.invoices).toHaveLength(1);
  await settings(page); await page.getByRole("link", { name: "返回 Demo 合集" }).click(); await page.locator('.demo-card a[href="/works/demos/heating"]').click(); await ready(page); expect((await snapshot(page)).records.invoices).toHaveLength(0);
  await page.setViewportSize({ width: 320, height: 568 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("请求时可保留草稿；改需求停用旧确认；阅读历史时提示新消息而不强制滚动", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/works/demos/heating"); await ready(page);
  let release!: () => void, received!: () => void;
  const receivedPromise = new Promise<void>(resolve => { received = resolve; }); const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/experiments/heating/chat", async route => { const response = await route.fetch(); received(); await gate; await route.fulfill({ response }); });
  await input(page).fill("我想交今年的暖气费。"); await page.getByRole("button", { name: /^发送/ }).click(); await receivedPromise;
  await expect(page.locator(".heat-wait")).toBeVisible(); await input(page).fill("断暖为什么还需要缴费？"); await expect(page.getByRole("button", { name: /^发送/ })).toBeDisabled(); release(); await ready(page);
  await expect(input(page)).toHaveValue("断暖为什么还需要缴费？"); await page.unroute("**/api/experiments/heating/chat");
  const oldConfirm = page.getByRole("button", { name: "确认账单，去付款", exact: true, includeHidden: true }).last(); await page.getByRole("button", { name: /^发送/ }).click(); await ready(page); await expect(oldConfirm).toBeDisabled(); expect((await snapshot(page)).records.orders).toHaveLength(0);
  for (let i = 0; i < 5; i++) await send(page, "断暖为什么还需要缴费？");
  let releaseFinal!: () => void, finalReceived!: () => void;
  const finalReady = new Promise<void>(resolve => { finalReceived = resolve; }); const finalGate = new Promise<void>(resolve => { releaseFinal = resolve; });
  await page.route("**/api/experiments/heating/chat", async route => { const response = await route.fetch(); finalReceived(); await finalGate; await route.fulfill({ response }); });
  await input(page).fill("断暖为什么还需要缴费？"); await page.getByRole("button", { name: /^发送/ }).click(); await finalReady;
  await page.locator(".heat-timeline").evaluate(node => { node.scrollTop = 0; node.dispatchEvent(new Event("scroll")); }); releaseFinal(); await ready(page);
  await expect(page.getByRole("button", { name: "查看新消息 ↓", exact: true })).toBeVisible(); expect(await page.locator(".heat-timeline").evaluate(node => node.scrollTop)).toBeLessThan(100);
  await page.getByRole("button", { name: "查看新消息 ↓", exact: true }).click(); await expect(page.locator(".heat-new-message")).toHaveCount(0);
});
