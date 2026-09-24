import { expect, test, type Page } from "@playwright/test";
import { demoInterpret } from "../../lib/works/island-travel/domain";

const root = "/works/demos/island-travel";
async function ticket(page: Page) {
  await page.goto(root);
  await page.getByRole("button", { name: "查找我的行程" }).click();
  await expect(page).toHaveURL(new RegExp(`${root}/plan$`));
  await page.getByRole("button", { name: /选择第1班/ }).click();
  await expect(page).toHaveURL(new RegExp(`${root}/confirm$`));
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "确认创建订单" }).click();
  await page.getByRole("button", { name: /支付成功.*完成模拟出票/ }).click();
}

test("ticket support confirms once, progresses in order, rejects identity and clears on refresh", async ({ page }) => {
  await ticket(page);
  await page.getByRole("link", { name: /演示客服工单/ }).click();
  await expect(page.getByRole("heading", { name: "提交演示客服工单" })).toBeVisible();
  await page.getByLabel("服务类别").selectOption("human");
  await page.getByLabel("情况描述").fill("请联系 138 0000 0000");
  await expect(page.getByText(/检测到手机号、证件号码或住址/)).toBeVisible();
  await expect(page.getByRole("button", { name: "核对工单内容" })).toBeDisabled();
  await page.getByLabel("情况描述").fill("需要演示人工协助寻找行李");
  await page.getByRole("button", { name: "核对工单内容" }).click();
  await expect(page.getByRole("heading", { name: "提交前，再核对一次" })).toBeFocused();
  await page.screenshot({ path: "test-results/island-travel/support-desktop.png", fullPage: true });
  await expect(page.getByText("不会接通真实客服")).toBeVisible();
  await expect(page.getByRole("button", { name: /确认提交演示工单/ })).toBeDisabled();
  await page.getByRole("checkbox", { name: /已核对工单类别/ }).check();
  await page.getByRole("button", { name: /确认提交演示工单/ }).dblclick();
  await expect(page.getByText("演示工单 DS-0001 已提交")).toBeVisible();
  await expect(page.locator(".support-ticket")).toHaveCount(1);
  await page.getByRole("checkbox", { name: "确认模拟开始处理" }).check();
  await page.getByRole("button", { name: "确认受理" }).click();
  await expect(page.getByText("模拟处理中")).toBeVisible();
  await page.getByRole("checkbox", { name: "确认模拟处理完成" }).check();
  await page.getByRole("button", { name: "确认完成" }).click();
  await expect(page.getByText("没有接通真实客服").last()).toBeVisible();
  await page.getByRole("link", { name: "返回订单" }).last().click();
  await expect(page.getByRole("link", { name: /演示客服工单.*1/ })).toBeVisible();
  await page.reload();
  await expect(page.getByText("这张订单不在当前会话中。")).toBeVisible();
  await page.goto(`${root}/orders/DJ-9999/support`);
  await expect(page.getByText("关联订单不在当前会话中。")).toBeVisible();
});

test("reminder follows reschedule and is revoked by refund", async ({ page }) => {
  await ticket(page);
  await page.getByRole("link", { name: "查看我的行程" }).click();
  const reminder = page.locator("#departure-reminder");
  await expect(reminder).toContainText("不会发送系统通知");
  const before = await reminder.locator('[role="status"]').innerText();
  await reminder.getByRole("button", { name: "开启出发提醒" }).click();
  await expect(reminder).toContainText("已开启");
  await page.getByRole("link", { name: "查看对应订单" }).click();
  await page.getByRole("link", { name: "选择新班次" }).click();
  await page.getByRole("button", { name: /13:30 → 16:50/ }).click();
  await page.getByRole("button", { name: "查看改签报价" }).click();
  await page.getByRole("checkbox", { name: /已核对原行程/ }).check();
  await page.getByRole("button", { name: /确认进入补差价支付/ }).click();
  await page.getByRole("button", { name: /支付成功，完成改签/ }).click();
  await page.getByRole("link", { name: /查看更新后的订单/ }).click();
  await page.getByRole("link", { name: "查看我的行程" }).click();
  await expect(reminder).toContainText("已开启");
  expect(await reminder.locator('[role="status"]').innerText()).not.toBe(before);
  await page.getByRole("link", { name: "查看对应订单" }).click();
  await page.getByRole("link", { name: "查看退票试算" }).click();
  await page.getByRole("button", { name: "查看退票试算" }).click();
  await page.getByRole("checkbox", { name: /已核对试算/ }).check();
  await page.getByRole("button", { name: "确认演示退票成功" }).click();
  await page.getByRole("link", { name: /返回订单/ }).last().click();
  await page.getByRole("link", { name: "查看已取消行程" }).click();
  await expect(reminder).toContainText("出发提醒已撤销");
});

test("contextual and ambiguous AI entries only navigate; support detail never reaches model", async ({ page }) => {
  await ticket(page);
  await page.getByRole("button", { name: "与岛见聊这张订单" }).click();
  await expect(page.getByText("当前订单：DJ-0001")).toBeVisible();
  await page.getByLabel("对话模式").selectOption("demo");
  await page.getByLabel("描述你的出行计划").fill("我要投诉建议");
  await page.getByRole("button", { name: "发送行程" }).click();
  await page.getByRole("log", { name: "聊天记录" }).getByRole("link", { name: "填写演示客服工单" }).click();
  await expect(page).toHaveURL(new RegExp(`${root}/orders/DJ-0001/support$`));
  await expect(page.getByText("暂无工单")).toBeVisible();
  await page.getByRole("link", { name: "返回订单" }).last().click();
  await page.getByRole("button", { name: "与岛见聊这张订单" }).click();
  await page.route("**/api/experiments/island-travel/chat", route => {
    const body = route.request().postDataJSON();
    expect(JSON.stringify(body)).not.toContain("DJ-0001");
    expect(JSON.stringify(body)).not.toContain("行李丢失的具体细节");
    expect(["我需要客服工单帮助", "我需要设置出发提醒"]).toContain(body.message);
    return route.fulfill({ json: { ...demoInterpret(body.message, body.conditions), mode: "live", reply: "已为你联系真人客服" } });
  });
  await page.getByLabel("对话模式").selectOption("live");
  await page.getByLabel("描述你的出行计划").fill("DJ-0001 投诉：行李丢失的具体细节");
  await page.getByRole("button", { name: "发送行程" }).click();
  await expect(page.getByText("已为你联系真人客服")).toHaveCount(0);
  await expect(page.getByRole("log", { name: "聊天记录" }).getByRole("link", { name: "填写演示客服工单" })).toHaveCount(2);
  await page.getByRole("button", { name: "清除关联" }).click();
  await page.getByLabel("描述你的出行计划").fill("出发提醒");
  await page.getByRole("button", { name: "发送行程" }).click();
  await expect(page.getByRole("log", { name: "聊天记录" }).getByRole("link", { name: "查看出发提醒" })).toBeVisible();
});

test("mobile support form and keyboard focus fit without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await ticket(page);
  await page.getByRole("link", { name: /演示客服工单/ }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByLabel("服务类别").focus();
  await expect(page.locator(":focus-visible")).toHaveCount(1);
  await page.getByLabel("情况描述").fill("模拟失物登记");
  await page.getByRole("button", { name: "核对工单内容" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/island-travel/support-mobile.png", fullPage: true });
});

test("multiple orders require selection unless an order ID is explicit", async ({ page }) => {
  await ticket(page);
  await page.getByRole("link", { name: "选择行程" }).click();
  await page.getByRole("link", { name: "查看交通产品" }).click();
  await page.getByRole("article").first().getByRole("button", { name: /核对并预订/ }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /确认创建产品订单/ }).click();
  await expect(page).toHaveURL(new RegExp(`${root}/orders/DP-0001$`));
  await page.getByRole("link", { name: "演示客服工单" }).click();
  await page.getByLabel("情况描述").fill("演示产品协助需求");
  await page.getByRole("button", { name: "核对工单内容" }).click();
  await page.getByRole("checkbox", { name: /已核对工单类别/ }).check();
  await page.getByRole("button", { name: /确认提交演示工单/ }).click();
  await expect(page.getByText("演示工单 DS-0001 已提交")).toBeVisible();
  await page.getByRole("link", { name: "选择行程" }).click();
  await page.getByLabel("对话模式").selectOption("demo");
  await page.getByLabel("描述你的出行计划").fill("我需要客服");
  await page.getByRole("button", { name: "发送行程" }).click();
  await expect(page.getByRole("log", { name: "聊天记录" }).getByRole("link", { name: "选择演示订单" })).toBeVisible();
  await page.getByLabel("描述你的出行计划").fill("DJ-0001 我要客服");
  await page.getByRole("button", { name: "发送行程" }).click();
  await page.getByRole("log", { name: "聊天记录" }).getByRole("link", { name: "填写演示客服工单" }).click();
  await expect(page).toHaveURL(new RegExp(`${root}/orders/DJ-0001/support$`));
  await expect(page.getByText("暂无工单")).toBeVisible();
});
