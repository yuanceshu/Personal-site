import { expect, test } from "@playwright/test";

const BASE = "/works/demos/qintai-ticketing";

/**
 * 每个用例都以空白存储开始。
 *
 * 这里不能用「每次导航都 clear」的写法：`addInitScript` 在每一次导航（含 `page.reload()`）
 * 前都会重跑，会把用例正要验证的「刷新后仍在」的持久化状态一起擦掉。所以用会话级标记，
 * 让清洁动作在每个用例里只发生一次。上下文是每个用例新建的，标记不会跨用例残留。
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      if (window.sessionStorage.getItem("qintai-test-reset")) return;
      window.localStorage.clear();
      window.sessionStorage.setItem("qintai-test-reset", "1");
    } catch {
      // about:blank 这类没有存储权限的上下文直接跳过。
    }
  });
});

test("观众侧：检索、锁座、票夹，刷新后锁座仍在", async ({ page }) => {
  await page.goto(BASE);
  await expect(page.getByRole("heading", { name: /今晚，去看一场/ })).toBeVisible();

  await page.getByRole("link", { name: "演出", exact: true }).click();
  await expect(page).toHaveURL(`${BASE}/shows`);

  await page.getByPlaceholder("例如：如梦之梦、琴台音乐厅、惠民票").fill("如梦之梦");
  await expect(page.getByRole("heading", { name: "央华版《如梦之梦》" }).first()).toBeVisible();

  await page.getByRole("link", { name: "查看与锁座" }).first().click();
  await expect(page.getByRole("heading", { name: "这一场的全部票档" })).toBeVisible();

  await page.getByLabel(/锁座张数/).fill("2");
  await page.getByRole("button", { name: /^锁座 · ¥/ }).click();
  await expect(page.getByRole("status")).toContainText("已锁座");

  await page.getByRole("link", { name: "票夹", exact: true }).click();
  await expect(page).toHaveURL(`${BASE}/wallet`);
  await expect(page.getByRole("heading", { name: "锁座中 1 档" })).toBeVisible();
  await expect(page.getByLabel(/电子票条码/).first()).toBeVisible();
  await expect(page.locator(".q-hold-time").first()).toHaveText(/^\d{2}:\d{2}$/);

  await page.reload();
  await expect(page.getByRole("heading", { name: "锁座中 1 档" })).toBeVisible();
});

test("观众侧：售罄票档只能候补，候补页给出位次", async ({ page }) => {
  await page.goto(`${BASE}/shows/AT-TIX-103-PIT`);
  await expect(page.getByRole("heading", { name: "这一场的全部票档" })).toBeVisible();
  await expect(page.getByText("该票档当前已售罄")).toBeVisible();

  await page.getByRole("button", { name: "加入候补" }).click();
  await expect(page.getByRole("status")).toContainText("已加入候补");

  await page.getByRole("link", { name: "候补与回流", exact: true }).click();
  await expect(page.getByRole("heading", { name: "你在排的队" })).toBeVisible();
  await expect(page.locator(".q-waitlist-ring b").first()).toHaveText(/#\d+/);
});

test("运营侧：改价先暂存，应用后才写穿价格", async ({ page }) => {
  await page.goto(`${BASE}/merchant`);
  await expect(page.getByRole("heading", { name: "今天要把哪三件事处理掉？" })).toBeVisible();

  // 运营侧导航的可访问名带工作区序号与角标（如「02 演出与定价 6」），所以用子串匹配。
  await page.getByRole("link", { name: /演出与定价/ }).click();
  await expect(page.getByRole("heading", { name: "先看进度，再动手。" })).toBeVisible();
  // 同一部剧有三个场次，标题相同；第一场就是 AT-EVT-101（含 AT-TIX-101-PIT）。
  await expect(page.getByRole("heading", { name: "央华版《如梦之梦》" }).first()).toBeVisible();

  // 第一场的第一个票档就是 AT-TIX-101-PIT（¥1,580，余 6）。
  await page.getByRole("button", { name: "改价", exact: true }).first().click();
  await page.getByLabel(/新的含全部费用/).fill("1700");
  await page.getByLabel("说明（会写进台账摘要）").fill("Playwright 端到端改价");
  await page.getByRole("button", { name: "暂存为待审批" }).click();
  await expect(page.getByRole("status")).toContainText("已暂存为");

  await page.getByRole("link", { name: /库存与待审批/ }).click();
  await expect(page.getByRole("heading", { name: "改动在这里才真正发生。" })).toBeVisible();
  await expect(page.getByText("1 项等待你决定")).toBeVisible();
  await page.getByRole("button", { name: "应用", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已应用");
  await expect(page.getByText("Playwright 端到端改价")).toBeVisible();

  // 回到演出与定价：价格已经写穿，且提案不再挂起。
  await page.getByRole("link", { name: /演出与定价/ }).click();
  await expect(page.getByText("¥1,700").first()).toBeVisible();
});

test("运营侧：待审批提案刷新后仍在", async ({ page }) => {
  await page.goto(`${BASE}/merchant/events`);
  await page.getByRole("button", { name: "释放库存", exact: true }).first().click();
  await page.getByLabel(/释放张数/).fill("14");
  await page.getByRole("button", { name: "暂存为待审批" }).click();
  await expect(page.getByRole("status")).toContainText("已暂存为");

  await page.reload();
  await page.goto(`${BASE}/merchant/holds`);
  await expect(page.getByText("1 项等待你决定")).toBeVisible();
});

test("合集入口与移动布局可用", async ({ page }) => {
  await page.goto("/works/demos");
  const qintaiCard = page.locator("article").filter({ has: page.getByRole("heading", { name: "琴台票务 · 武汉演出票务" }) });
  await expect(qintaiCard.getByRole("link", { name: /完整体验$/ })).toHaveAttribute("href", BASE);

  await page.goto(BASE);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: /琴台助手/ })).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
});

test("实时 Agent 不可用时，助手仍能使用确定性降级回答", async ({ page }) => {
  await page.route("**/api/experiments/qintai-ticketing/status", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ live: false }) }),
  );
  await page.route("**/api/experiments/qintai-ticketing/chat", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unconfigured" }) }),
  );

  await page.goto(BASE);
  await page.getByRole("button", { name: /琴台助手/ }).click();
  await expect(page.getByRole("status")).toContainText("确定性回答");

  const prompt = page.getByRole("button", { name: /我想买两张/ });
  await expect(prompt).toBeEnabled();
  await prompt.click();
  await expect(page.getByText(/确定性回答/).first()).toBeVisible();
  await expect(page.locator(".q-turn--assistant p").first()).toContainText("如梦之梦");
});
