import { expect, test, type Page } from "@playwright/test";
import { experiments } from "../../content/projects/ui-lab/experiments";

const lab = "/works/ui-lab";
async function compare(page: Page, group = "ai-workbench") {
  await page.goto(`${lab}/${group}`);
  await expect(page.getByLabel("A / 左侧版本")).toBeVisible();
  await expect(page).toHaveURL(/left=.*&right=/);
}
async function ratios(page: Page) {
  return page.locator(".uil-preview-scroll").evaluateAll(panes=>panes.map(p=>p.scrollHeight>p.clientHeight ? p.scrollTop/(p.scrollHeight-p.clientHeight) : 0));
}
test("main website entry, three groups, ten options, no running previews", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation",{name:"桌面主页导航"}).getByRole("link",{name:"UI 实验室"}).click();
  await expect(page.locator(".site-header__name")).toHaveText("PERSONAL LAB");
  await expect(page.locator(".site-header__name")).not.toContainText("袁策书");
  await expect(page.locator(".site-header__context")).toHaveText("作品 / UI LAB");
  await expect(page.locator(".site-header").getByRole("link",{name:"返回首页",exact:true})).toHaveAttribute("href","/");
  await expect(page.getByRole("heading",{level:1})).toHaveAccessibleName(/UI 实验室/);
  await expect(page.locator(".uil-experiment")).toHaveCount(3);
  for(const e of experiments) {
    await page.getByRole("heading",{name:e.title,exact:true}).getByRole("link").click();
    await expect(page.getByLabel("A / 左侧版本").locator("option")).toHaveCount(e.variants.length);
    await expect(page.locator("iframe")).toHaveCount(0);
    for(const v of e.variants) {
      await page.getByLabel("A / 左侧版本").selectOption(v.slug);
      await expect(page.getByLabel("A / 左侧版本")).toHaveValue(v.slug);
      await expect(page.locator(".uil-canvas").first().getByRole("img")).toBeVisible();
    }
    await page.getByRole("link",{name:"← 返回 UI 实验室"}).click();
  }
  await page.setViewportSize({width:375,height:812});
  await page.goto("/");
  await page.locator('.home-lab-entry[href="/works/ui-lab"]').click();
  await expect(page).toHaveURL(new RegExp(`${lab}$`));
});
test("pair swap, reload, share query, back/forward and invalid recovery", async ({ page }) => {
  await compare(page);
  await page.getByLabel("A / 左侧版本").selectOption("frontend-design");
  await expect(page.getByLabel("B / 右侧版本")).toHaveValue("apple-design");
  await expect(page.getByRole("status")).toContainText("已交换");
  await page.getByLabel("B / 右侧版本").selectOption("ui-ux-pro-max");
  const share = page.url();
  await page.reload();
  await expect(page.getByLabel("B / 右侧版本")).toHaveValue("ui-ux-pro-max");
  await page.goBack();
  await expect(page.getByLabel("B / 右侧版本")).toHaveValue("apple-design");
  await page.goForward();
  await expect(page).toHaveURL(share);
  for(const query of ["left=bad&right=frontend-design","left=apple-design","left=apple-design&right=apple-design","left=apple-design&left=ui-ux-pro-max&right=frontend-design"]) {
    await page.goto(`${lab}/ai-workbench?${query}`);
    await expect(page).toHaveURL(/left=apple-design&right=frontend-design$/);
  }
});
test("proportional scrolling, independent mode and viewport/variant preservation", async ({ page }) => {
  await compare(page);
  await page.getByRole("button",{name:"手机图",exact:true}).click();
  await expect.poll(async()=>page.locator(".uil-preview-scroll").first().evaluate(p=>p.scrollHeight>p.clientHeight)).toBe(true);
  await page.locator(".uil-preview-scroll").first().evaluate(p=>{p.scrollTop=(p.scrollHeight-p.clientHeight)*.55;});
  await expect.poll(async()=>Math.abs((await ratios(page))[1]-.55)).toBeLessThan(.02);
  await page.getByLabel("A / 左侧版本").selectOption("ui-ux-pro-max");
  await expect.poll(async()=>Math.abs((await ratios(page))[0]-.55)).toBeLessThan(.02);
  await page.getByLabel("同步滚动").uncheck();
  await page.locator(".uil-preview-scroll").first().evaluate(p=>{p.scrollTop=(p.scrollHeight-p.clientHeight)*.2;});
  await expect.poll(async()=>Math.abs((await ratios(page))[0]-.2)).toBeLessThan(.02);
  expect((await ratios(page))[1]).toBeCloseTo(.55,1);
  await page.getByLabel("同步滚动").check();
  await expect.poll(async()=>Math.abs((await ratios(page))[1]-.2)).toBeLessThan(.02);
  await page.getByRole("button",{name:"桌面图",exact:true}).click();
  // A nearly viewport-height screenshot may only scroll a few pixels; allow pixel rounding.
  await expect.poll(()=>page.locator(".uil-preview-scroll").first().evaluate(p=>Math.abs(p.scrollTop-(p.scrollHeight-p.clientHeight)*.2))).toBeLessThan(1);
});
test("mobile A/B, desktop/mobile viewing, reset, focus escape and preserved return", async ({ page }) => {
  await page.setViewportSize({width:375,height:812});
  await compare(page,"island-travel");
  await page.getByRole("button",{name:"手机图",exact:true}).click();
  await page.locator(".uil-preview-scroll").first().evaluate(p=>{p.scrollTop=(p.scrollHeight-p.clientHeight)*.4;});
  await page.getByRole("button",{name:"查看 B",exact:true}).click();
  await expect(page.locator(".uil-canvas").first()).toBeHidden();
  await expect.poll(async()=>Math.abs((await ratios(page))[1]-.4)).toBeLessThan(.03);
  const before=page.url();
  await page.locator(".uil-canvas.is-active").getByRole("link",{name:/单独体验/}).click();
  await expect(page.getByRole("status")).toHaveText("快照已就绪");
  await expect(page.locator("iframe")).toHaveAttribute("sandbox","allow-scripts");
  await page.getByRole("button",{name:"手机",exact:true}).click();
  await expect.poll(()=>page.locator("iframe").evaluate(e=>e.clientWidth)).toBe(375);
  const f=page.frameLocator("iframe");
  await f.locator("#destination").selectOption("文昌");
  await page.getByRole("button",{name:"重新开始",exact:true}).click();
  await expect(page.getByRole("status")).toHaveText("快照已就绪");
  await expect(f.locator("#destination")).toHaveValue("三亚");
  await f.locator("#destination").focus();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link",{name:"← 返回当前对照组合"})).toBeFocused();
  await page.getByRole("button",{name:/实验信息/}).click();
  await expect(page.locator("#snapshot-information")).toHaveAttribute("open","");
  await page.getByRole("link",{name:"← 返回对照",exact:true}).click();
  await expect(page).toHaveURL(before);
});
test("preview failure, snapshot failure, invalid routes", async ({ page }) => {
  await page.route("**/projects/ui-lab/previews/**",route=>route.abort());
  await compare(page);
  await expect(page.locator(".uil-image-fallback").first()).toContainText("预览暂不可用");
  await page.unrouteAll();
  await page.route("**/snapshot.js",route=>route.abort());
  await page.goto(`${lab}/ai-workbench/apple-design`);
  await expect(page.locator(".uil-recovery[role=alert]")).toContainText("快照未能完整加载");
  await page.unrouteAll();
  await page.getByRole("button",{name:"重新加载",exact:true}).click();
  await expect(page.getByRole("status")).toHaveText("快照已就绪");
  for(const path of ["missing","ai-workbench/missing"]) expect((await page.goto(`${lab}/${path}`))?.status()).toBe(404);
});
for(const [width,height] of [[320,812],[375,812],[768,1000],[1024,1000],[1440,1000],[812,375]]) {
  test(`shell responsive ${width}x${height}, keyboard and text resizing`,async({page})=>{
    await page.setViewportSize({width,height});
    await page.emulateMedia({reducedMotion:"reduce",contrast:"more"});
    for(const path of [lab,`${lab}/ai-workbench`,`${lab}/island-travel/ui-ux-pro-max`]) {
      await page.goto(path);
      await expect(page.locator(".site-header__name")).toHaveText("PERSONAL LAB");
      await expect(page.locator(".site-header__context")).toHaveText("作品 / UI LAB");
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.evaluate(()=>{document.documentElement.style.fontSize="200%";});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.evaluate(()=>{document.documentElement.style.fontSize="";});
    }
    await compare(page);
    const select=page.getByLabel("A / 左侧版本");
    await select.focus(); await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
    await expect(select).toBeFocused();
    expect(await select.evaluate(e=>getComputedStyle(e).outlineStyle)).toBe("solid");
    if(width===320) {
      await page.goto(`${lab}/island-travel/ui-ux-pro-max`);
      await page.getByRole("button",{name:"手机",exact:true}).click();
      expect(await page.locator("iframe").evaluate(e=>e.getBoundingClientRect().width)).toBeLessThanOrEqual(288);
    }
  });
}
