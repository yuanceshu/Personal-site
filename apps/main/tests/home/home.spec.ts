import { expect, test } from "@playwright/test";

const titles = ["AI + 行业", "AI × 实验", "AI & 创造", "AI 与授课", "AI 思记"];
const indexTitles = ["AI + 行业", "AI × 实验", "AI & 创造", "AI 思记", "AI 与授课"];
const sectionIds = ["industry", "experiments", "creation", "thoughts", "teaching"];

test("作品叙事、真实入口与键盘导航", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.locator(".morning-copy__identity-key")).toHaveCount(2);
  await expect(page.locator(".morning-copy__motivation-key")).toHaveCount(2);
  const copyMetrics = await page.locator(".morning-copy__greeting, .morning-copy__identity, .morning-copy__purpose, .morning-copy__invitation").evaluateAll((elements) => elements.map((element) => {
    const styles = getComputedStyle(element);
    return { fontSize: styles.fontSize, lineHeight: styles.lineHeight };
  }));
  expect(new Set(copyMetrics.map(({ fontSize }) => fontSize)).size).toBe(1);
  expect(new Set(copyMetrics.map(({ lineHeight }) => lineHeight)).size).toBe(1);
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(5);
  for (const [i, title] of titles.entries()) {
    await expect(page.getByRole("heading", { level: 2 }).nth(i)).toHaveAccessibleName(title);
  }
  const index = page.getByRole("list", { name: "接下来的内容" });
  await expect(index.getByRole("listitem")).toHaveCount(indexTitles.length);
  await expect(index.getByRole("link")).toHaveCount(titles.length);
  for (const [i, title] of indexTitles.entries()) {
    await expect(index.getByRole("link").nth(i)).toHaveAttribute("href", `#${sectionIds[i]}`);
    await expect(index.getByRole("link").nth(i)).toHaveAccessibleName(title);
  }
  await expect(page.getByRole("link", { name: "继续浏览作品" })).toHaveCount(0);
  await page.goto("/");
  await index.getByRole("link", { name: "AI × 实验" }).click();
  await expect(page).toHaveURL(/#experiments$/);
  await page.goto("/");
  await expect(page.getByRole("region", { name: /好奇心/ }).getByRole("link")).toHaveCount(titles.length);
  await expect(page.locator("#industry").getByRole("link", { name: "探索更多案例" })).toHaveAttribute("href", "/works/demos");
  await expect(page.locator("#teaching")).toHaveAttribute("href", "/works/project-000");
  await expect(page.locator("#thoughts").getByRole("link", { name: "读几篇试试" })).toHaveAttribute("href", "/thoughts");
  for (const [name, href] of [["原型工作台", "/works/ai-solution-lab"], ["UI 实验室", "/works/ui-lab"], ["亲子漫画", "/works/ai-life-comics"]]) {
    await expect(page.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
  }
  await expect(page.locator("#creation")).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(page.getByRole("img", { name: "小袁AI感雾公众号二维码" })).toBeVisible();
  await expect(page.locator(".site-footer").getByText("袁策书 / PERSONAL LAB", { exact: true })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "跳到作品" })).toBeFocused();
  await page.keyboard.press("Enter");
  expect(errors).toEqual([]);
});

test("五个目录入口定位到对应卡片并保留顶部空间", async ({ page }) => {
  for (const [i, id] of sectionIds.entries()) {
    await page.goto("/");
    const link = page.getByRole("list", { name: "接下来的内容" }).getByRole("link", { name: indexTitles[i] });
    await expect(link).toHaveCSS("cursor", "pointer");
    await link.click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect.poll(() => page.locator(`#${id}`).evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThan(48);
  }
});

test("普通模块排版、间距与实验卡对齐", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");

  const normalSections = ["industry", "experiments", "teaching", "thoughts"];
  const readType = async (selector: string) => page.locator(selector).evaluateAll((elements) => elements.map((element) => {
    const styles = getComputedStyle(element);
    return { fontSize: styles.fontSize, lineHeight: styles.lineHeight, fontWeight: styles.fontWeight };
  }));

  const eyebrow = await readType(normalSections.map((id) => `#${id} .home-card__tag-prefix`).join(", "));
  const sectionTitles = await readType(normalSections.map((id) => `#${id} .home-card__tag-topic`).join(", "));
  const body = await readType(normalSections.map((id) => `#${id} .home-card__lines`).join(", "));
  expect(new Set(eyebrow.map((value) => JSON.stringify(value)))).toEqual(new Set([JSON.stringify({ fontSize: "14px", lineHeight: "21px", fontWeight: "400" })]));
  expect(new Set(sectionTitles.map((value) => JSON.stringify(value)))).toEqual(new Set([JSON.stringify({ fontSize: "24px", lineHeight: "31.2px", fontWeight: "600" })]));
  expect(new Set(body.map((value) => JSON.stringify(value)))).toEqual(new Set([JSON.stringify({ fontSize: "14px", lineHeight: "24.5px", fontWeight: "400" })]));

  const miniTitles = await readType(".home-mini__body h3");
  const miniBody = await readType(".home-mini__body > p");
  expect(new Set(miniTitles.map((value) => JSON.stringify(value)))).toEqual(new Set([JSON.stringify({ fontSize: "18px", lineHeight: "26.1px", fontWeight: "600" })]));
  expect(new Set(miniBody.map((value) => JSON.stringify(value)))).toEqual(new Set([JSON.stringify({ fontSize: "14px", lineHeight: "24.5px", fontWeight: "400" })]));

  const bento = page.locator(".home-bento");
  await expect(bento).toHaveCSS("column-gap", "24px");
  await expect(bento).toHaveCSS("row-gap", "24px");
  await expect(page.locator(".home-bento__industry-body")).toHaveCSS("padding-left", "32px");

  const miniHeights = await page.locator(".home-mini").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  const imageHeights = await page.locator(".home-mini__image").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  expect(new Set(miniHeights.map(Math.round)).size).toBe(1);
  expect(new Set(imageHeights.map(Math.round)).size).toBe(1);
  await expect(page.locator(".home-mini .home-entry").first()).toHaveCSS("position", "static");
  await expect(page.locator(".home-bento__teaching")).toHaveCSS("min-height", "auto");
  const forestTitleSize = await page.locator(".home-bento__forest-copy h3").evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(forestTitleSize).toBeGreaterThan(24);

  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.locator(".home-bento__industry-body")).toHaveCSS("padding-left", "24px");
});

for (const [width, height] of [[320, 812], [390, 844], [768, 1000], [1024, 768], [1280, 900], [1440, 1000], [844, 390]]) {
  test(`${width}×${height} 构图、完整首屏与 200% 文字`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    const hero = page.locator(".morning-hero");
    const picture = hero.locator("img").first();
    await expect.poll(() => picture.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0)).toBe(true);
    expect(await picture.evaluate((e: HTMLImageElement) => e.currentSrc)).toContain(width <= 720 ? "studio-mobile" : "studio-desktop");
    for (const fontSize of ["100%", "200%"] ) {
      await page.evaluate((size) => { document.documentElement.style.fontSize = size; }, fontSize);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const heroBox = await hero.boundingBox();
      const indexBox = await page.getByRole("list", { name: "接下来的内容" }).boundingBox();
      expect(heroBox!.height).toBeGreaterThanOrEqual(height);
      expect(indexBox!.y + indexBox!.height).toBeLessThanOrEqual(heroBox!.y + heroBox!.height);
    }
  });
}

test("辅助偏好与首屏图片失败仍可阅读", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce", contrast: "more" });
  await page.route("**/home/morning/studio-*", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".morning-copy")).toHaveCSS("background-color", "rgb(243, 239, 232)");
  await page.getByRole("link", { name: "原型工作台", exact: true }).focus();
  await expect(page.getByRole("link", { name: "原型工作台", exact: true })).toHaveCSS("outline-style", "solid");
  await expect(page.locator(".home-mini__image img").first()).toHaveCSS("transform", "none");
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
  await expect(page.locator(".site-header")).toHaveCSS("backdrop-filter", "none");
  await expect(page.locator(".morning-copy")).toHaveCSS("background-color", "rgb(243, 239, 232)");
});
