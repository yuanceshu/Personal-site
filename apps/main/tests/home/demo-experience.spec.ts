import { expect, test, type Locator, type Page } from "@playwright/test";

const root = "/works/demos/";
const sizes = [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
  { width: 320, height: 780 },
];

async function inViewport(page: Page, locator: Locator, bottomInset = 0) {
  await expect(locator).toBeVisible();
  const box = (await locator.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - bottomInset);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
}

for (const size of sizes) {
  test(`工作区输入、角色和导航在 ${size.width}×${size.height} 可达`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize(size);
    await page.goto(root + "finance-assistant");
    await inViewport(page, page.locator("#finance-question"));
    for (const title of ["经营总览", "智能分析", "渠道对账", "异常监测"]) {
      const tab = page.getByRole("navigation", { name: "主要导航" }).getByRole("button", { name: new RegExp(title) });
      await tab.click();
      await inViewport(page, tab);
      for (const amount of await page.locator(".comparison-grid strong:visible, .recon-stats strong:visible").all()) {
        const layout = await amount.evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); return { lines: range.getClientRects().length, fits: el.scrollWidth <= el.clientWidth + 1 }; });
        expect(layout.lines).toBe(1);
        expect(layout.fits).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.getByRole("button", { name: "帮助", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("只有“新会话”会清空");
    await page.keyboard.press("Escape");

    await page.goto(root + "linquan");
    await page.getByRole("button", { name: /问问向导/ }).filter({ visible: true }).first().click();
    await inViewport(page, page.locator("#chat-input"), size.width < 760 ? 70 : 0);
    await page.locator("#chat-input").fill("这条草稿保留在当前工作区");
    await page.getByRole("button", { name: "林泉首页", exact: true }).click();
    await page.getByRole("button", { name: /问问向导/ }).filter({ visible: true }).first().click();
    await expect(page.locator("#chat-input")).toHaveValue("这条草稿保留在当前工作区");

    await page.route("**/api/experiments/restaurant-ai/chat", route => route.fulfill({ json: { live: true } }));
    await page.goto(root + "restaurant-ai");
    const roles = page.getByRole("navigation", { name: "选择体验角色" }).getByRole("link");
    await expect(roles).toHaveCount(3);
    for (const role of await roles.all()) await inViewport(page, role);
    for (const path of ["customer-service", "operations", "finance"]) {
      await page.goto(root + "restaurant-ai/" + path);
      await inViewport(page, page.locator("#restaurant-question"));
      const tabs = page.getByRole("navigation", { name: "切换角色" }).getByRole("link");
      for (const tab of await tabs.all()) await inViewport(page, tab);
    }

    await page.goto(root + "qintai-ticketing/shows");
    for (const link of await page.getByRole("navigation", { name: "主导航" }).getByRole("link").all()) {
      await inViewport(page, link);
      expect((await link.boundingBox())!.height).toBeLessThanOrEqual(48);
    }
    if (size.width < 1001) await page.getByRole("button", { name: /琴台助手/ }).click();
    await inViewport(page, page.locator("#q-chat-input-customer"));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("医疗锚点和主动提问抵达真实对话，等待与结果可见", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1024, height: 768 });
  for (const [hash, title] of [["assistant", "AI 就医助手"], ["journey", "我的就医旅程"], ["care-details", "就诊事项"]]) {
    await page.goto(root + "medical-ai#" + hash);
    await expect(page.locator("#" + hash)).toHaveCount(1);
    await expect(page.locator(".side-nav").getByRole("link", { name: title })).toHaveAttribute("aria-current", "location");
    expect((await page.locator("#" + hash).boundingBox())!.y).toBeGreaterThanOrEqual(0);
  }
  await page.goto(root + "medical-ai");
  for (const [hash, title] of [["journey", "我的就医旅程"], ["care-details", "就诊事项"], ["assistant", "AI 就医助手"]]) {
    await page.locator(".side-nav").getByRole("link", { name: title }).click();
    await expect(page).toHaveURL(new RegExp("#" + hash + "$"));
  }
  await inViewport(page, page.getByRole("textbox", { name: "输入消息" }));
  await page.getByRole("link", { name: "明川医院首页" }).filter({ visible: true }).click();
  let finish!: () => void;
  const ready = new Promise<void>(resolve => { finish = resolve; });
  await page.route("**/api/experiments/medical-ai/chat", async route => {
    await ready;
    await route.fulfill({ json: { message: "已找到就诊方向，请查看当前阶段。", tool_calls: [], debug: { intent: "SYMPTOM_CONSULTATION", triage_status: "READY" }, state: {} } });
  });
  await page.getByRole("button", { name: "我肚子疼，应该挂什么科？", exact: true }).click();
  await expect(page.getByRole("status", { name: "正在查询就医信息" })).toBeVisible();
  await inViewport(page, page.getByRole("textbox", { name: "输入消息" }));
  finish();
  await expect(page.getByRole("log")).toContainText("已找到就诊方向");
  await expect(page.getByRole("link", { name: /查看本次查询结果/ })).toBeVisible();
});

test("长财务结果可继续输入，阅读旧消息时回答不会强制滚动", async ({ page }) => {
  let finish!: () => void;
  const ready = new Promise<void>(resolve => { finish = resolve; });
  let count = 0;
  await page.route("**/api/experiments/finance-assistant/chat", async route => {
    count += 1;
    if (count > 1) await ready;
    await route.fulfill({ json: { answer: count === 1 ? Array.from({ length: 60 }, (_, i) => `第 ${i + 1} 项分析内容。`).join("\n") : "第二次查询完成", blocks: [], context: {} } });
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(root + "finance-assistant");
  const input = page.locator("#finance-question");
  await input.fill("生成经营分析");
  await page.getByRole("button", { name: "发送问题" }).click();
  await expect(page.locator(".message-copy").last()).toContainText("第 60 项");
  await inViewport(page, input);
  await input.fill("进一步解释");
  await page.getByRole("button", { name: "发送问题" }).click();
  await page.locator(".messages").evaluate(el => { el.scrollTop = 0; });
  await expect.poll(() => page.locator(".messages").evaluate(el => el.scrollTop)).toBe(0);
  await page.waitForTimeout(100);
  finish();
  await expect(page.locator(".messages")).toContainText("第二次查询完成");
  expect(await page.locator(".messages").evaluate(el => el.scrollTop)).toBe(0);
  await inViewport(page, input);
});

test("移动琴台助手与岛见礼宾可打开、关闭，草稿继续保留", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto(root + "qintai-ticketing");
  await page.getByRole("button", { name: /琴台助手/ }).click();
  const qintai = page.getByRole("dialog");
  await expect(qintai).toBeVisible();
  await expect(page.locator('a[aria-label="返回 Demo 合集"]:visible')).toHaveCount(1);
  await inViewport(page, page.locator("#q-chat-input-customer"));
  await page.locator("#q-chat-input-customer").fill("保留琴台草稿");
  await page.keyboard.press("Escape");
  await expect(qintai).toBeHidden();
  await expect(page.getByRole("button", { name: /琴台助手/ })).toBeFocused();
  await page.getByRole("button", { name: /琴台助手/ }).click();
  await expect(page.locator("#q-chat-input-customer")).toHaveValue("保留琴台草稿");
  await page.goto(root + "island-travel/plan#travel-concierge");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator('a[aria-label="返回 Demo 合集"]:visible')).toHaveCount(1);
  await inViewport(page, page.locator("#travel-message"));
  await page.locator("#travel-message").fill("保留岛见草稿");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /和岛见聊聊 · 帮我选班次/ }).click();
  await expect(page.locator("#travel-message")).toHaveValue("保留岛见草稿");
});


test("手机路线先填条件，查询反馈和票档入口容易发现", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(root + "linquan");
  await page.getByRole("navigation", { name: "移动导航" }).getByRole("button", { name: "我的路线", exact: true }).click();
  expect((await page.locator(".tour-form-card").boundingBox())!.y).toBeLessThan((await page.locator(".route-preview").boundingBox())!.y);
  await page.getByRole("button", { name: "找到我的路线" }).click();
  await expect(page.getByRole("heading", { name: /今天这样走|时间有点紧/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "调整条件" })).toBeVisible();
  await page.getByRole("button", { name: "调整条件" }).click();
  await expect(page.getByLabel("成人")).toBeVisible();

  await page.goto(root + "qintai-ticketing/shows");
  await expect(page.getByRole("combobox").first()).toBeHidden();
  await page.getByRole("button", { name: /筛选与排序/ }).click();
  await expect(page.getByRole("combobox").first()).toBeVisible();
  await page.locator(".q-show-group-toggle").first().click();
  await expect(page.getByRole("link", { name: "查看与锁座" }).first()).toBeVisible();

  let calls = 0;
  await page.route("**/api/experiments/island-travel/chat", route => { calls += 1; return route.abort(); });
  await page.goto(root + "island-travel");
  await page.getByRole("link", { name: "直接查班次" }).click();
  await page.getByRole("button", { name: "查找我的行程" }).click();
  await expect(page).toHaveURL(new RegExp(root + "island-travel/plan$"));
  await expect.poll(async () => (await page.locator("#results-title").boundingBox())!.y).toBeLessThan(100);
  expect(calls).toBe(0);
});


test("食智样例模式提供可执行任务，明确暂停自由提问", async ({ page }) => {
  await page.route("**/api/experiments/restaurant-ai/chat", route => route.fulfill({ json: { live: false } }));
  await page.setViewportSize({ width: 320, height: 780 });
  for (const role of ["customer-service", "operations", "finance"]) {
    await page.goto(root + "restaurant-ai/" + role);
    await expect(page.locator(".r-sample-footer")).toContainText("暂停自由提问");
    await expect(page.locator(".r-message-assistant")).toContainText("预置样例");
    await expect(page.getByRole("textbox")).toHaveCount(0);
    const confirm = page.locator(".r-proposal button");
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(confirm).toHaveText("已在本页确认 ✓");
    await page.locator(".r-sources summary").click();
    await expect(page.locator(".r-source").first()).toBeVisible();
  }
});
