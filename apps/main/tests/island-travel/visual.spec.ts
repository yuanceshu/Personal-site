import { expect, test } from "@playwright/test";

const path = "/works/demos/island-travel";
for (const width of [1440, 375]) {
  test(`visual record of every step at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(path);
    await page.getByRole("button", { name: "查找我的行程" }).isEnabled();
    await page.locator(".hero-image").evaluate((img: HTMLImageElement) => img.decode());
    await page.screenshot({ path: `test-results/island-new/home-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "查找我的行程" }).click();
    await expect(page).toHaveURL(/\/plan$/);
    await page.screenshot({ path: `test-results/island-new/plan-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: /选择第1班/ }).click();
    await expect(page).toHaveURL(/\/confirm$/);
    await page.screenshot({ path: `test-results/island-new/confirm-${width}.png`, fullPage: true });
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "确认创建订单" }).click();
    await expect(page).toHaveURL(/\/orders\/DJ-0001$/);
    await page.screenshot({ path: `test-results/island-new/payment-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: /支付失败.*保留订单/ }).click();
    await page.screenshot({ path: `test-results/island-new/failed-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: /支付结果未知/ }).click();
    await page.screenshot({ path: `test-results/island-new/unknown-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: /主动查询支付结果/ }).click();
    await page.screenshot({ path: `test-results/island-new/success-${width}.png`, fullPage: true });
    await page.getByRole("link", { name: /我的订单/ }).click();
    await expect(page).toHaveURL(/\/orders$/);
    await page.screenshot({ path: `test-results/island-new/orders-${width}.png`, fullPage: true });
    await page.getByRole("link", { name: "我的行程", exact: true }).click();
    await expect(page).toHaveURL(/\/journeys$/);
    await page.screenshot({ path: `test-results/island-new/journeys-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("link", { name: /DJ-0001.*待出发/ }).click();
    await expect(page).toHaveURL(/\/journeys\/DJ-0001$/);
    await page.screenshot({ path: `test-results/island-new/journey-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("link", { name: "查看退票试算" }).click();
    await expect(page).toHaveURL(/\/orders\/DJ-0001\/refund$/);
    await page.getByRole("button", { name: "查看退票试算" }).click();
    await page.screenshot({ path: `test-results/island-new/refund-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("link", { name: "返回订单", exact: true }).first().click();
    await expect(page).toHaveURL(/\/orders\/DJ-0001$/);
    await page.getByRole("link", { name: "查看演示开票" }).click();
    await expect(page).toHaveURL(/\/orders\/DJ-0001\/invoice$/);
    await page.screenshot({ path: `test-results/island-new/invoice-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("link", { name: "返回订单", exact: true }).first().click();
    await expect(page).toHaveURL(/\/orders\/DJ-0001$/);
    await page.getByRole("link", { name: "选择新班次" }).click();
    await expect(page).toHaveURL(/\/orders\/DJ-0001\/reschedule$/);
    await page.getByRole("button", { name: /13:30 → 16:50/ }).click();
    await page.getByRole("button", { name: "查看改签报价" }).click();
    await page.screenshot({ path: `test-results/island-new/reschedule-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("enlarged text, high contrast and reduced motion remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce", contrast: "more" });
  await page.goto(path + "/plan");
  // Browser zoom equivalence: a narrow CSS viewport plus doubled text, including px typography.
  await page.locator(".island-app").evaluate(root => {
    const elements = [...root.querySelectorAll<HTMLElement>("*")];
    const sizes = elements.map(el => parseFloat(getComputedStyle(el).fontSize));
    elements.forEach((el, i) => { el.style.fontSize = `${sizes[i] * 2}px`; });
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "查找我的行程" })).toBeVisible();
  await page.getByRole("button", { name: "查找我的行程" }).click();
  await expect(page.getByRole("button", { name: /选择第1班/ })).toBeVisible();
});

test("readable text pairs on solid surfaces", async ({ page }) => {
  await page.goto(path + "/plan");
  const pairs = await page.evaluate(() => {
    function rgb(value: string) { return (value.match(/[\d.]+/g) || []).map(Number); }
    function luminance(color: number[]) { return color.slice(0, 3).map(c => { const n = c / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0); }
    return [".step-description", ".mode-caption", ".chat-message p", ".chat-footer p", ".search-note", ".field label", ".site-header nav a", ".back-link"].map(selector => {
      const el = document.querySelector(selector)!;
      const foreground = rgb(getComputedStyle(el).color);
      let ancestor: Element | null = el;
      let background = [0, 0, 0, 0];
      while (ancestor && (background[3] ?? 1) === 0) { background = rgb(getComputedStyle(ancestor).backgroundColor); ancestor = ancestor.parentElement; }
      const a = luminance(foreground), b = luminance(background);
      return { selector, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
    });
  });
  for (const pair of pairs) expect(pair.ratio, pair.selector).toBeGreaterThanOrEqual(4.5);
});
