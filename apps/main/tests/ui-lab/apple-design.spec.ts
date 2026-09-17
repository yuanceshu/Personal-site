import { expect, test } from "@playwright/test";

const lab = "/works/ui-lab";
for (const [width, height, firstImage, firstCanvas] of [[1440, 1000, 450, 420], [375, 812, 520, null]] as const) {
  test(`Apple content-first layout ${width}, typography and equal previews`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(lab);
    const preview = page.locator(".uil-thumbnail-window").first();
    expect((await preview.boundingBox())!.y).toBeLessThanOrEqual(firstImage);
    const headingSize = await page.locator("h1").evaluate(e => parseFloat(getComputedStyle(e).fontSize));
    expect(headingSize).toBeGreaterThanOrEqual(width === 375 ? 36 : 56);
    expect(headingSize).toBeLessThanOrEqual(width === 375 ? 40 : 64);
    for (const selector of [".uil-intro", ".uil-contact figcaption", ".uil-experiment-meta p"]) {
      expect(await page.locator(selector).first().evaluate(e => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(14);
    }
    const sizes = await page.locator(".uil-thumbnail-window").evaluateAll(items => items.map(e => e.getBoundingClientRect().width));
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThan(1);
    for (const image of await page.locator(".uil-thumbnail-window img").all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(e => (e as HTMLImageElement).decode());
      expect(await image.evaluate(e => (e as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }
    if (width === 375) {
      const images = await page.locator(".uil-contact").first().locator("figure").evaluateAll(items => items.map(e => e.getBoundingClientRect().top));
      expect(images[1]).toBeGreaterThan(images[0] + 100);
    }
    await preview.click();
    await expect(page).toHaveURL(/dashboards/);
    await page.goto(`${lab}/ai-workbench`);
    if (firstCanvas) expect((await page.locator(".uil-preview-scroll").first().boundingBox())!.y).toBeLessThanOrEqual(firstCanvas);
    await page.goto(`${lab}/island-travel/ui-ux-pro-max`);
    await expect(page.getByRole("status")).toHaveText("快照已就绪");
    if (width === 375) {
      expect((await page.locator("iframe").boundingBox())!.y).toBeLessThanOrEqual(360);
      await page.getByRole("button", { name: "手机", exact: true }).click();
      expect((await page.locator("iframe").boundingBox())!.y).toBeLessThanOrEqual(360);
    }
    await page.getByRole("button", { name: "实验信息", exact: true }).click();
    await expect(page.getByRole("button", { name: "实验信息", exact: true })).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#snapshot-information")).toContainText("不调用真实 AI");
  });
}

test("Apple segmented spring retargets in flight, settles, and honors reduced motion", async ({ page }) => {
  await page.goto(`${lab}/ai-workbench`);
  const segment = page.getByRole("group", { name: "预览视口" });
  await expect(segment).toHaveAttribute("data-enhanced", "true");
  const sample = await segment.evaluate(async group => {
    const buttons = group.querySelectorAll("button");
    const layer = group.querySelector<HTMLElement>(".uil-segment-indicator")!;
    const x = () => new DOMMatrixReadOnly(getComputedStyle(layer).transform).m41;
    const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const start = x();
    buttons[1].click();
    await new Promise(resolve => setTimeout(resolve, 60));
    const moving = x();
    buttons[0].click();
    const immediate = x();
    await nextFrame();
    const reversed = x();
    // Both position and inherited velocity survive a direction change.
    return { start, moving, immediate, reversed, end: buttons[1].offsetLeft };
  });
  expect(sample.moving).toBeGreaterThan(sample.start);
  expect(sample.moving).toBeLessThan(sample.end);
  expect(sample.immediate).toBeCloseTo(sample.moving, 3);
  expect(Math.abs(sample.reversed - sample.moving)).toBeLessThan(sample.end / 2);
  await expect.poll(() => segment.evaluate(g => {
    const layer = g.querySelector<HTMLElement>(".uil-segment-indicator")!;
    const selected = g.querySelector<HTMLButtonElement>('[aria-pressed="true"]')!;
    return Math.abs(new DOMMatrixReadOnly(getComputedStyle(layer).transform).m41 - selected.offsetLeft);
  })).toBeLessThan(.2);
  await segment.evaluate(group => { const buttons = group.querySelectorAll("button"); for (let i = 0; i < 9; i++) buttons[(i + 1) % 2].click(); });
  await expect(segment.getByRole("button", { name: "手机图" })).toHaveAttribute("aria-pressed", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await segment.getByRole("button", { name: "桌面图" }).click();
  const difference = await segment.evaluate(g => {
    const layer = g.querySelector<HTMLElement>(".uil-segment-indicator")!;
    return Math.abs(new DOMMatrixReadOnly(getComputedStyle(layer).transform).m41 - g.querySelector<HTMLButtonElement>('[aria-pressed="true"]')!.offsetLeft);
  });
  expect(difference).toBeLessThan(.1);
  expect(await page.locator(".uil-preview-scroll img").first().evaluate(e => getComputedStyle(e).animationName)).toBe("none");
});

test("Apple press feedback, cancellation, keyboard and functional header material", async ({ page }) => {
  await page.goto(lab);
  const button = page.locator(".uil-enter").first();
  const rect = (await button.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await expect.poll(() => button.evaluate(e => new DOMMatrixReadOnly(getComputedStyle(e).transform).a)).toBeLessThan(1);
  await page.mouse.move(5, 5);
  await page.mouse.up();
  await expect(page).toHaveURL(new RegExp(`${lab}$`));
  await expect.poll(() => button.evaluate(e => new DOMMatrixReadOnly(getComputedStyle(e).transform).a)).toBe(1);
  await page.keyboard.press("Tab");
  await button.focus();
  expect(await button.evaluate(e => getComputedStyle(e).outlineStyle)).toBe("solid");
  const header = page.locator(".site-header");
  expect(await header.evaluate(e => getComputedStyle(e).backdropFilter)).toContain("blur");
  await page.evaluate(() => scrollTo(0, 400));
  expect((await header.boundingBox())!.y).toBe(0);
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
  expect(await header.evaluate(e => getComputedStyle(e).backdropFilter)).toBe("none");
  expect(await header.evaluate(e => getComputedStyle(e).backgroundColor)).toBe("rgb(245, 245, 247)");
  await session.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-contrast", value: "more" }] });
  expect(await page.locator(".uil-root").evaluate(e => getComputedStyle(e).getPropertyValue("--uil-control").trim())).toBe("#424245");
  await session.detach();
  await page.goto(`${lab}/island-travel/ui-ux-pro-max`);
  const enter = page.getByRole("button", { name: "进入快照操作", exact: true });
  await enter.focus();
  await expect(enter).toBeVisible();
  expect((await enter.boundingBox())!.y).toBeGreaterThanOrEqual(56);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "跳过快照 ↓" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#after-snapshot$/);
});

test("Apple composited header, text links and hover buttons meet contrast", async ({ page }) => {
  await page.goto(lab);
  const ratios = await page.evaluate(() => {
    const rgb = (value: string) => value.match(/[\d.]+/g)!.map(Number);
    const luminance = (color: number[]) => color.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const ratio = (a: number[], b: number[]) => { const values = [luminance(a), luminance(b)].sort((a, b) => b - a); return (values[0] + .05) / (values[1] + .05); };
    const header = getComputedStyle(document.querySelector(".site-header")!);
    const material = rgb(header.backgroundColor);
    const worst = material.slice(0, 3).map(v => v * material[3]); // black artwork under the translucent header
    const result = [".site-header__name", ".site-header__identity--project", ".site-header__context", ".site-header nav a"].map(s => ratio(rgb(getComputedStyle(document.querySelector(s)!).color), worst));
    const root = getComputedStyle(document.querySelector(".uil-root")!);
    result.push(ratio(rgb(getComputedStyle(document.querySelector(".uil-information summary")!).color), rgb(root.backgroundColor)));
    return result;
  });
  for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
  await page.locator(".uil-enter").first().hover();
  const colors = await page.locator(".uil-enter").first().evaluate(e => ({ fg: getComputedStyle(e).color, bg: getComputedStyle(e).backgroundColor }));
  expect(colors.fg).toBe("rgb(255, 255, 255)");
  await expect.poll(() => page.locator(".uil-enter").first().evaluate(e => getComputedStyle(e).backgroundColor)).toBe("rgb(0, 98, 196)");
});
