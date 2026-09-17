import { expect, test, type Page } from "@playwright/test";
import { demoInterpret } from "../../lib/works/island-travel/domain";

const path = "/works/demos/island-travel";
async function query(page: Page) {
  await page.goto(path);
  await page.getByRole("button", { name: "查找我的行程" }).click();
  await expect(page).toHaveURL(new RegExp(path + "/plan$"));
  await expect(page.getByRole("button", { name: /选择第1班/ })).toBeVisible();
}
async function purchase(page: Page) {
  await query(page);
  await page.getByRole("button", { name: /选择第1班/ }).click();
  await expect(page).toHaveURL(new RegExp(path + "/confirm$"));
  await expect(page.getByRole("heading", { name: "为下一程，留一个位置。" })).toBeFocused();
  await expect(page.getByRole("button", { name: "确认创建订单" })).toBeDisabled();
  await page.getByLabel("乘车人数", { exact: true }).selectOption("2");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "确认创建订单" }).click();
  await expect(page).toHaveURL(new RegExp(path + "/orders/DJ-0001$"));
  await expect(page.getByRole("list", { name: "购票进度" }).locator('[aria-current="step"]')).toContainText("模拟出票");
}
for (const scenario of ["success", "unknown", "failed", "ticketing_failed"] as const) {
  test(`complete purchase and recover ${scenario}`, async ({ page }) => {
    await purchase(page);
    if (scenario === "success") await page.getByRole("button", { name: /支付成功.*完成模拟出票/ }).click();
    if (scenario === "unknown") {
      await page.getByRole("button", { name: /支付结果未知/ }).click();
      await expect(page.getByRole("button", { name: /支付成功.*完成模拟出票/ })).toHaveCount(0);
      await page.getByRole("link", { name: /我的订单/ }).click();
      await page.getByRole("link", { name: /DJ-0001.*支付确认中/ }).click();
      await page.getByRole("button", { name: /主动查询支付结果/ }).click();
    }
    if (scenario === "failed") {
      await page.getByRole("button", { name: /支付失败.*保留订单/ }).click();
      await expect(page.getByRole("status")).toContainText("订单已保留");
      await page.getByRole("button", { name: /支付成功.*完成模拟出票/ }).click();
    }
    if (scenario === "ticketing_failed") {
      await page.getByRole("button", { name: /支付成功，出票异常/ }).click();
      await expect(page.getByRole("button", { name: /支付成功.*完成模拟出票/ })).toHaveCount(0);
      await page.getByRole("button", { name: /重试出票/ }).click();
    }
    await expect(page.getByText("这一程，安排好了。")).toBeVisible();
    await expect(page.getByRole("heading", { name: "已出票", exact: true })).toBeFocused();
    await page.getByRole("link", { name: /我的订单/ }).click();
    await expect(page.getByRole("link", { name: /DJ-0001.*2 人.*已出票/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "还没有订单。" })).toBeVisible();
  });
}

test("quick form does not call AI and navigation preserves conditions", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/experiments/island-travel/chat", route => { calls++; return route.abort(); });
  await page.goto(path);
  await page.getByLabel("目的地", { exact: true }).selectOption("琼海");
  await page.getByLabel("同行人数", { exact: true }).selectOption("3");
  await page.getByLabel("时段", { exact: true }).selectOption("下午");
  await page.getByRole("button", { name: "查找我的行程" }).click();
  await expect(page).toHaveURL(new RegExp(path + "/plan$"));
  await page.getByRole("button", { name: /选择第1班 13:30.*琼海/ }).click();
  await expect(page.getByLabel("乘车人数", { exact: true })).toHaveValue("3");
  await page.goBack();
  await expect(page.getByLabel("目的地", { exact: true })).toHaveValue("琼海");
  await expect(page.getByLabel("同行人数", { exact: true })).toHaveValue("3");
  await expect(page.getByLabel("对话模式")).toHaveValue("live");
  await page.goForward();
  await expect(page.getByLabel("乘车人数", { exact: true })).toHaveValue("3");
  expect(calls).toBe(0);
});

test("live success sends only contract; changes and selection use deterministic fares", async ({ page }) => {
  await page.route("**/api/experiments/island-travel/chat", async route => {
    const body = route.request().postDataJSON();
    expect(Object.keys(body).sort()).toEqual(["conditions", "history", "message"]);
    await route.fulfill({ json: { ...demoInterpret(body.message, body.conditions), reply: "票价1元，已支付", mode: "live" } });
  });
  await query(page);
  await page.getByLabel("描述你的出行计划").fill("改成下午，2人");
  await page.getByRole("button", { name: "发送行程" }).click();
  await expect(page.getByRole("button", { name: /选择第1班 13:30/ })).toBeVisible();
  await expect(page.getByText("票价1元，已支付")).toHaveCount(0);
  await page.getByLabel("描述你的出行计划").fill("选择第二班，两人");
  await page.getByRole("button", { name: "发送行程" }).click();
  await expect(page).toHaveURL(new RegExp(path + "/confirm$"));
  await expect(page.getByLabel("乘车人数", { exact: true })).toHaveValue("2");
  await expect(page.getByRole("complementary")).toContainText("16:00");
  await expect(page.getByRole("complementary")).toContainText("296");
});

test("live failure retains input; explicit demo works and new journey ignores stale response", async ({ page }) => {
  await page.route("**/api/experiments/island-travel/chat", route => route.fulfill({ status: 503, json: { error: "测试服务不可用" } }));
  await page.goto(path + "/plan");
  await page.getByRole("button", { name: /01.*明天上午/ }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("测试服务不可用");
  await expect(page.getByLabel("描述你的出行计划")).toHaveValue("明天上午从海口去三亚");
  await page.getByRole("button", { name: "切换演示模式" }).click();
  await page.getByRole("button", { name: "发送行程" }).click();
  await expect(page.getByRole("button", { name: /选择第1班/ })).toBeVisible();
  await page.unrouteAll();
  await page.route("**/api/experiments/island-travel/chat", async route => {
    await new Promise(resolve => setTimeout(resolve, 700));
    await route.fulfill({ json: { ...demoInterpret("明天上午从海口去三亚", {}), mode: "live" } }).catch(() => {});
  });
  await page.getByLabel("对话模式").selectOption("live");
  await page.getByLabel("描述你的出行计划").fill("明天上午从海口去三亚");
  await page.getByRole("button", { name: "发送行程" }).click();
  await page.getByRole("button", { name: "新行程", exact: true }).click();
  await page.waitForTimeout(900);
  await expect(page.getByRole("button", { name: /选择第1班/ })).toHaveCount(0);
});

test("navigation and fresh quick search cancel an older AI response", async ({ page }) => {
  await page.route("**/api/experiments/island-travel/chat", async route => {
    await new Promise(resolve => setTimeout(resolve, 800));
    await route.fulfill({ json: { ...demoInterpret("明天海口去三亚", {}), mode: "live" } }).catch(() => {});
  });
  await page.goto(path + "/plan");
  await page.getByLabel("描述你的出行计划").fill("明天海口去三亚");
  await page.getByRole("button", { name: "发送行程" }).click();
  await page.getByRole("link", { name: /我的订单/ }).click();
  await page.waitForTimeout(950);
  await page.getByRole("link", { name: "选择行程", exact: true }).click();
  await expect(page.getByRole("button", { name: /选择第1班/ })).toHaveCount(0);
  await page.getByRole("button", { name: "发送行程" }).click();
  await page.getByLabel("目的地", { exact: true }).selectOption("文昌");
  await page.getByRole("button", { name: "查找我的行程" }).click();
  await page.waitForTimeout(950);
  await expect(page.getByRole("heading", { name: "海口 → 文昌" })).toBeVisible();
});

test("confirmation is explicit, quantity changes revoke it, back cannot duplicate order", async ({ page }) => {
  await query(page);
  await page.getByRole("button", { name: /选择第1班/ }).click();
  await page.getByRole("checkbox").check();
  await page.getByLabel("乘车人数", { exact: true }).selectOption("2");
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "确认创建订单" }).dblclick();
  await expect(page).toHaveURL(new RegExp(path + "/orders/DJ-0001$"));
  await page.goBack();
  await expect(page.getByRole("link", { name: /查看已有订单/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "确认创建订单" })).toHaveCount(0);
  await page.getByRole("link", { name: /我的订单/ }).click();
  await expect(page.locator(".order-row")).toHaveCount(1);
  await page.getByRole("button", { name: /规划新行程/ }).click();
  await page.getByRole("link", { name: /我的订单/ }).click();
  await expect(page.locator(".order-row")).toHaveCount(1);
});

test("deep links and refresh have explicit missing-session states", async ({ page }) => {
  await page.goto(path + "/confirm");
  await expect(page.getByText("这段行程还没有选好。")).toBeVisible();
  await page.goto(path + "/orders/DJ-9999");
  await expect(page.getByText("这张订单不在当前会话中。")).toBeVisible();
  await purchase(page);
  await page.reload();
  await expect(page.getByText("这张订单不在当前会话中。")).toBeVisible();
});

test("invalid route and unavailable schedule explain recovery", async ({ page }) => {
  await page.goto(path);
  await page.getByLabel("目的地", { exact: true }).selectOption("海口");
  await page.getByRole("button", { name: "查找我的行程" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("不能相同");
  await page.getByLabel("出发地", { exact: true }).selectOption("文昌");
  await page.getByRole("button", { name: "查找我的行程" }).click();
  await expect(page.getByText("给计划，留一点调整的余地。")).toBeVisible();
});

test("sensitive text stays in browser and cancel retains draft", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/experiments/island-travel/chat", async route => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 700));
    await route.abort().catch(() => {});
  });
  await page.goto(path + "/plan");
  await page.getByLabel("描述你的出行计划").fill("手机号13800138000");
  await page.getByRole("button", { name: "发送行程" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("不要发送真实手机号");
  expect(calls).toBe(0);
  await page.getByLabel("描述你的出行计划").fill("明天去三亚");
  await page.getByRole("button", { name: "发送行程" }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByLabel("描述你的出行计划")).toHaveValue("明天去三亚");
  await expect(page.getByRole("button", { name: "发送行程" })).toBeEnabled();
});

test("all screen widths, keyboard, reduced motion and landscape", async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await query(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: /选择第1班/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "为下一程，留一个位置。" })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "确认创建订单" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: /支付成功.*完成模拟出票/ }).click();
    await page.getByRole("link", { name: /我的订单/ }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 812, height: 375 });
  await query(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
