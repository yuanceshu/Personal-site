import { expect, test, type Page } from "@playwright/test";
import { experiments } from "../../content/projects/ui-lab/experiments";

const lab = "/works/ui-lab";
async function compare(page: Page, group = "ai-workbench") {
  await page.goto(`${lab}/${group}`);
  await expect(page.getByLabel("A / 左侧版本")).toBeVisible();
  await expect(page).toHaveURL(/left=.*&right=/);
}
test("main website entry, all desktop cases, no running previews", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link",{name:"UI 实验室",exact:true})).toHaveAttribute("href",lab);
  await page.getByRole("link",{name:"UI 实验室",exact:true}).click();
  await expect(page.locator(".site-header__name")).toHaveText("PERSONAL LAB");
  await expect(page.locator(".site-header__name")).not.toContainText("袁策书");
  await expect(page.locator(".site-header__context")).toHaveText("作品 / UI LAB");
  await expect(page.locator(".site-header").getByRole("link",{name:"返回首页",exact:true})).toHaveAttribute("href","/");
  await expect(page.getByRole("heading",{level:1})).toHaveAccessibleName(/UI 实验室/);
  await expect(page.locator(".uil-experiment")).toHaveCount(experiments.length);
  for(const e of experiments) {
    await page.getByRole("heading",{name:e.title,exact:true}).getByRole("link").click();
    if(e.variants[0].sourceType === "static-image" && e.variants.length === 1) {
      await expect(page.locator(".uil-static-case")).toHaveCount(e.variants.length);
      await expect(page.locator("iframe")).toHaveCount(0);
    } else {
      await expect(page.getByLabel("A / 左侧版本").locator("option")).toHaveCount(e.variants.length);
      await expect(page.locator("iframe")).toHaveCount(0);
      for(const v of e.variants) {
        await page.getByLabel("A / 左侧版本").selectOption(v.slug);
        await expect(page.getByLabel("A / 左侧版本")).toHaveValue(v.slug);
        await expect(page.locator(".uil-canvas").first().getByRole("img")).toBeVisible();
      }
    }
    await page.getByRole("link",{name:"← 返回 UI 实验室"}).click();
  }
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
test("desktop comparison canvas and variant switching", async ({ page }) => {
  await compare(page);
  await expect(page.getByLabel("同步滚动")).toBeChecked();
  await page.getByLabel("A / 左侧版本").selectOption("ui-ux-pro-max");
  await expect(page.locator(".uil-preview-scroll").first().getByRole("img")).toBeVisible();
  await page.getByLabel("同步滚动").uncheck();
  await expect(page.getByLabel("同步滚动")).not.toBeChecked();
  await page.getByLabel("同步滚动").check();
  await expect(page.getByLabel("同步滚动")).toBeChecked();
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
  });
}
