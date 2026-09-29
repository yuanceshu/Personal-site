import { expect, test } from "@playwright/test";

const demos = [
  ["岛见 · 智能出行", "/works/demos/island-travel"],
  ["食智助手 · 餐饮 Agent 工作台", "/works/demos/restaurant-ai"],
  ["林泉 · 智能伴游", "/works/demos/linquan"],
  ["琴台票务 · 武汉演出票务", "/works/demos/qintai-ticketing"],
  ["云川财务智能体", "/works/demos/finance-assistant"],
  ["明川医院 · AI 就医助手", "/works/demos/medical-ai"],
] as const;

test("合集入口清楚展示六个 Demo 的能力清单", async ({ page }) => {
  await page.goto("/works/demos");
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(/先找到你的问题，\s*再进入一个答案。/);
  const cards = page.locator(".demo-card");
  await expect(cards).toHaveCount(demos.length);
  for (const [title, href] of demos) {
    const card = cards.filter({ hasText: title });
    await expect(card).toHaveCount(1);
    await expect(card.getByRole("heading", { name: "你可以体验" })).toBeVisible();
    await expect(card.locator(".demo-card-feature-group li").first()).toBeVisible();
    await expect(card.getByRole("link", { name: /进入.*完整体验/ })).toHaveAttribute("href", href);
  }
  await expect(page.getByRole("link", { name: /打开 AI 工作台/ })).toHaveAttribute("href", "/works/ai-solution-lab");
  await page.setViewportSize({ width: 320, height: 900 });
  await expect(page.locator("body")).toHaveCSS("overflow-x", "visible");
  expect(await page.locator("body").evaluate((element) => element.scrollWidth <= 320)).toBe(true);
});
