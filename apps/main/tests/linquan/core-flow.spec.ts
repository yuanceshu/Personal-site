import { expect, test } from "@playwright/test";

const path = "/works/demos/linquan";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("linquan-test-reset")) {
      localStorage.clear();
      sessionStorage.setItem("linquan-test-reset", "1");
    }
  });
});

test("从游览条件生成路线并在对话中承接现场", async ({ page }) => {
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "走进林泉，慢一点也很好。" })).toBeVisible();
  await page.getByRole("navigation", { name: "主导航" }).getByRole("button", { name: "我的路线", exact: true }).click();
  await page.getByLabel("成人").fill("2");
  await page.getByLabel("儿童").fill("1");
  await page.getByRole("slider").fill("90");
  await page.getByRole("button", { name: "自然观察" }).click();
  await page.getByText("少走台阶", { exact: true }).click();
  await page.getByRole("button", { name: "找到我的路线" }).click();
  await expect(page.getByRole("heading", { name: /今天这样走|时间有点紧/ })).toBeVisible();
  await expect(page.getByText(/\d+分钟返程/)).toBeVisible();
  await page.getByRole("button", { name: "问问向导下一步" }).click();
  await expect(page.getByRole("heading", { name: "林间向导" })).toBeVisible();
  await page.getByLabel("向景区向导提问").fill("最近的厕所在哪里？");
  await page.getByRole("button", { name: "发送消息" }).click();
  await expect(page.getByRole("log", { name: "与向导的对话" })).toContainText("卫生间");
  await expect(page.getByText(/AI 向导|模型暂不可用 · 规则回答|规则演示 · 未连接模型/).first()).toBeVisible();
});

test("位置更新和历史会话保存在浏览器", async ({ page }) => {
  await page.goto(path);
  await page.getByLabel("更新当前位置").selectOption("cloud-platform");
  await expect(page.getByLabel("更新当前位置")).toHaveValue("cloud-platform");
  await page.getByRole("button", { name: "问问向导" }).click();
  await page.getByLabel("向景区向导提问").fill("我现在在哪里？");
  await page.getByRole("button", { name: "发送消息" }).click();
  await expect(page.getByRole("log", { name: "与向导的对话" })).toContainText("云端观景台");
  await page.reload();
  await expect(page.getByLabel("更新当前位置")).toHaveValue("cloud-platform");
  await page.getByRole("button", { name: "查看历史会话" }).click();
  await expect(page.getByText("我现在在哪里？")).toBeVisible();
});

test("合集入口和移动布局可用", async ({ page }) => {
  await page.goto("/works/demos");
  const linquanCard = page.getByRole("article").filter({ hasText: "林泉 · 智能伴游" });
  await expect(linquanCard.getByRole("link", { name: "进入完整体验" })).toHaveAttribute("href", path);
  await page.goto(path);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("navigation", { name: "移动导航" })).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
});
