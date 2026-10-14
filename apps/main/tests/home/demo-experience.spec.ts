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

test("桌面路线条件先于空结果，生成后能看到路线反馈", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const size of sizes.filter(size => size.width >= 1024)) {
    await page.setViewportSize(size);
    await page.goto(root + "linquan");
    await page.getByRole("button", { name: "我的路线", exact: true }).filter({ visible: true }).click();
    if (size.width === 1024) {
      expect((await page.locator(".tour-form-card").boundingBox())!.y).toBeLessThan((await page.locator(".route-preview").boundingBox())!.y);
      await inViewport(page, page.getByLabel("成人"));
    }
    await page.getByRole("slider", { name: "今天大约还有多久" }).fill("90");
    await expect(page.getByRole("combobox", { name: "从哪里开始" })).toBeEnabled();
    const interest = page.getByRole("button", { name: "自然观察", exact: true });
    const wasPressed = await interest.getAttribute("aria-pressed");
    await interest.click();
    await expect(interest).toHaveAttribute("aria-pressed", wasPressed === "true" ? "false" : "true");
    await page.getByRole("button", { name: "找到我的路线" }).click();
    const result = page.getByRole("heading", { name: /今天这样走|时间有点紧/ });
    await expect(result).toBeVisible();
    await expect.poll(async () => (await result.boundingBox())!.y).toBeGreaterThanOrEqual(0);
    await inViewport(page, result);
    if (size.width === 1024) {
      await page.route("**/api/experiments/linquan/tour", route => route.fulfill({ status: 503, json: { error: "路线查询暂时不可用，请稍后重试。" } }));
      await page.getByRole("button", { name: "找到我的路线" }).click();
      const error = page.locator(".route-preview .error-text");
      await expect(error).toContainText("请稍后重试");
      await expect.poll(async () => (await error.boundingBox())!.y).toBeGreaterThanOrEqual(0);
      await inViewport(page, error);
      await page.unroute("**/api/experiments/linquan/tour");
    }
  }
});

test("食智在检查服务时打开样例，检查完成后提示与可操作状态一致", async ({ page }) => {
  for (const role of ["customer-service", "operations", "finance"]) {
    for (const live of [true, false]) {
      let finish!: () => void;
      const ready = new Promise<void>(resolve => { finish = resolve; });
      await page.route("**/api/experiments/restaurant-ai/chat", async route => {
        await ready;
        await route.fulfill({ json: { live } });
      });
      await page.goto(root + "restaurant-ai/" + role);
      await page.getByRole("button", { name: /查看样例回放/ }).click();
      const notice = page.locator(".r-sample-notice");
      await expect(notice).toContainText("正在检查实时服务");
      await expect(notice).not.toContainText("实时服务不可用");
      const confirm = page.locator(".r-proposal button");
      await confirm.click();
      finish();
      if (live) {
        await expect(page.locator(".r-live-badge")).toContainText("实时服务可用");
        await expect(notice).toContainText("切换到实时对话");
        await expect(notice).not.toContainText("不可用");
        await page.getByRole("button", { name: /开始实时任务/ }).click();
        await expect(page.locator("#restaurant-question")).toBeEnabled();
        await page.getByRole("button", { name: /查看样例回放/ }).click();
      } else {
        await expect(page.locator(".r-live-badge")).toContainText("样例模式");
        await expect(notice).toContainText("实时服务不可用");
        await expect(page.locator(".r-sample-footer")).toContainText("暂停自由提问");
      }
      await expect(confirm).toHaveText("已在本页确认 ✓");
    }
  }
});

test("财务当前范围分析入口明确进入对话，并承接当前范围", async ({ page }) => {
  await page.route("**/api/experiments/finance-assistant/chat", route => route.fulfill({ json: { answer: "正在查看上周银联渠道的对账情况。", blocks: [], context: {} } }));
  await page.goto(root + "finance-assistant");
  await page.getByRole("navigation", { name: "主要导航" }).getByRole("button", { name: /^渠道对账/ }).click();
  await page.getByRole("button", { name: "分析当前范围", exact: true }).click();
  await expect(page.locator(".breadcrumbs")).toContainText("智能分析");
  await expect(page.locator(".message.user")).toContainText("上周银联渠道");
  await expect(page.locator(".message.assistant")).toContainText("正在查看上周银联渠道");
});

test("无效人数保留已生成路线、位置和其他条件", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(root + "linquan");
  await page.getByRole("navigation", { name: "移动导航" }).getByRole("button", { name: "我的路线" }).click();
  await page.getByLabel("儿童", { exact: true }).fill("3");
  await page.getByRole("slider").fill("90");
  await page.getByLabel("从哪里开始").selectOption("moon-stream");
  await page.getByRole("button", { name: "找到我的路线" }).click();
  await expect(page.locator(".route-timeline")).toBeVisible();
  await page.getByRole("button", { name: "调整条件", exact: true }).click();
  for (const value of ["21", "-1", "1.5", ""]) {
    await page.getByLabel("成人", { exact: true }).fill(value);
    await expect(page.getByLabel("成人", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("button", { name: "找到我的路线" })).toBeDisabled();
    await expect(page.getByLabel("儿童", { exact: true })).toHaveValue("3");
    await expect(page.getByRole("slider")).toHaveValue("90");
    await expect(page.getByLabel("从哪里开始")).toHaveValue("moon-stream");
    await expect(page.locator(".route-timeline")).toBeVisible();
  }
  await page.getByLabel("成人", { exact: true }).fill("2");
  await expect(page.getByRole("button", { name: "找到我的路线" })).toBeEnabled();
});

test("取消医疗确认保留原文，快捷提问不清空草稿", async ({ page }) => {
  await page.route("**/api/experiments/medical-ai/chat", route => route.fulfill({ json: { message: "已收到查询", tool_calls: [], debug: { intent: "SYMPTOM_CONSULTATION" }, state: {} } }));
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(root + "medical-ai");
    const input = page.getByRole("textbox", { name: "输入消息" });
    await input.fill("确认挂号 张明远 今天上午");
    await page.getByRole("button", { name: "发送", exact: true }).click();
    await page.getByRole("button", { name: "暂不确认" }).click();
    await expect(input).toHaveValue("确认挂号 张明远 今天上午");
    await page.getByRole("button", { name: "我现在应该去哪？", exact: true }).click();
    await expect(page.getByRole("log")).toContainText("已收到查询");
    await expect(input).toHaveValue("确认挂号 张明远 今天上午");
    await page.getByRole("button", { name: "发送", exact: true }).click();
    await page.getByRole("button", { name: "确认并继续" }).click();
    await expect(input).toHaveValue("");
  }
});

test("食智查看样例后恢复原任务、草稿、确认及阅读位置", async ({ page }) => {
  const requests: Array<{ accepted: string[] }> = [];
  await page.route("**/api/experiments/restaurant-ai/chat", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { live: true } });
    requests.push(route.request().postDataJSON());
    return route.fulfill({ contentType: "text/event-stream", body: "event: final\ndata: " + JSON.stringify({ mode: "live", answer: "任务正文。\n".repeat(70), sources: [], cards: [], proposal: { id: "booking-1234567890", title: "当前任务草案", detail: "仅用于测试", action_label: "确认当前任务草案" }, followups: [] }) + "\n\n" });
  });
  await page.goto(root + "restaurant-ai/customer-service");
  const input = page.locator("#restaurant-question");
  await expect(input).toBeEnabled();
  await input.fill("我自己的用餐任务");
  await page.getByRole("button", { name: "发送 ↗", exact: true }).click();
  await page.getByRole("button", { name: "确认当前任务草案" }).click();
  await input.fill("尚未发送的追问");
  await page.locator(".r-chat-scroll").evaluate(el => { el.scrollTop = 50; });
  await page.getByRole("button", { name: /查看样例回放/ }).click();
  await page.getByRole("button", { name: "确认演示草案", exact: true }).click();
  await page.getByRole("button", { name: /返回当前任务/ }).click();
  await expect(input).toHaveValue("尚未发送的追问");
  await expect(page.locator(".r-rail-bottom small")).toContainText("1");
  await expect.poll(() => page.locator(".r-chat-scroll").evaluate(el => el.scrollTop)).toBe(50);
  await page.getByRole("button", { name: /查看样例回放/ }).click();
  await expect(page.locator(".r-proposal button")).toHaveText("已在本页确认 ✓");
  await page.getByRole("button", { name: /返回当前任务/ }).click();
  await page.getByRole("button", { name: "发送 ↗", exact: true }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].accepted).toEqual(["booking-1234567890"]);
});

test("财务查询期间操作状态一致，导航和旧会话仍可使用", async ({ page }) => {
  let finish!: () => void;
  const gate = new Promise<void>(resolve => { finish = resolve; });
  await page.route("**/api/experiments/finance-assistant/chat", async route => { await gate; await route.fulfill({ json: { answer: "查询完成", blocks: [], context: {} } }); });
  await page.goto(root + "finance-assistant");
  await page.locator("#finance-question").fill("查经营数据");
  await page.getByRole("button", { name: "发送问题" }).click();
  await expect(page.getByRole("button", { name: "新建分析会话", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "新会话", exact: true })).toBeDisabled();
  await expect(page.locator(".suggestion").first()).toBeDisabled();
  await page.getByRole("navigation", { name: "主要导航" }).getByRole("button", { name: /^渠道对账/ }).click();
  await expect(page.getByRole("button", { name: "分析当前范围" })).toBeDisabled();
  await page.getByRole("button", { name: "云川财务智能体首页" }).click();
  await expect(page.locator(".message.user")).toContainText("查经营数据");
  finish();
  await expect(page.locator(".message.assistant")).toContainText("查询完成");
  await expect(page.getByRole("button", { name: "新建分析会话", exact: true })).toBeEnabled();
});

test("琴台详情返回和浏览器返回保留列表条件、展开和位置", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(root + "qintai-ticketing/shows");
  await page.getByRole("button", { name: "筛选与排序 ↓" }).click();
  await page.getByLabel("检索演出、场馆或票档").fill("如梦之梦");
  await page.getByLabel("含费用上限").selectOption("1000");
  await page.getByLabel("排序").selectOption("price_asc");
  await page.locator(".q-show-group-toggle").first().click();
  const link = page.getByRole("link", { name: "查看与锁座", exact: true }).first();
  await link.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => scrollY);
  for (const back of ["fixed", "browser"]) {
    await link.click();
    await expect(page.getByRole("link", { name: "返回演出列表", exact: true })).toBeVisible();
    if (back === "fixed") await page.getByRole("link", { name: "返回演出列表", exact: true }).click(); else await page.goBack();
    await expect(page.getByLabel("检索演出、场馆或票档")).toHaveValue("如梦之梦");
    await expect(page.getByLabel("含费用上限")).toHaveValue("1000");
    await expect(page.getByLabel("排序")).toHaveValue("price_asc");
    await expect(page.locator(".q-show-group-toggle").first()).toHaveAttribute("aria-expanded", "true");
    await expect.poll(async () => Math.abs((await page.evaluate(() => scrollY)) - scroll)).toBeLessThan(8);
  }
});

test("琴台手机场次先看摘要，错误与成功在对应操作旁出现", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(root + "qintai-ticketing/merchant/events");
  await expect(page.locator(".q-tier-rows:visible")).toHaveCount(0);
  const toggle = page.getByRole("button", { name: "查看票档与操作 ↓", exact: true }).first();
  await toggle.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "改价", exact: true }).first().click();
  const input = page.getByLabel(/新的含全部费用/);
  await input.fill("1");
  await page.getByRole("button", { name: "暂存为待审批" }).click();
  const error = page.locator(".q-draft .q-inline-error");
  await inViewport(page, error);
  await expect(input).toHaveValue("1");
  await input.fill("1700");
  await page.getByRole("button", { name: "暂存为待审批" }).click();
  await inViewport(page, page.locator(".q-draft .q-inline-ok"));
  await expect(page.getByRole("button", { name: "收起票档 ↑" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: /去待审批列表/ })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.locator(".q-tier-rows:visible")).toHaveCount(6);
});

test("票夹转赠、撤回与释放在操作位置反馈", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(root + "qintai-ticketing/shows/AT-TIX-106-BAL");
  await expect(page.getByText("本 Demo 体验到锁座，不提供结算；到期自动释放。")).toBeVisible();
  await page.getByRole("button", { name: /^锁座 ·/ }).click();
  await page.getByRole("link", { name: "去票夹看倒计时 →" }).click();
  await page.locator(".q-pass-pick input").first().check();
  await page.getByLabel("接收人（手机号或邮箱，仅记录在本地演示）").fill("demo@example.test");
  await page.getByRole("button", { name: /对已选的 1 张发起转赠/ }).click();
  await inViewport(page, page.locator(".q-transfer-form .q-inline-ok"));
  await page.getByRole("button", { name: "撤回", exact: true }).click();
  await inViewport(page, page.locator(".q-transfer-list .q-inline-ok"));
  await page.getByRole("button", { name: "释放", exact: true }).click();
  await inViewport(page, page.locator(".q-hold-list .q-inline-ok"));
});

test("低高度工作区能输入，焦点清楚，消息仍有阅读空间", async ({ page }) => {
  await page.route("**/api/experiments/restaurant-ai/chat", route => route.fulfill({ json: { live: true } }));
  await page.setViewportSize({ width: 390, height: 500 });
  for (const [slug, inputId, messages] of [["finance-assistant", "#finance-question", ".messages"], ["restaurant-ai/customer-service", "#restaurant-question", ".r-chat-scroll"]]) {
    await page.goto(root + slug);
    const input = page.locator(inputId);
    await expect(input).toBeEnabled();
    await input.focus();
    await inViewport(page, input);
    await inViewport(page, page.locator(slug === "finance-assistant" ? ".send-button" : ".r-composer button"));
    expect((await page.locator(messages).boundingBox())!.height).toBeGreaterThanOrEqual(72);
    expect(await input.evaluate(el => getComputedStyle(el).outlineStyle)).toBe("solid");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  }
});

test("对账正常状态折叠明细，异常筛选与已返回数量一致", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(root + "finance-assistant");
  await page.getByRole("navigation", { name: "主要导航" }).getByRole("button", { name: /^渠道对账/ }).click();
  await expect(page.getByText("当前范围未发现对账差异。", { exact: true })).toBeVisible();
  await expect(page.locator(".recon-detail:visible")).toHaveCount(0);
  await page.getByText("查看匹配明细 · 已返回 20 组", { exact: true }).click();
  const filter = page.getByLabel("筛选已返回的明细");
  expect(await filter.evaluate(el => Number.parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
  expect((await filter.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await filter.selectOption("AMOUNT_MISMATCH");
  await expect(page.locator(".details-toolbar")).toContainText("当前显示 0 组 · 已返回 20 组");
  await expect(page.locator(".details-panel")).toContainText("筛选仅针对本次已返回记录");
  const groups = Array.from({ length: 20 }, (_, index) => ({
    reconciliationId: `test-${index}`, matchStatus: index === 0 ? "UNMATCHED" : "MATCHED", matchType: "ONE_TO_ONE", issueType: index === 0 ? "AMOUNT_MISMATCH" : null,
    companyId: "C001", channel: "银联", batchId: "test", dateRange: { start: "2026-09-21", end: "2026-09-21" }, internalIds: ["internal"], settlementIds: ["settlement"], orderIds: [`ORDER-${index}`], paymentTxnIds: [], externalTxnIds: [],
    internalAmountCents: 10000, settlementAmountCents: index === 0 ? 9000 : 10000, internalFeeCents: 0, settlementFeeCents: 0, feeAdjustmentCents: 0, differenceCents: index === 0 ? 1000 : 0, reasonCode: index === 0 ? "AMOUNT_DIFFERENCE" : "EXACT", needsManualReview: false,
  }));
  await page.route("**/api/experiments/finance-assistant/chat", route => route.fulfill({ json: { answer: "本次返回的对账明细", context: {}, blocks: [{ type: "reconciliationDetails", data: { mode: "details", groups } }] } }));
  await page.getByRole("button", { name: "云川财务智能体首页" }).click();
  await page.locator("#finance-question").fill("查看异常记录");
  await page.getByRole("button", { name: "发送问题" }).click();
  await expect(page.locator(".messages .recon-detail")).toHaveCount(1);
  const chatFilter = page.locator(".messages").getByLabel("筛选已返回的明细");
  await expect(chatFilter).toHaveValue("issues");
  await chatFilter.selectOption("all");
  await expect(page.locator(".messages .recon-detail")).toHaveCount(20);
  await chatFilter.selectOption("DUPLICATE_SUSPECTED");
  await expect(page.locator(".messages .details-toolbar")).toContainText("当前显示 0 组 · 已返回 20 组");
});

test("输入聚焦期间跟随可用视口，离开输入恢复正常布局", async ({ page }) => {
  await page.route("**/api/experiments/restaurant-ai/chat", route => route.fulfill({ json: { live: true } }));
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [slug, inputId] of [["finance-assistant", "#finance-question"], ["restaurant-ai/customer-service", "#restaurant-question"]]) {
    await page.goto(root + slug);
    const input = page.locator(inputId);
    await expect(input).toBeEnabled();
    await input.focus();
    await page.evaluate(() => {
      Object.defineProperty(window.visualViewport!, "height", { configurable: true, value: 500 });
      window.visualViewport!.dispatchEvent(new Event("resize"));
    });
    await expect(page.locator("[data-compact-input]")).toHaveCount(1);
    await expect.poll(async () => (await input.boundingBox())!.y + (await input.boundingBox())!.height).toBeLessThanOrEqual(500);
    await page.evaluate(() => { (document.activeElement as HTMLElement).blur(); });
    await expect(page.locator("[data-compact-input]")).toHaveCount(0);
    await page.evaluate(() => { Reflect.deleteProperty(window.visualViewport!, "height"); });
  }
});

for (const size of [{ width: 390, height: 844 }, { width: 320, height: 780 }]) {
  test(`财务手机长回答后输入稳定可达 ${size.width}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.route("**/api/experiments/finance-assistant/chat", route => route.fulfill({ json: { answer: "经营结论。\n".repeat(60), blocks: [], context: { lastChannel: "银联" } } }));
    await page.goto(root + "finance-assistant");
    const input = page.locator("#finance-question");
    await input.fill("生成完整经营分析");
    await page.getByRole("button", { name: "发送问题" }).click();
    await expect(page.locator(".message.assistant")).toContainText("经营结论");
    await inViewport(page, input);
    await inViewport(page, page.getByRole("button", { name: "发送问题" }));
    expect(await page.locator(".messages").evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
    await input.fill("继续比较");
    await expect(input).toHaveValue("继续比较");
  });
}

test("林泉改条件标记旧路线，过期响应不会覆盖新条件", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(root + "linquan");
  await page.getByRole("button", { name: "我的路线", exact: true }).filter({ visible: true }).click();
  const time = page.getByRole("slider");
  await time.fill("90");
  await page.getByRole("button", { name: "找到我的路线" }).click();
  await expect(page.locator(".route-timeline")).toBeVisible();
  const route = await page.locator(".route-timeline").innerText();
  await time.fill("20");
  await expect(page.locator(".route-preview")).toContainText("条件已变，路线待更新");
  await expect(page.locator(".route-preview .feasibility")).toHaveCount(0);
  await expect(page.locator(".route-timeline")).toHaveText(route, { useInnerText: true });
  let finish!: () => void;
  const ready = new Promise<void>(resolve => { finish = resolve; });
  await page.route("**/api/experiments/linquan/tour", async route => {
    const response = await route.fetch();
    await ready;
    await route.fulfill({ response });
  });
  await time.fill("90");
  await page.getByRole("button", { name: "找到我的路线" }).click();
  await time.fill("60");
  finish();
  await expect(page.locator(".route-preview .error-text")).toContainText("条件已更新");
  await expect(time).toHaveValue("60");
  await expect(page.locator(".route-timeline")).toHaveText(route, { useInnerText: true });
  await page.getByRole("button", { name: "林泉首页", exact: true }).click();
  await page.getByRole("button", { name: "我的路线", exact: true }).filter({ visible: true }).click();
  await expect(page.locator(".route-preview")).toContainText("路线待更新");
});

test("明川追问后仍可查看报告和历史结果，推进失败就地反馈", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  const context = { patient_id: "demo001", visit_id: "visit001", current_stage: "RETURN_VISIT", department_id: "general", department_name: "普外科", doctor_id: "doctor001", doctor_name: "张明远", appointment_time: "2026-10-14 09:00", registration_status: "COMPLETED", current_order: null, payment_status: "PAID", exam_status: "COMPLETED", report_status: "READY", next_action: "携带检查结果返回普外科" };
  const report = { report_id: "test-report", visit_id: "visit001", exam_name: "腹部 CT", exam_date: "2026-10-13", clinical_history: "演示病史", technique: "演示方法", findings: ["演示检查所见"], impression: "仅为模拟报告内容", recommendation: "按演示流程回诊", report_status: "READY", critical_flag: false, source: "Mock", source_url: "", is_demo_data: true };
  let calls = 0;
  await page.route("**/api/experiments/medical-ai/chat", route => {
    calls++;
    return route.fulfill({ json: { message: calls === 1 ? "报告已经准备好。" : "回诊路线已准备好。", tool_calls: calls === 1 ? [{ name: "get_report", result: report }] : [{ name: "get_route", result: { start: "医学影像中心", destination: "普外科", steps: ["前往三楼普外科"], is_demo_data: true } }], debug: { intent: calls === 1 ? "REPORT_QUERY" : "ROUTE_QUERY" }, state: { mock: { visitContext: context } } } });
  });
  await page.route("**/api/experiments/medical-ai/action", route => route.fulfill({ status: 503, json: { error: "阶段更新暂时失败" } }));
  await page.goto(root + "medical-ai");
  const input = page.getByRole("textbox", { name: "输入消息" });
  await input.fill("查看报告");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(page.locator(".visit-summary .report-title")).toContainText("腹部 CT");
  await input.fill("普外科怎么走？");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(page.getByRole("heading", { name: "院内路线", exact: true })).toBeVisible();
  await expect(page.locator(".visit-summary .report-title")).toContainText("腹部 CT");
  await page.getByRole("link", { name: "查看这条回答的结果" }).first().click();
  await expect(page.getByRole("heading", { name: "历史查询结果", exact: true })).toBeVisible();
  await expect(page.locator("#medical-results")).toContainText("腹部 CT");
  await page.getByRole("button", { name: "返回最新结果" }).click();
  await expect(page.getByRole("heading", { name: "院内路线", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "确认推进", exact: true }).click();
  await page.getByRole("button", { name: "确认并继续", exact: true }).click();
  const error = page.locator(".demo-step .stage-error");
  await expect(error).toContainText("可以再次确认推进");
  await inViewport(page, error);
  await expect(page.getByRole("button", { name: "确认推进", exact: true })).toBeEnabled();
  await expect(page.locator(".topline + .inline-error")).toHaveCount(0);
});

test("琴台审批识别演出票档及来源，操作结果留在原卡片", async ({ page }) => {
  await page.goto(root + "qintai-ticketing/merchant/events");
  for (let index = 0; index < 4; index++) {
    await page.getByRole("button", { name: "改价", exact: true }).nth(index).click();
    const field = page.getByLabel(/新的含全部费用/);
    const label = await field.locator("..").innerText();
    const price = Number(label.match(/当前 ¥([\d,]+)/)![1].replaceAll(",", ""));
    await field.fill(String(Math.round(price * 1.05)));
    await page.getByRole("button", { name: "暂存为待审批" }).click();
    await expect(page.locator(".q-draft .q-inline-ok")).toBeVisible();
  }
  await page.getByRole("link", { name: /去待审批列表/ }).click();
  await expect(page.locator(".q-change")).toHaveCount(4);
  await expect(page.locator(".q-change-stack")).not.toContainText("助手草案");
  for (const card of await page.locator(".q-change").all()) {
    await expect(card).toContainText("人工暂存");
    await expect(card.locator(".q-change-target strong")).not.toBeEmpty();
    await expect(card.locator(".q-change-target span")).toContainText("武汉");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const last = page.locator(".q-change").last();
  await last.getByRole("button", { name: "丢弃", exact: true }).click();
  await expect(last.locator(".q-change-feedback")).toContainText("已丢弃");
  await inViewport(page, last.locator(".q-change-feedback"));
  await expect(last.getByRole("button", { name: "应用", exact: true })).toHaveCount(0);
  const first = page.locator(".q-change").first();
  await first.getByRole("button", { name: "应用", exact: true }).click();
  await expect(first.locator(".q-change-feedback")).toContainText("已应用");
  await inViewport(page, first.locator(".q-change-feedback"));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("琴台收起筛选仍显示生效条件，零结果可直接恢复", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto(root + "qintai-ticketing/shows");
  await page.getByRole("button", { name: "筛选与排序 ↓" }).click();
  await page.getByLabel("含费用上限").selectOption("300");
  await page.getByLabel("连座张数").selectOption("4");
  await page.getByLabel("检索演出、场馆或票档").fill("不存在的演出");
  await page.getByRole("button", { name: "收起筛选 ↓" }).click();
  await expect(page.getByLabel("当前筛选条件")).toContainText("¥300 以内 · 至少 4 张");
  await expect(page.getByRole("button", { name: /让助手比较这批候选/ })).toBeDisabled();
  await page.getByRole("button", { name: "清除搜索与筛选", exact: true }).click();
  await expect(page.getByLabel("检索演出、场馆或票档")).toHaveValue("");
  await expect(page.locator(".q-show-group").first()).toBeVisible();
  await expect(page.getByLabel("当前筛选条件")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("食智请求失败同步服务状态，保留任务并能重试", async ({ page }) => {
  let healthy = true;
  const questions: string[] = [];
  await page.route("**/api/experiments/restaurant-ai/chat", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { live: healthy } });
    questions.push(route.request().postDataJSON().message);
    if (questions.length === 1) { healthy = false; return route.fulfill({ status: 503, json: { error: "实时服务暂时不可用" } }); }
    return route.fulfill({ contentType: "text/event-stream", body: "event: final\ndata: " + JSON.stringify({ mode: "live", answer: "重试查询完成", sources: [], cards: [], proposal: null, followups: [] }) + "\n\n" });
  });
  await page.goto(root + "restaurant-ai/customer-service");
  await page.locator("#restaurant-question").fill("滨江店可以停车吗？");
  await page.getByRole("button", { name: "发送 ↗", exact: true }).click();
  await expect(page.locator(".r-live-badge")).toContainText("实时服务暂不可用");
  await expect(page.locator(".r-sample-footer")).toContainText("当前任务记录与草稿仍保留");
  await expect(page.locator(".r-message-user")).toContainText("滨江店可以停车吗");
  await page.getByRole("button", { name: /重新尝试这条问题/ }).click();
  await expect(page.getByRole("button", { name: /重新尝试这条问题/ })).toBeEnabled();
  expect(questions).toHaveLength(1);
  healthy = true;
  await page.getByRole("button", { name: /重新尝试这条问题/ }).click();
  await expect(page.locator(".r-chat-scroll")).toContainText("重试查询完成");
  await expect(page.locator(".r-live-badge")).toHaveText("● 实时 Agent");
  expect(questions).toEqual(["滨江店可以停车吗？", "滨江店可以停车吗？"]);
});

test("岛见桌面长对话内部滚动，输入可达且阅读不被打断", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(root + "island-travel/plan");
  await page.getByLabel("对话模式", { exact: true }).selectOption("demo");
  for (let index = 0; index < 8; index++) {
    await page.locator("#travel-message").fill("行李可以带多少？");
    await page.getByRole("button", { name: "发送行程", exact: true }).click();
    await expect(page.locator(".chat-message--assistant")).toHaveCount(index + 2);
  }
  await inViewport(page, page.locator("#travel-message"));
  await inViewport(page, page.getByRole("button", { name: "发送行程", exact: true }));
  const log = page.locator(".chat-log");
  expect(await log.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await log.evaluate(el => { el.scrollTop = 0; });
  const top = await log.evaluate(el => el.scrollTop);
  await page.getByLabel("对话模式", { exact: true }).selectOption("live");
  expect(await log.evaluate(el => el.scrollTop)).toBe(top);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
});
