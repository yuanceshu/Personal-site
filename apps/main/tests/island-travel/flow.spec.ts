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
    await new Promise(resolve => setTimeout(resolve, 3000));
    await route.fulfill({ json: { ...demoInterpret("明天海口去三亚", {}), mode: "live" } }).catch(() => {});
  });
  await page.goto(path + "/plan");
  await page.getByLabel("描述你的出行计划").fill("明天海口去三亚");
  await page.getByRole("button", { name: "发送行程" }).click();
  await page.getByRole("link", { name: /我的订单/ }).click();
  await page.waitForTimeout(3100);
  await page.getByRole("link", { name: "选择行程", exact: true }).click();
  await expect(page.getByRole("button", { name: /选择第1班/ })).toHaveCount(0);
  await page.getByRole("button", { name: "发送行程" }).click();
  await page.getByLabel("目的地", { exact: true }).selectOption("文昌");
  await page.getByRole("button", { name: "查找我的行程" }).click();
  await page.waitForTimeout(3100);
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
  await page.goto(path + "/journeys/DJ-9999");
  await expect(page.getByText("这段行程不在当前体验中。")).toBeVisible();
  await page.goto(path + "/orders/DJ-9999/refund");
  await expect(page.getByText("这张订单不在当前会话中。")).toBeVisible();
  await page.goto(path + "/orders/DJ-9999/reschedule");
  await expect(page.getByText("这张订单不在当前会话中。")).toBeVisible();
  await page.goto(path + "/orders/DJ-9999/invoice");
  await expect(page.getByText("这张订单不在当前会话中。")).toBeVisible();
});

test("ticketed journey, credential and manual stages are linked to order", async ({ page }) => {
  await purchase(page);
  await page.getByRole("link", { name: "我的行程", exact: true }).click();
  await expect(page.getByRole("heading", { name: "还没有可体验的行程。" })).toBeVisible();
  await page.getByRole("link", { name: /我的订单/ }).click();
  await page.getByRole("link", { name: /DJ-0001.*待支付/ }).click();
  await page.getByRole("button", { name: /支付成功.*完成模拟出票/ }).click();
  await page.getByRole("link", { name: "查看我的行程" }).click();
  await expect(page).toHaveURL(new RegExp(path + "/journeys/DJ-0001$"));
  await expect(page.getByLabel("岛见演示乘车凭证，不可乘车")).toContainText("DEMO / 不可乘车");
  await expect(page.getByLabel("行程摘要")).toContainText("2 位演示乘客");
  await page.getByRole("button", { name: "确认模拟检票" }).click();
  await expect(page.getByRole("button", { name: "确认模拟发车" })).toBeVisible();
  await expect(page.getByRole("link", { name: /查看退票试算/ })).toHaveCount(0);
  await page.getByRole("button", { name: "确认模拟发车" }).click();
  await page.getByRole("button", { name: "确认模拟到达" }).click();
  await expect(page.getByText("演示行程已到达，体验结束。")).toBeVisible();
  await page.getByRole("link", { name: "查看对应订单" }).click();
  await expect(page.getByRole("heading", { name: "已出票", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("这张订单不在当前会话中。")).toBeVisible();
});

test("refund failure preserves journey; success cancels credential and frees seats", async ({ page }) => {
  await purchase(page);
  await page.getByRole("button", { name: /支付成功.*完成模拟出票/ }).click();
  await page.getByRole("link", { name: "查看退票试算" }).click();
  await page.getByRole("button", { name: "查看退票试算" }).click();
  await expect(page.getByText("演示手续费 · 10%")).toBeVisible();
  await expect(page.getByRole("button", { name: "确认演示退票成功" })).toBeDisabled();
  await page.getByLabel("退票失败").check();
  await page.getByRole("checkbox", { name: /已核对试算/ }).check();
  await page.getByRole("button", { name: "确认演示退票失败" }).click();
  await expect(page.getByText(/原订单、凭证与行程均保留/)).toBeVisible();
  await page.getByLabel("退票成功").check();
  await page.getByRole("checkbox", { name: /已核对试算/ }).check();
  await page.getByRole("button", { name: "确认演示退票成功" }).dblclick();
  await expect(page.getByText("演示退票已完成。")).toBeVisible();
  await page.getByRole("link", { name: "返回订单" }).last().click();
  await expect(page.getByRole("heading", { name: "已退款" })).toBeVisible();
  await page.getByRole("link", { name: "查看已取消行程" }).click();
  await expect(page.getByText("行程已取消，凭证已失效。")).toBeVisible();
  await expect(page.getByLabel("岛见演示乘车凭证，不可乘车")).toHaveCount(0);
  await page.getByRole("link", { name: "选择行程", exact: true }).click();
  await page.getByRole("button", { name: "查找我的行程" }).click();
  await expect(page.getByRole("button", { name: /选择第1班/ })).toContainText("余 12 席");
  await page.getByRole("button", { name: /选择第1班/ }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "确认创建订单" }).click();
  await expect(page).toHaveURL(new RegExp(path + "/orders/DJ-0002$"));
});

test("demo and live refund requests only offer a structured entry", async ({ page }) => {
  await page.goto(path + "/plan");
  await page.getByLabel("对话模式").selectOption("demo");
  await page.getByLabel("描述你的出行计划").fill("我要退票");
  await page.getByRole("button", { name: "发送行程" }).click();
  await expect(page.getByRole("link", { name: "选择演示订单" })).toBeVisible();
  await page.route("**/api/experiments/island-travel/chat", async route => {
    const body = route.request().postDataJSON();
    expect(Object.keys(body).sort()).toEqual(["conditions", "history", "message"]);
    await route.fulfill({ json: { intent: "request_refund", conditions: body.conditions, reply: "已退款 1 元", faq: null, selection: null, mode: "live" } });
  });
  await page.getByLabel("对话模式").selectOption("live");
  await page.getByLabel("描述你的出行计划").fill("我要退票");
  await page.getByRole("button", { name: "发送行程" }).click();
  await expect(page.getByText("已退款 1 元")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "选择演示订单" })).toHaveCount(2);
});

test("refund intent with multiple orders asks user to choose an order", async ({ page }) => {
  await purchase(page);
  await page.getByRole("button", { name: /支付成功.*完成模拟出票/ }).click();
  await page.getByRole("link", { name: "选择行程", exact: true }).click();
  await page.getByRole("button", { name: "查找我的行程" }).click();
  await page.getByRole("button", { name: /选择第1班/ }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "确认创建订单" }).click();
  await page.getByRole("link", { name: "选择行程", exact: true }).click();
  await page.getByLabel("对话模式").selectOption("demo");
  await page.getByLabel("描述你的出行计划").fill("我要退票");
  await page.getByRole("button", { name: "发送行程" }).click();
  await expect(page.getByText("请先从订单列表选择要退的车票，再查看演示退票试算。")).toBeVisible();
  await page.getByRole("link", { name: "选择演示订单" }).click();
  await expect(page).toHaveURL(new RegExp(path + "/orders$"));
  await expect(page.locator(".order-row")).toHaveCount(2);
});

test("paid reschedule unknown lookup updates one order, voids invoice and reissues on new fare", async ({ page }) => {
  await purchase(page);
  await page.getByRole("button", { name: /支付成功.*完成模拟出票/ }).click();
  await page.getByRole("link", { name: "查看演示开票" }).click();
  await page.getByRole("checkbox", { name: /已核对演示抬头/ }).check();
  await page.getByRole("button", { name: "确认生成演示开票记录" }).dblclick();
  await expect(page.getByText("演示开票记录已生成")).toBeVisible();
  await page.getByRole("link", { name: /查看订单与操作历史/ }).click();
  await page.getByRole("link", { name: "选择新班次" }).click();
  await page.getByRole("button", { name: /13:30 → 16:50/ }).click();
  await page.getByRole("button", { name: "查看改签报价" }).click();
  await expect(page.getByText("需补差价")).toBeVisible();
  await expect(page.getByText("¥20.00")).toBeVisible();
  await page.getByRole("checkbox", { name: /已核对原行程/ }).check();
  await page.getByRole("button", { name: /确认进入补差价支付/ }).dblclick();
  await expect(page.getByText("原票继续有效。")).toBeVisible();
  await page.getByRole("button", { name: /支付结果未知，稍后查单/ }).click();
  await expect(page.getByRole("button", { name: /主动查询改签支付结果/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /取消本次改签/ })).toHaveCount(0);
  await page.getByRole("button", { name: /主动查询改签支付结果/ }).click();
  await expect(page.getByText("改签已完成。")).toBeVisible();
  await page.getByRole("link", { name: /查看更新后的订单/ }).click();
  await expect(page.getByRole("complementary")).toContainText("13:30");
  await expect(page.getByRole("complementary")).toContainText("276");
  await expect(page.getByRole("listitem").filter({ hasText: "生成演示开票记录 · 已作废" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "改签成功" })).toContainText("补差 ¥20.00");
  await expect(page.getByText("累计模拟支付").locator("..")).toContainText("¥276.00");
  await page.getByRole("link", { name: "查看演示开票" }).click();
  await page.getByLabel("岛见演示公司").check();
  await page.getByRole("checkbox", { name: /已核对演示抬头/ }).check();
  await page.getByRole("button", { name: "确认生成演示开票记录" }).click();
  await expect(page.getByText("演示开票记录已生成")).toBeVisible();
  await expect(page.getByRole("region", { name: "演示开票" }).getByText("¥276.00", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /查看订单与操作历史/ }).click();
  await page.getByRole("link", { name: "查看退票试算" }).click();
  await page.getByRole("button", { name: "查看退票试算" }).click();
  await page.getByRole("checkbox", { name: /已核对试算/ }).check();
  await page.getByRole("button", { name: "确认演示退票成功" }).click();
  await page.getByRole("link", { name: "返回订单" }).last().click();
  await expect(page.getByRole("listitem").filter({ hasText: "生成演示开票记录 · 已作废" })).toHaveCount(2);
  await expect(page.getByText("当前净额").locator("..")).toContainText("¥27.60");
  await expect(page.getByRole("link", { name: "查看演示开票" })).toHaveCount(0);
});

test("reschedule payment failure keeps old journey and can retry same attempt", async ({ page }) => {
  await purchase(page);
  await page.getByRole("button", { name: /支付成功.*完成模拟出票/ }).click();
  await page.getByRole("link", { name: "选择新班次" }).click();
  await page.getByRole("button", { name: /13:30 → 16:50/ }).click();
  await page.getByRole("button", { name: "查看改签报价" }).click();
  await page.getByRole("checkbox", { name: /已核对原行程/ }).check();
  await page.getByRole("button", { name: /确认进入补差价支付/ }).click();
  await page.getByRole("button", { name: /支付失败，保留原票/ }).click();
  await expect(page.getByText(/此次补差价支付失败/)).toBeVisible();
  await expect(page.getByRole("complementary")).toContainText("07:30");
  await page.getByRole("button", { name: /支付成功，完成改签/ }).click();
  await expect(page.getByText("改签已完成。")).toBeVisible();
});

test("refund after cheaper reschedule uses current fare and returns current seats", async ({ page }) => {
  await query(page);
  await page.getByLabel("时段", { exact: true }).selectOption("不限");
  await page.getByRole("button", { name: "查找我的行程" }).click();
  await page.getByRole("button", { name: /选择第.*16:00/ }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "确认创建订单" }).click();
  await page.getByRole("button", { name: /支付成功.*完成模拟出票/ }).click();
  await page.getByRole("link", { name: "选择新班次" }).click();
  await page.getByRole("button", { name: /07:30 → 10:50/ }).click();
  await page.getByRole("button", { name: "查看改签报价" }).click();
  await expect(page.getByText("应退差价")).toBeVisible();
  await page.getByLabel("改签失败").check();
  await page.getByRole("checkbox", { name: /已核对原行程/ }).check();
  await page.getByRole("button", { name: "确认演示改签失败" }).click();
  await expect(page.getByText(/原票和座位保持不变/)).toBeVisible();
  await page.getByLabel("改签成功").check();
  await page.getByRole("checkbox", { name: /已核对原行程/ }).check();
  await page.getByRole("button", { name: "确认演示改签成功" }).click();
  await page.getByRole("link", { name: /查看更新后的订单/ }).click();
  await expect(page.getByRole("complementary")).toContainText("¥128");
  await expect(page.getByText("累计模拟退回").locator("..")).toContainText("¥20.00");
  await page.getByRole("link", { name: "查看退票试算" }).click();
  await page.getByRole("button", { name: "查看退票试算" }).click();
  await expect(page.getByText("¥115.20")).toBeVisible();
  await page.getByRole("checkbox", { name: /已核对试算/ }).check();
  await page.getByRole("button", { name: "确认演示退票成功" }).click();
  await page.getByRole("link", { name: "返回订单" }).last().click();
  await expect(page.getByText("当前净额").locator("..")).toContainText("¥12.80");
  await page.getByRole("link", { name: /我的订单/ }).click();
  await page.getByRole("button", { name: "售后" }).click();
  await expect(page.locator(".order-row")).toHaveCount(1);
});

test("demo and live AI only guide reschedule and invoice without order data", async ({ page }) => {
  await page.goto(path + "/plan");
  await page.getByLabel("对话模式").selectOption("demo");
  await page.getByLabel("描述你的出行计划").fill("我要改签");
  await page.getByRole("button", { name: "发送行程" }).click();
  await expect(page.getByRole("link", { name: "选择演示订单" })).toBeVisible();
  await page.route("**/api/experiments/island-travel/chat", route => {
    const body = route.request().postDataJSON();
    expect(Object.keys(body).sort()).toEqual(["conditions", "history", "message"]);
    expect(JSON.stringify(body)).not.toContain("DJ-0001");
    return route.fulfill({ json: { intent: "request_invoice", conditions: body.conditions, reply: "已开票 1 元", faq: null, selection: null, mode: "live" } });
  });
  await page.getByLabel("对话模式").selectOption("live");
  await page.getByLabel("描述你的出行计划").fill("我要开发票");
  await page.getByRole("button", { name: "发送行程" }).click();
  await expect(page.getByText("已开票 1 元")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "选择演示订单" })).toHaveCount(2);
});

test("zero difference changes trip without payment and after-sales filter finds it", async ({ page }) => {
  await query(page);
  await page.getByRole("button", { name: /选择第2班 09:15/ }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "确认创建订单" }).click();
  await page.getByRole("button", { name: /支付成功.*完成模拟出票/ }).click();
  await page.getByRole("link", { name: "选择新班次" }).click();
  await page.getByRole("button", { name: /13:30 → 16:50/ }).click();
  await page.getByRole("button", { name: "查看改签报价" }).click();
  await expect(page.getByText("差价", { exact: true })).toBeVisible();
  await expect(page.getByText("¥0.00", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: /已核对原行程/ }).check();
  await page.getByRole("button", { name: "确认演示改签成功" }).click();
  await expect(page.getByText("改签已完成。")).toBeVisible();
  await page.getByRole("link", { name: /查看更新后的订单/ }).click();
  await expect(page.getByText("当前净额").locator("..")).toContainText("¥138.00");
  await page.getByRole("link", { name: /我的订单/ }).click();
  await page.getByRole("button", { name: "售后" }).click();
  await expect(page.locator(".order-row")).toHaveCount(1);
});

test("sold-out target and ineligible order show clear local guidance", async ({ page }) => {
  await query(page);
  await page.getByRole("button", { name: /选择第2班 09:15/ }).click();
  await page.getByLabel("乘车人数", { exact: true }).selectOption("3");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "确认创建订单" }).click();
  await page.getByRole("button", { name: /支付成功.*完成模拟出票/ }).click();
  await page.getByRole("link", { name: "选择行程", exact: true }).click();
  await page.getByLabel("同行人数", { exact: true }).selectOption("1");
  await page.getByRole("button", { name: "查找我的行程" }).click();
  await page.getByRole("button", { name: /选择第1班 07:30/ }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "确认创建订单" }).click();
  await expect(page.getByRole("link", { name: "选择新班次" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "查看演示开票" })).toHaveCount(0);
  await expect(page.getByText("仅已出票且待出发的车票可改签。")).toBeVisible();
  await page.getByRole("button", { name: /支付成功.*完成模拟出票/ }).click();
  await page.getByRole("link", { name: "选择新班次" }).click();
  await expect(page.getByRole("button", { name: /09:15 → 12:35/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /13:30 → 16:50/ })).toBeVisible();
});

test("new service pages remain keyboard operable on a small reduced-motion screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await purchase(page);
  await page.getByRole("button", { name: /支付成功.*完成模拟出票/ }).click();
  await page.getByRole("link", { name: "选择新班次" }).click();
  const target = page.getByRole("button", { name: /13:30 → 16:50/ });
  await target.focus();
  await page.keyboard.press("Enter");
  await expect(target).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "查看改签报价" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("checkbox", { name: /已核对原行程/ }).focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: /确认进入补差价支付/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /支付成功，完成改签/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
    await new Promise(resolve => setTimeout(resolve, 3000));
    await route.abort().catch(() => {});
  });
  await page.goto(path + "/plan");
  await page.getByLabel("描述你的出行计划").fill("手机号13800138000");
  await page.getByRole("button", { name: "发送行程" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("不要发送真实住址、手机号");
  expect(calls).toBe(0);
  await page.getByLabel("描述你的出行计划").fill("我家在某某小区，想要门到门");
  await page.getByRole("button", { name: "发送行程" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("不要发送真实住址");
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
