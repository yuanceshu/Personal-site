import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { experimentArchive } from "../../content/projects/ui-lab/experiments";

async function ready(page: Page) {
  await expect.poll(() => page.evaluate(() => (window as unknown as { notifications: string[] }).notifications.at(-1))).toBe("ui-lab:ready");
}
async function appleResult(f: FrameLocator, example = "经营分析") {
  await f.getByRole("button", { name: new RegExp(example) }).click();
  await f.getByRole("button", { name: /开始梳理/ }).click();
  await f.getByRole("button", { name: /生成方案与原型/ }).click();
  await expect(f.locator("#lab-result-title")).toBeVisible();
}
for (const e of experimentArchive) for (const v of e.variants) {
  test(`snapshot ${v.id}: offline interaction and reset`, async ({ page, baseURL }) => {
    const errors: string[] = [], unexpected: string[] = [];
    const entry = new URL(v.entryUrl, baseURL).href;
    const directory = entry.slice(0,entry.lastIndexOf("/")+1);
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if(message.type() === "error") errors.push(message.text()); });
    page.on("request", request => { if(!request.url().startsWith(directory) && !request.url().startsWith("data:")) unexpected.push(request.url()); });
    await page.setContent(`<script>window.notifications=[];addEventListener('message',e=>{if(e.data.type.startsWith('ui-lab:'))notifications.push(e.data.type)})</script><iframe title="test snapshot" sandbox="allow-scripts" src="${entry}" style="border:0;width:100%;height:1000px"></iframe>`);
    await ready(page);
    const f = page.frameLocator("iframe");
    if(e.slug === "dashboards") {
      const before = await f.locator("#kpis").innerText();
      await f.locator("#monthFilter").selectOption("3");
      await expect(f.locator("#kpis")).not.toHaveText(before);
      await f.locator('button[data-mode="公交"]').click();
      await expect(f.locator('button[data-mode="公交"]')).toHaveClass(/selected/);
      await f.locator(".rank-row").first().click();
      await expect(f.locator(".rank-row").first()).toHaveClass(/selected/);
      await f.locator("[data-tip]").first().hover();
    } else if(v.id === "ai-workbench/apple-design") {
      await appleResult(f);
      await f.getByRole("button", {name:/调整这个方案|调整需求/}).click();
      const field = f.locator("textarea").first();
      await field.fill((await field.inputValue()) + "，优先展示汇总数据");
      await f.getByRole("button",{name:/生成方案与原型/}).click();
      await expect(f.locator("#lab-result-title")).toBeVisible();
      await f.getByRole("button",{name:/切换到版本 1/}).click();
      await f.getByRole("button",{name:/开始新需求/}).click();
      await f.locator("#lab-input").fill("请为我设计一个完全不同的自由输入产品需求");
      await f.getByRole("button",{name:/开始梳理/}).click();
      await expect(f.getByRole("alert")).toContainText("冻结快照不调用 AI");
      for(const name of ["消费者导购","营销策划"]) {
        await appleResult(f,name);
        await f.getByRole("button",{name:/开始新需求/}).click();
      }
    } else if(v.id === "ai-workbench/frontend-design") {
      await f.locator('[data-example="analytics"]').click();
      await expect(f.locator("#problem-input")).not.toBeEmpty();
      await f.getByRole("button",{name:/整理这份描述/}).click();
      await f.locator("[data-result-link]").click();
      await expect(f.locator('[data-period="week"]')).toBeVisible();
      await f.getByRole("button",{name:"上周",exact:true}).focus();
      await page.keyboard.press("Enter");
      await expect(f.locator('[data-metric-value="visits"]')).toHaveText("13,562");
      await f.locator("#query textarea, #query input").first().fill("本周门诊量");
      await f.locator('#query button[type="submit"]').click();
      await expect(f.locator("#query output")).toBeVisible();
      for(const file of ["index.html","04-result-retail.html","05-result-marketing.html"]) {
        await f.locator(`a[href="${file}"]`).first().click();
        await expect(f.locator("body")).not.toBeEmpty();
      }
    } else if(v.id === "ai-workbench/ui-ux-pro-max") {
      await f.getByRole("button",{name:"切换到深色模式"}).click();
      await expect(f.getByRole("button",{name:"切换到浅色模式"})).toBeVisible();
      await f.getByRole("button",{name:"上周",exact:true}).click();
      await expect(f.locator('[data-value="visits"]')).toHaveText("13,562");
      await f.locator("#query textarea, #query input").first().fill("查看本周门诊量");
      await f.getByRole("button",{name:"查询示例数据"}).click();
      await expect(f.locator("#query output")).toBeVisible();
    } else if(v.id === "island-travel/frontend-design") {
      for(const action of ["unknown","failed","ticketing_failed","success"]) {
        await f.getByRole("button",{name:/新行程/}).click();
        await f.getByRole("button",{name:/01\s*明天上午/}).click();
        await f.getByRole("button",{name:/选择第1班/}).click();
        await f.getByLabel("乘车人数",{exact:true}).selectOption("2");
        await f.getByRole("checkbox").check();
        await f.getByRole("button",{name:"确认创建订单"}).click();
        if(action === "unknown") { await f.getByRole("button",{name:/支付结果未知/}).click(); await f.getByRole("button",{name:/主动查询支付结果/}).click(); }
        if(action === "failed") { await f.getByRole("button",{name:/支付失败.*保留订单/}).click(); await f.getByRole("button",{name:/支付成功.*完成模拟出票/}).click(); }
        if(action === "ticketing_failed") { await f.getByRole("button",{name:/支付成功，出票异常/}).click(); await f.getByRole("button",{name:/重试出票/}).click(); }
        if(action === "success") await f.getByRole("button",{name:/支付成功.*完成模拟出票/}).click();
        await expect(f.getByText("这一程，安排好了。")).toBeVisible();
      }
      await f.getByRole("button",{name:"查看全部订单"}).click();
      await expect(f.getByRole("complementary").locator(".island-order-row")).toHaveCount(4);
    } else {
      await f.locator("#destination").selectOption("琼海");
      await f.locator("#period").selectOption("下午");
      await f.locator("#guests").selectOption("3");
      await f.getByRole("button",{name:/查找我的行程/}).click();
      await expect(f.locator("#result-status")).toContainText("3位成人");
      await f.getByRole("radio").nth(1).check();
      await f.locator("#confirm-trip").click();
      await expect(f.locator("#confirmation")).toBeVisible();
      await f.locator("#complete-demo").click();
      await expect(f.locator("#dialog-note")).toContainText("体验完成");
    }
    await page.evaluate(src => {
      (window as unknown as {notifications:string[]}).notifications=[];
      document.querySelector("iframe")!.src=src;
    },entry);
    await ready(page);
    if(e.slug === "dashboards") await expect(f.locator("#monthFilter")).toHaveValue("all");
    if(v.id === "ai-workbench/apple-design") await expect(f.locator("#lab-input")).toHaveValue("");
    if(v.id === "island-travel/frontend-design") await expect(f.locator(".island-trip")).toHaveCount(0);
    if(v.id === "island-travel/ui-ux-pro-max") await expect(f.locator("#destination")).toHaveValue("三亚");
    expect(unexpected).toEqual([]);
    expect(errors).toEqual([]);
  });
}
