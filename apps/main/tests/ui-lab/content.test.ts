import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { changePair, experiments, experimentArchive, pairQuery, resolvePair, scrollRatio, skillLabel } from "../../content/projects/ui-lab/experiments";
import { conditionRows } from "../../components/works/ui-lab/Conditions";
const root = resolve(import.meta.dirname,"../../public");
test("three verified groups, ten variants, unique slugs and valid defaults", () => {
  assert.equal(experiments.length,3);
  assert.equal(experiments.flatMap(e=>e.variants).length,10);
  assert.equal(new Set(experiments.map(e=>e.slug)).size,3);
  for(const e of experiments) {
    assert.equal(new Set(e.variants.map(v=>v.slug)).size,e.variants.length);
    assert.equal(e.comparisonLevel,"showcase"); assert.ok(e.comparisonNote);
    assert.notEqual(...e.defaultVariantIds);
    for(const id of e.defaultVariantIds) assert.ok(e.variants.some(v=>v.slug===id));
    for(const v of e.variants) {
      assert.equal(v.status,"ready");
      for(const path of [v.entryUrl,v.desktopPreview.src,v.mobilePreview.src,v.thumbnail]) assert.ok(existsSync(join(root,path)),path);
      assert.equal(v.mobilePreview.width,375); assert.equal(v.desktopPreview.width,1440);
      assert.equal(v.modelVersion,null); assert.equal(v.reasoningEffort,null);
      assert.ok(conditionRows(v).some(row=>row[1]==="版本未记录"));
      assert.equal(Object.keys(v.observations).length,10);
    }
  }
  assert.equal(skillLabel(experiments[0].variants[0]),"裸跑");
  assert.equal(new Set(experiments.flatMap(e=>e.variants).filter(v=>v.skillMode==="skill").map(v=>v.skillName)).size,4);
});
test("invalid, missing and repeated query values resolve to default; changing collision swaps", () => {
  for(const e of experimentArchive) {
    const pair = e.defaultVariantIds;
    for(const args of [[null,null],[pair[0],null],[pair[0],pair[0]],["bad",pair[1]]] as [string|null,string|null][]) assert.deepEqual(resolvePair(e,...args),pair);
    assert.deepEqual(resolvePair(e,pair[1],pair[0]),[pair[1],pair[0]]);
    assert.deepEqual(changePair(pair,0,pair[1]),[pair[1],pair[0]]);
    assert.deepEqual(changePair(pair,1,pair[0]),[pair[1],pair[0]]);
    const params = new URLSearchParams(pairQuery(pair));
    assert.deepEqual(resolvePair(e,params.get("left"),params.get("right")),pair);
  }
});
test("scroll ratios clamp and avoid zero-height division", () => {
  assert.equal(scrollRatio(50,200,100),.5);
  assert.equal(scrollRatio(50,100,100),0);
  assert.equal(scrollRatio(-50,200,100),0);
  assert.equal(scrollRatio(500,200,100),1);
});
test("shell palette meets text and control contrast thresholds", () => {
  const css=readFileSync(resolve(import.meta.dirname,"../../styles/projects/ui-lab/ui-lab.css"),"utf8");
  const globalCss=readFileSync(resolve(import.meta.dirname,"../../app/globals.css"),"utf8");
  function luminance(hex:string) { const rgb=hex.match(/[a-f0-9]{2}/gi)!.map(s=>parseInt(s,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4); return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722; }
  function contrast(a:string,b:string) { const values=[luminance(a),luminance(b)].sort((a,b)=>b-a); return (values[0]+.05)/(values[1]+.05); }
  const token=(name:string)=>globalCss.match(new RegExp(`--${name}:\\s*(#[a-f0-9]{6})`))![1];
  for(const background of [token("canvas"),token("paper")]) {
    for(const name of ["ink","secondary","blue-pressed"]) assert.ok(contrast(token(name),background)>=4.5,`${name} on ${background}`);
    assert.ok(contrast(css.match(/--uil-control:\s*(#[a-f0-9]{6})/)![1],background)>=3);
  }
  assert.ok(contrast(token("paper"),token("blue"))>=4.5);
});
test("every sealed file and preview remains byte-identical", () => {
  const hash = (path:string) => createHash("sha256").update(readFileSync(path)).digest("hex");
  for(const e of experiments) for(const v of e.variants) {
    const dir=join(root,"projects/ui-lab/experiments",v.id);
    const manifest=JSON.parse(readFileSync(join(dir,"manifest.json"),"utf8"));
    for(const [file,expected] of Object.entries(manifest.files)) assert.equal(hash(join(dir,file)),expected,`${v.id}/${file}`);
    for(const [file,expected] of Object.entries(manifest.previews)) assert.equal(hash(join(root,file)),expected,file);
    assert.equal(manifest.id,v.id);
  }
});
test("public archive has no private source paths, secrets or live endpoints", () => {
  function scan(dir:string) {
    for(const item of readdirSync(dir,{withFileTypes:true})) {
      const path=join(dir,item.name);
      if(item.isDirectory()) scan(path);
      else if(/\.(html|js|css|json)$/.test(item.name)) {
        const source=readFileSync(path,"utf8");
        assert.ok(!/\/Users\/|localhost|127\.0\.0\.1|\/api\/experiments\/|BEGIN (RSA |EC )?PRIVATE KEY|sk-[A-Za-z0-9_-]{24,}/.test(source),path);
        if(item.name.endsWith(".html")) { assert.match(source,/connect-src 'none'/); assert.match(source,/form-action 'none'/); }
      }
    }
  }
  scan(join(root,"projects/ui-lab"));
});
