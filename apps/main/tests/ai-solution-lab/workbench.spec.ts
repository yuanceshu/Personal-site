import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const fixtures = JSON.parse(
  readFileSync(
    "../../services/experiment-agents/tests/fixtures/contracts.json",
    "utf8",
  ),
);
const base = fixtures.find(
  (c: { name: string }) => c.name === "analytics",
).value;
const path = "/works/ai-solution-lab";
async function example(page: Page, name: string) {
  await page.goto(path);
  const choice = page.getByRole("button", { name: new RegExp(name) });
  await choice.click();
  await expect(choice).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "开始梳理" }).click();
  await page.getByRole("button", { name: "生成方案与原型" }).click();
  await expect(page.locator(".lab-preview")).toBeVisible();
}
async function custom(page: Page) {
  await page.goto(path);
  await page
    .getByLabel("你想解决什么问题？")
    .fill("希望为管理者统一查看医院经营数据，允许用AI解释变化。");
  await page.getByRole("button", { name: "开始梳理" }).click();
}
function mockStages(page: Page, value = base) {
  return page.route("**/api/experiments/ai-solution-lab", (route) => {
    const payload = route.request().postDataJSON();
    return route.fulfill({
      json: {
        stage: payload.stage,
        mode: "live",
        data:
          payload.stage === "analyze"
            ? value.brief
            : payload.stage === "diagnose"
              ? value.diagnosis
              : value.prototype,
      },
    });
  });
}
test("shared portfolio shell uses neutral canvas and blue interaction", async ({
  page,
}) => {
  await page.goto(path);
  await expect(page.locator(".site-header__context")).toHaveText("作品 / AI LAB");
  await expect(
    page.getByRole("link", { name: "返回袁策书的个人作品首页" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "返回首页" })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(page.locator(".lab-header")).toHaveCount(0);
  await expect(page.locator(".solution-lab")).toHaveCSS(
    "background-color",
    "rgb(245, 245, 247)",
  );
  await expect(page.getByRole("button", { name: "开始梳理" })).toHaveCSS(
    "background-color",
    "rgb(0, 113, 227)",
  );
});
test("three examples and meaningful simulation paths", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await example(page, "经营分析");
  await expect(page.locator(".lab-metrics")).toContainText("12,450");
  await page.getByLabel("查看时间").selectOption("previous");
  await expect(page.locator(".lab-metrics")).toContainText("13,562");
  await page.getByRole("button", { name: "查看分析依据" }).click();
  await page.getByRole("button", { name: "试问：本周总量是多少？" }).click();
  await expect(
    page.locator(".lab-query").locator("..").getByRole("status"),
  ).toContainText("13,562");
  await example(page, "消费者导购");
  await page
    .getByRole("combobox", { name: "预算上限", exact: true })
    .selectOption("150");
  await expect(page.locator(".lab-products article")).toHaveCount(1);
  await page
    .locator(".lab-products")
    .getByRole("button", { name: /店铺信息/ })
    .click();
  await expect(page.locator(".lab-products")).toContainText("3F");
  await example(page, "营销策划");
  await page.getByRole("button", { name: "生成示例草稿" }).click();
  await expect(page.getByLabel("活动方案草稿")).toHaveValue(/老客复购/);
  await page.getByLabel("这次优先关注").selectOption("新客体验");
  await page.getByRole("button", { name: "生成示例草稿" }).click();
  await expect(page.getByLabel("活动方案草稿")).toHaveValue(/新客体验/);
  await page.getByLabel("活动方案草稿").fill("人工修订的草稿");
  await expect(page.getByLabel("活动方案草稿")).toHaveValue("人工修订的草稿");
  await page.getByRole("button", { name: "开始新需求" }).click();
  await expect(page.getByLabel("你想解决什么问题？")).toHaveValue("");
  await page.getByRole("button", { name: /返回版本/ }).click();
  await expect(page.locator(".lab-preview")).toBeVisible();
  expect(errors).toEqual([]);
});
test("failure preserves old version and modified example uses service", async ({
  page,
}) => {
  await example(page, "经营分析");
  await page.getByRole("button", { name: "调整需求与能力" }).click();
  await page.getByLabel("草稿名称").fill("门店经营工作台");
  let requested = false;
  await page.route("**/api/experiments/ai-solution-lab", (route) => {
    requested = true;
    return route.fulfill({ status: 503, json: { error: "unavailable" } });
  });
  await page.getByRole("button", { name: "生成方案与原型" }).click();
  await expect(page.locator(".lab-error")).toContainText("尚未连接");
  await expect(page.getByRole("button", { name: "重新生成" })).toBeVisible();
  await expect(page.getByLabel("草稿名称")).toHaveValue("门店经营工作台");
  await page.getByRole("button", { name: "返回已有方案" }).click();
  await expect(page.locator(".lab-preview-header")).toContainText(
    "医院经营分析工作台",
  );
  expect(requested).toBe(true);
});
test("live multipage highlights switch page and focus module", async ({
  page,
}) => {
  const multi = fixtures.find(
    (c: { name: string }) => c.name === "multi page",
  ).value;
  await mockStages(page, multi);
  await custom(page);
  await page.getByRole("button", { name: "生成方案与原型" }).click();
  await expect(page.locator(".lab-preview")).toBeVisible();
  await page
    .locator(".lab-decision")
    .filter({ hasText: "自然语言问数" })
    .click();
  await expect(
    page.locator(".lab-preview-tabs [aria-current=page]"),
  ).toHaveText("深入分析");
  await expect(
    page.locator('.lab-module[data-capability="data_query"]'),
  ).toBeFocused();
});
test("no AI and retail dataset respected, selections sent to backend", async ({
  page,
}) => {
  const value = structuredClone(
    fixtures.find((c: { name: string }) => c.name === "no AI").value,
  );
  value.brief.industry = "retail";
  for (const p of value.prototype.pages)
    for (const s of p.sections)
      for (const c of s.components) c.dataRef = "retail_metrics";
  let selected: string[] = [];
  await page.route("**/api/experiments/ai-solution-lab", (route) => {
    const payload = route.request().postDataJSON();
    if (payload.stage === "diagnose") selected = payload.selectedCapabilities;
    return route.fulfill({
      json: {
        stage: payload.stage,
        mode: "live",
        data:
          payload.stage === "analyze"
            ? value.brief
            : payload.stage === "diagnose"
              ? value.diagnosis
              : value.prototype,
      },
    });
  });
  await custom(page);
  await page.getByRole("button", { name: "生成方案与原型" }).click();
  await expect(page.locator(".lab-preview")).toContainText("成交订单");
  await expect(page.locator(".lab-preview")).not.toContainText("门诊");
  await expect(page.locator(".lab-query")).toHaveCount(0);
  await page.getByRole("button", { name: "调整需求与能力" }).click();
  await page.getByRole("button", { name: "生成方案与原型" }).click();
  await expect(page.locator(".lab-preview")).toBeVisible();
  expect(selected).toEqual(["monitoring_dashboard", "data_analysis"]);
  await expect(
    page.getByRole("button", { name: /切换到版本/ }),
  ).toBeVisible();
});
test("cancelled old response never overwrites newer example", async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/experiments/ai-solution-lab", async (route) => {
    await pending;
    await route
      .fulfill({ json: { stage: "analyze", mode: "live", data: base.brief } })
      .catch(() => {});
  });
  await custom(page);
  await expect(page.locator(".lab-activity")).toContainText("理解需求");
  await expect(
    page.getByRole("button", { name: "取消", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: /消费者导购/ }).click();
  await page.getByRole("button", { name: "开始梳理" }).click();
  release();
  await expect(page.getByLabel("草稿名称")).toHaveValue("商场购物向导");
  await page.getByRole("button", { name: "生成方案与原型" }).click();
  await expect(page.locator(".lab-preview-header")).toContainText(
    "商场购物向导",
  );
});
test("320px, reduced motion and peer home entry", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const name of ["经营分析", "消费者导购", "营销策划"]) {
    await example(page, name);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("navigation", { name: "结果内容" }),
    ).toBeVisible();
  }
  await page.goto("/");
  await expect(page.locator(".home-lab-entry")).toBeVisible();
  await page.locator(".home-lab-entry").click();
  await expect(page).toHaveURL(new RegExp(path));
  await page.getByLabel("你想解决什么问题？").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  await page.goto(path);
  const title = page.getByRole("heading", {
    name: "一个想法， 从这里变得具体。",
  });
  await expect(title).toBeFocused();
  expect(await title.evaluate((node) => getComputedStyle(node).outlineStyle)).toBe(
    "none",
  );
  expect(
    await page
      .getByRole("button", { name: "开始梳理" })
      .evaluate((node) => node.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(44);
});
test("unsupported input and assumptions remain explicit", async ({ page }) => {
  await mockStages(page, {
    ...base,
    brief: {
      ...base.brief,
      scenario: "unsupported",
      limitation: "暂不支持设备实时控制",
      questions: ["需要控制哪种设备？"],
      assumptions: ["设备类型待明确"],
    },
  });
  await custom(page);
  await expect(page.getByText("暂不支持设备实时控制")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "生成方案与原型" }),
  ).toBeDisabled();
  await page.getByLabel("当前假设", { exact: false }).fill("人工确认的新假设");
  await expect(page.getByLabel("当前假设", { exact: false })).toHaveValue(
    "人工确认的新假设",
  );
});

test("retry succeeds, clarification edits reach service and version can restore", async ({
  page,
}) => {
  await example(page, "经营分析");
  await page.getByRole("button", { name: "调整需求与能力" }).click();
  await page.getByLabel("草稿名称").fill("门店经营工作台");
  await page
    .getByLabel("当前假设", { exact: false })
    .fill("一条待确认假设\n第二条假设");
  let fail = true;
  await page.route("**/api/experiments/ai-solution-lab", (route) => {
    const payload = route.request().postDataJSON();
    if (fail) return route.fulfill({ status: 502, json: { error: "failed" } });
    expect(payload.brief.title).toBe("门店经营工作台");
    expect(payload.brief.assumptions).toHaveLength(2);
    return route.fulfill({
      json: {
        stage: payload.stage,
        mode: "live",
        data:
          payload.stage === "diagnose"
            ? base.diagnosis
            : { ...base.prototype, appTitle: payload.brief.title },
      },
    });
  });
  await page.getByRole("button", { name: "生成方案与原型" }).click();
  await expect(page.locator(".lab-error")).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "生成方案与原型" }).click();
  await expect(page.locator(".lab-preview-header")).toContainText(
    "门店经营工作台",
  );
  await page.getByRole("button", { name: /切换到版本/ }).click();
  await expect(page.locator(".lab-preview-header")).toContainText(
    "医院经营分析工作台",
  );
  await page.getByRole("button", { name: /切换到版本/ }).click();
  await expect(page.locator(".lab-preview-header")).toContainText(
    "门店经营工作台",
  );
});

test("keyboard example path and cleared draft remain editable", async ({
  page,
}) => {
  await page.goto(path);
  await page.getByRole("button", { name: /营销策划/ }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "开始梳理" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "生成方案与原型" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "生成示例草稿" }).focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("活动方案草稿").fill("");
  await expect(page.getByLabel("活动方案草稿")).toBeVisible();
  await page.getByLabel("活动方案草稿").fill("重新起稿");
});
