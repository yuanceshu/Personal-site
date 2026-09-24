import { expect, test, type Page } from "@playwright/test";
import { addDays, shanghaiToday } from "../../lib/works/island-travel/domain";

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
test("product charter uses per-vehicle pricing and unknown payment only recovers by lookup", async ({ page }) => {
  await page.goto(`${root}/products`);
  const charter = page.getByRole("article").filter({ hasText: "三亚站 · 景区包车" });
  await expect(charter).toContainText("每辆车 · 最多 4 人");
  await charter.getByRole("button", { name: /核对并预订/ }).click();
  await page.getByLabel("产品乘坐人数").selectOption("4");
  await expect(page.getByText("¥188.00")).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /确认创建产品订单/ }).click();
  await expect(page).toHaveURL(new RegExp(`${root}/orders/DP-0001$`));
  await page.getByRole("button", { name: /支付结果未知/ }).click();
  await expect(page.getByRole("button", { name: /支付成功/ })).toHaveCount(0);
  await page.getByRole("button", { name: /主动查询支付结果/ }).click();
  await expect(page.getByRole("heading", { name: "服务待使用" })).toBeVisible();
  await expect(page.getByRole("button", { name: /确认完成服务/ })).toBeDisabled();
  await page.getByRole("checkbox", { name: /确认模拟服务已完成/ }).check();
  await page.getByRole("button", { name: /确认完成服务/ }).click();
  await expect(page.getByText("演示服务已完成，重复操作不会再次推进。")).toBeVisible();
  await expect(page.getByText("本批暂不开放产品退票、改签或开票")).toBeVisible();
  await page.getByRole("link", { name: /查看全部订单/ }).click();
  await page.getByRole("button", { name: "交通产品" }).click();
  await expect(page.getByRole("link", { name: /DP-0001/ })).toBeVisible();
  await page.getByRole("button", { name: "车票" }).click();
  await expect(page.getByRole("link", { name: /DP-0001/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "还没有订单。" })).toBeVisible();
});

test("door draft books legs separately and ticket refund flags linked product", async ({ page }) => {
  await page.goto(root);
  await page.getByRole("button", { name: "查找我的行程" }).click();
  await page.getByRole("button", { name: /生成演示方案/ }).click();
  const plan = page.locator("#door-plan");
  await expect(plan.getByText("换乘等待").first()).toContainText("分钟");
  await expect(plan).toContainText("当前方案合计");
  await expect(plan.getByText("未预订")).toHaveCount(3);
  await plan.getByRole("button", { name: /核对车票/ }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "确认创建订单" }).click();
  await page.getByRole("link", { name: "选择行程", exact: true }).click();
  await expect(plan.getByText("已预订")).toHaveCount(1);
  await expect(plan.getByText("需重新检查")).toHaveCount(0);
  await expect(plan.getByText("先完成车票模拟出票")).toHaveCount(2);
  await plan.getByRole("link", { name: /查看订单/ }).click();
  await page.getByRole("button", { name: /支付成功.*完成模拟出票/ }).click();
  await page.getByRole("link", { name: "选择行程" }).click();
  await expect(plan.getByText("已预订")).toHaveCount(1);
  await plan.getByRole("button", { name: /核对产品/ }).first().click();
  await expect(page.getByText("来自车票 DJ-0001")).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /确认创建产品订单/ }).click();
  await page.getByRole("button", { name: /支付成功 · 服务待使用/ }).click();
  await page.getByRole("link", { name: "选择行程" }).click();
  await expect(plan.getByText("已预订")).toHaveCount(2);
  await expect(plan.getByRole("button", { name: /核对产品/ })).toHaveCount(1);
  await page.getByRole("link", { name: /我的订单/ }).click();
  await page.getByRole("link", { name: /DJ-0001.*车票/ }).click();
  await page.getByRole("link", { name: /查看退票试算/ }).click();
  await page.getByRole("button", { name: /查看退票试算/ }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /确认演示退票成功/ }).click();
  await page.getByRole("link", { name: /返回订单/ }).first().click();
  await page.getByRole("link", { name: /DP-0001.*美兰机场/ }).click();
  await expect(page.getByRole("status")).toContainText("关联车票已退款或改签");
  await expect(page.getByRole("heading", { name: "服务待使用" })).toBeVisible();
  await page.getByRole("link", { name: "选择行程" }).click();
  await expect(plan.getByText("需重新检查").first()).toBeVisible();
});

test("journey offers arrival shuttle and demo AI routes to local catalog", async ({ page }) => {
  await ticket(page);
  await page.getByRole("link", { name: /查看我的行程/ }).click();
  await expect(page.getByRole("button", { name: /安排抵达接驳/ })).toBeVisible();
  await page.getByRole("button", { name: /安排抵达接驳/ }).click();
  await expect(page.getByText("来自车票 DJ-0001")).toBeVisible();
  await page.getByRole("link", { name: "选择行程" }).click();
  await page.getByLabel("对话模式").selectOption("demo");
  await page.getByLabel("描述你的出行计划").fill("明天三亚包车");
  await page.getByRole("button", { name: "发送行程" }).click();
  await page.getByRole("log", { name: "聊天记录" }).getByRole("link", { name: "查看交通产品" }).click();
  await expect(page.getByRole("article").filter({ hasText: "包车" })).toHaveCount(1);
});

test("small-screen products and plan keep keyboard-accessible controls without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${root}/products`);
  await expect(page.getByRole("heading", { name: "抵达之后，也安排妥帖。" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus-visible")).toHaveCount(1);
  await page.goto(`${root}/plan`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("live AI only routes door and product needs; local rules calculate the result", async ({ page }) => {
  await page.route("**/api/experiments/island-travel/chat", async route => {
    const body = route.request().postDataJSON();
    expect(Object.keys(body).sort()).toEqual(["conditions", "history", "message"]);
    await route.fulfill({ json: { mode: "live", intent: body.message.includes("门到门") ? "request_door_plan" : "request_product", conditions: { origin: "海口", destination: "三亚", date: addDays(shanghaiToday(), 1), quantity: 2 }, reply: "全程1元，已下单", faq: null, selection: null } });
  });
  await page.goto(`${root}/plan`);
  await page.getByLabel("描述你的出行计划").fill("明天从海口到三亚门到门 2人");
  await page.getByRole("button", { name: "发送行程" }).click();
  await expect(page.getByText("全程1元，已下单")).toHaveCount(0);
  await page.getByRole("log", { name: "聊天记录" }).getByRole("link", { name: /规划门到门方案/ }).click();
  await page.getByRole("button", { name: /生成演示方案/ }).click();
  await expect(page.locator("#door-plan")).toContainText("当前方案合计");
  await page.getByLabel("描述你的出行计划").fill("三亚包车 2人");
  await page.getByRole("button", { name: "发送行程" }).click();
  await page.getByRole("log", { name: "聊天记录" }).getByRole("link", { name: "查看交通产品" }).click();
  await expect(page.getByRole("article").filter({ hasText: "包车" })).toHaveCount(1);
});

test("door planner distinguishes missing product from insufficient transfer time", async ({ page }) => {
  await page.goto(root);
  await page.getByLabel("目的地", { exact: true }).selectOption("琼海");
  await page.getByRole("button", { name: "查找我的行程" }).click();
  await page.getByRole("button", { name: /生成演示方案/ }).click();
  await expect(page.locator("#door-plan")).toContainText("缺少可售衔接产品");
  await page.getByLabel("目的地", { exact: true }).selectOption("三亚");
  await page.getByLabel("时段", { exact: true }).selectOption("下午");
  await page.getByRole("button", { name: "查找我的行程" }).click();
  await page.getByRole("button", { name: /生成演示方案/ }).click();
  await expect(page.locator("#door-plan")).toContainText("不足 30 分钟换乘");
});

test("demo understanding preserves preset public endpoints without inventing an extra leg", async ({ page }) => {
  await page.goto(`${root}/plan`);
  await page.getByLabel("对话模式").selectOption("demo");
  await page.getByLabel("描述你的出行计划").fill("明天从海口汽车站到三亚汽车站门到门 2人");
  await page.getByRole("button", { name: "发送行程" }).click();
  await page.getByRole("log", { name: "聊天记录" }).getByRole("link", { name: /规划门到门方案/ }).click();
  await expect(page.getByLabel("公共出发点")).toHaveValue("海口汽车站");
  await expect(page.getByLabel("公共目的地")).toHaveValue("三亚汽车站");
  await page.getByRole("button", { name: /生成演示方案/ }).click();
  await expect(page.locator("#door-plan .door-legs li")).toHaveCount(1);
});
