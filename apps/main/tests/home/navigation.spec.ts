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
  await expect(links).toHaveText(["岛见↗", "食智助手↗", "探索更多案例↗"]);
  for (const [index, href] of ["/works/demos/island-travel", "/works/demos/restaurant-ai", "/works/demos"].entries()) {
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
});
