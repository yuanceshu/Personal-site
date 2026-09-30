import { expect, test } from "@playwright/test";

const labels = ["行业", "实验", "创造", "授课", "思记"];
const ids = ["industry", "experiments", "creation", "teaching", "thoughts"];

test("首页下拉菜单由交互打开，滚动不选中栏目", async ({ page }) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "主要导航" });
  await expect(navigation.getByRole("button")).toHaveText(labels);
  await page.mouse.move(0, 0);
  for (const id of ids) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await expect(navigation.locator('[aria-expanded="true"]')).toHaveCount(0);
  }
  for (const [index, label] of labels.entries()) {
    const trigger = navigation.getByRole("button", { name: label, exact: true });
    const panel = page.locator(`#home-navigation-${ids[index]}`);
    await trigger.hover();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(navigation.locator('[aria-expanded="true"]')).toHaveCount(1);
    await panel.getByRole("link").first().hover();
    await expect(panel).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(panel).toBeHidden();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  }
  await navigation.getByRole("button", { name: "行业", exact: true }).hover();
  const links = page.locator("#home-navigation-industry").getByRole("link");
  await expect(links).toHaveText(["岛见↗", "云川财务智能体↗", "林泉↗", "琴台票务↗", "明川医院↗", "食智助手↗", "探索更多案例↗"]);
  for (const [index, href] of ["/works/demos/island-travel", "/works/demos/finance-assistant", "/works/demos/linquan", "/works/demos/qintai-ticketing", "/works/demos/medical-ai", "/works/demos/restaurant-ai", "/works/demos"].entries()) {
    await expect(links.nth(index)).toHaveAttribute("href", href);
  }
  await navigation.getByRole("button", { name: "创造", exact: true }).hover();
  await expect(page.locator("#home-navigation-creation a")).toHaveAttribute("href", (await page.locator("#creation").getAttribute("href"))!);
});

test("键盘展开、Esc 返回和现有思记入口", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "思记", exact: true });
  const panel = page.locator("#home-navigation-thoughts");
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(panel.getByRole("link")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(panel).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(panel.getByRole("link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/thoughts$/);
  await expect(page.getByRole("navigation", { name: "主要导航" }).getByRole("link")).toHaveText("返回首页");
});

test.describe("触屏导航", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test("点击切换、点击外部关闭及窄屏下拉边界", async ({ page }) => {
    await page.goto("/");
    await page.locator(".site-header").scrollIntoViewIfNeeded();
    for (const [index, label] of labels.entries()) {
      const trigger = page.getByRole("button", { name: label, exact: true });
      const panel = page.locator(`#home-navigation-${ids[index]}`);
      await trigger.tap();
      await expect(panel).toBeVisible();
      const box = (await panel.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      await trigger.tap();
      await expect(panel).toBeHidden();
    }
    await page.getByRole("button", { name: "行业", exact: true }).tap();
    await page.touchscreen.tap(4, 500);
    await expect(page.locator("#home-navigation-industry")).toBeHidden();
  });
});

test("放大文字后下拉菜单仍在视口内", async ({ page }) => {
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    for (const label of labels) {
      await page.getByRole("button", { name: label, exact: true }).hover();
      const box = (await page.locator(".home-navigation__dropdown:visible").boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("行业原文、分栏比例与更多案例颜色", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#industry .home-card__lines span")).toHaveText([
    "这里是行业 demo 合集。",
    "AI 给售前带来的一大幸事，是面对各行业客户，能快速构建 Demo。",
    "直观，促成签单。",
  ]);
  const ratio = await page.locator(".home-bento__industry-body").evaluate((element) => {
    const widths = getComputedStyle(element).gridTemplateColumns.split(" ").map(parseFloat);
    return widths[0] / (widths[0] + widths[1]);
  });
  expect(ratio).toBeCloseTo(0.575, 3);
  await expect(page.locator(".home-bento__industry-more")).toHaveCSS("color", "rgb(0, 113, 227)");
  await expect(page.locator(".home-bento__industries li")).toHaveCount(3);
  await expect(page.locator(".home-bento__industries li").nth(0).getByRole("link")).toHaveAttribute("href", "/works/demos/finance-assistant");
  await expect(page.locator(".home-bento__industries li").nth(1).getByRole("link")).toHaveAttribute("href", "/works/demos/island-travel");
});

test.describe("Demo 返回导航", () => {
  const routes = [
    "/works/demos/island-travel",
    "/works/demos/island-travel/plan",
    "/works/demos/island-travel/confirm",
    "/works/demos/island-travel/journeys",
    "/works/demos/island-travel/journeys/DJ-0001",
    "/works/demos/island-travel/orders",
    "/works/demos/island-travel/orders/DJ-0001",
    "/works/demos/island-travel/orders/DJ-0001/refund",
    "/works/demos/island-travel/orders/DJ-0001/reschedule",
    "/works/demos/island-travel/orders/DJ-0001/invoice",
    "/works/demos/island-travel/orders/DJ-0001/support",
    "/works/demos/restaurant-ai",
    "/works/demos/restaurant-ai/customer-service",
    "/works/demos/restaurant-ai/operations",
    "/works/demos/restaurant-ai/finance",
    "/works/demos/linquan",
    "/works/demos/qintai-ticketing",
    "/works/demos/qintai-ticketing/shows",
    "/works/demos/qintai-ticketing/shows/AT-TIX-101-PIT",
    "/works/demos/qintai-ticketing/shows/missing",
    "/works/demos/qintai-ticketing/merchant",
    "/works/demos/qintai-ticketing/merchant/events",
    "/works/demos/qintai-ticketing/merchant/holds",
    "/works/demos/finance-assistant",
    "/works/demos/medical-ai",
  ];

  test("每个 Demo 首页和代表性深层页都有唯一的合集出口", async ({ page }) => {
    for (const route of routes) {
      await page.goto(route);
      const exit = page.locator('a[aria-label="返回 Demo 合集"]:visible');
      await expect(exit, route).toHaveCount(1);
      await expect(exit).toHaveAttribute("href", "/works/demos");
      await exit.click();
      await expect(page).toHaveURL(/\/works\/demos\/?$/);
    }
  });

  test("移动端仍保留可见的合集出口", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ["/works/demos/linquan", "/works/demos/finance-assistant", "/works/demos/medical-ai", "/works/demos/qintai-ticketing/merchant"]) {
      await page.goto(route);
      await expect(page.locator('a[aria-label="返回 Demo 合集"]:visible'), route).toHaveCount(1);
    }
  });
});


test("内部返回遵循首页、列表、业务详情层级", async ({ page }) => {
  const island = "/works/demos/island-travel";
  const cases = [
    ["/plan", "返回岛见首页", ""],
    ["/orders", "返回岛见首页", ""],
    ["/journeys", "返回岛见首页", ""],
    ["/confirm", "返回选择行程", "/plan"],
    ["/products/confirm", "返回交通产品", "/products"],
    ["/orders/DJ-0001", "查看全部订单", "/orders"],
    ["/journeys/DJ-0001", "返回我的行程", "/journeys"],
    ["/orders/DJ-0001/refund", "返回订单", "/orders/DJ-0001"],
    ["/orders/DJ-0001/reschedule", "返回订单", "/orders/DJ-0001"],
    ["/orders/DJ-0001/invoice", "返回订单", "/orders/DJ-0001"],
    ["/orders/DJ-0001/support", "返回对应订单", "/orders/DJ-0001"],
  ];
  for (const [route, label, target] of cases) {
    await page.goto(island + route);
    const back = page.getByRole("link", { name: label, exact: true }).first();
    await expect(back).toHaveAttribute("href", island + target);
    await back.click();
    await expect(page).toHaveURL(island + target);
  }
  const qintai = "/works/demos/qintai-ticketing";
  for (const id of ["AT-TIX-101-PIT", "missing"]) {
    await page.goto(`${qintai}/shows/${id}`);
    const back = page.getByRole("link", { name: "返回演出列表", exact: true });
    await expect(back).toHaveCount(1);
    await back.click();
    await expect(page).toHaveURL(`${qintai}/shows`);
  }
  for (const route of ["/merchant", "/merchant/events", "/merchant/holds"]) {
    await page.goto(qintai + route);
    await page.getByRole("link", { name: "琴台票务首页", exact: true }).click();
    await expect(page).toHaveURL(qintai);
  }
});

test("财务 Logo 返回智能分析并保留会话、上下文和草稿", async ({ page }) => {
  await page.route("**/api/experiments/finance-assistant/chat", route => route.fulfill({
    json: { answer: "导航测试回答", blocks: [], context: { lastChannel: "银联" } },
  }));
  await page.goto("/works/demos/finance-assistant");
  const input = page.locator("#finance-question");
  await input.fill("查询上月销售额");
  await page.getByRole("button", { name: "发送问题", exact: true }).click();
  await expect(page.getByText("导航测试回答", { exact: true })).toBeVisible();
  await input.fill("保留这条未发送的草稿");
  await page.getByRole("button", { name: /渠道对账/ }).click();
  await expect(input).toBeHidden();
  await page.getByRole("button", { name: "云川财务智能体首页", exact: true }).click();
  await expect(page.getByRole("heading", { name: "把问题交给数据。" })).toBeVisible();
  await expect(page.getByText("导航测试回答", { exact: true })).toBeVisible();
  await expect(page.locator(".context-strip")).toContainText("银联");
  await expect(input).toHaveValue("保留这条未发送的草稿");
});

test("各 Demo 在窄屏和桌面保留完整、可触控的返回入口", async ({ page }) => {
  const routes = [
    "/works/demos/island-travel",
    "/works/demos/restaurant-ai",
    "/works/demos/restaurant-ai/customer-service",
    "/works/demos/restaurant-ai/operations",
    "/works/demos/restaurant-ai/finance",
    "/works/demos/linquan",
    "/works/demos/finance-assistant",
    "/works/demos/medical-ai",
    "/works/demos/qintai-ticketing",
    "/works/demos/qintai-ticketing/shows/AT-TIX-101-PIT",
    "/works/demos/qintai-ticketing/merchant",
    "/works/demos/qintai-ticketing/merchant/events",
    "/works/demos/qintai-ticketing/merchant/holds",
  ];
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of routes) {
      await page.goto(route);
      const exit = page.getByRole("link", { name: "返回 Demo 合集", exact: true });
      await expect(exit).toBeVisible();
      const box = (await exit.boundingBox())!;
      expect(box.height, `${route} at ${width}`).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThan(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(await exit.locator("span").last().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} at ${width}`).toBe(true);
      await exit.focus();
      await expect(exit).toBeFocused();
      expect(await exit.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none");
      await exit.click();
      await expect(page).toHaveURL(/\/works\/demos\/?$/);
    }
  }
});
