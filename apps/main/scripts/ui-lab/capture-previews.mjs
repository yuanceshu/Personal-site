import { chromium } from 'playwright';
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const main=resolve(import.meta.dirname,'../..');
const archive=resolve(main,'../../archives/ui-lab');
const root=join(main,'public/projects/ui-lab/previews');
const records=JSON.parse(await readFile(join(archive,'.local/sources.json'),'utf8')).files;
const ids=[...new Set(records.map(r=>r.archive.split('/').slice(0,2).join('/')))];
for (const id of ids) {
  try { await access(join(main,'public/projects/ui-lab/experiments',id,'manifest.json')); throw new Error('Sealed previews cannot be overwritten: '+id); }
  catch(error) { if(error.code!=='ENOENT') throw error; }
}
const runtime=await readFile(join(archive,'runtime.js'),'utf8');
const output={}, report=[];
const browser=await chromium.launch({channel:'chrome'});
async function state(page,id) {
  if(id==='ai-workbench/apple-design') {
    await page.getByRole('button',{name:/经营分析/}).click();
    await page.getByRole('button',{name:/开始梳理/}).click();
    await page.getByRole('button',{name:/生成方案与原型/}).click();
    await page.locator('#lab-result-title').waitFor();
  }
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.waitForTimeout(400);
}
try {
  for(const id of ids) {
    output[id]={};
    for(const [device,width,height] of [['desktop',1440,1000],['mobile',375,812]]) {
      const context=await browser.newContext({viewport:{width,height},timezoneId:'Asia/Shanghai',locale:'zh-CN',reducedMotion:'reduce'});
      const page=await context.newPage(); const errors=[],external=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
      page.on('request',req=>{if(!req.url().startsWith('http://127.0.0.1:4187/')&&!req.url().startsWith('data:'))external.push(req.url())});
      const entry=id==='ai-workbench/frontend-design'?'03-result-analytics.html':'index.html';
      await page.goto(`http://127.0.0.1:4187/projects/ui-lab/experiments/${id}/${entry}`);
      await state(page,id);
      const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,innerScroll:[...document.querySelectorAll('*')].filter(e=>e.clientHeight>50&&e.scrollHeight>e.clientHeight+8&&['auto','scroll'].includes(getComputedStyle(e).overflowY)).length}));
      const buffer=await page.screenshot({fullPage:true,animations:'disabled'});
      const meta=await sharp(buffer).metadata();
      const normalized=await sharp(buffer).extract({left:0,top:0,width:Math.min(width,meta.width),height:meta.height}).png().toBuffer();
      await mkdir(join(root,id),{recursive:true});
      await sharp(normalized).webp({quality:85}).toFile(join(root,id,device+'.webp'));
      if(device==='desktop') await sharp(normalized).resize(720,500,{fit:'cover',position:'top'}).webp({quality:80}).toFile(join(root,id,'thumbnail.webp'));
      output[id][device]={src:`/projects/ui-lab/previews/${id}/${device}.webp`,width,height:meta.height,viewport:{width,height},...layout};
      const local=join(archive,'.local/visual',id); await mkdir(local,{recursive:true});
      const baselinePath=join(local,device+'-original.png');
      let baseline;
      try { baseline=await readFile(baselinePath); } catch(error) {
        if(error.code!=='ENOENT') throw error;
        const original=await context.newPage();
        await original.addInitScript(runtime);
        const source=id==='ai-workbench/apple-design'?'http://localhost:3000/works/ai-solution-lab':id==='island-travel/frontend-design'?'http://localhost:3000/works/demos/island-travel':pathToFileURL(records.find(r=>r.archive===id+'/'+entry).source).href;
        await original.goto(source);
        if(id==='island-travel/frontend-design') await original.getByRole('combobox',{name:'对话模式'}).selectOption('demo');
        await state(original,id);
        baseline=await original.screenshot({fullPage:true,animations:'disabled'});
        await writeFile(baselinePath,baseline,{flag:'wx'});
      }
      await writeFile(join(local,device+'-snapshot.png'),normalized);
      const m=await sharp(baseline).metadata();
      const commonHeight=Math.min(m.height,meta.height),commonWidth=Math.min(m.width,width);
      const a=await sharp(baseline).extract({left:0,top:0,width:commonWidth,height:commonHeight}).removeAlpha().raw().toBuffer();
      const b=await sharp(normalized).extract({left:0,top:0,width:commonWidth,height:commonHeight}).removeAlpha().raw().toBuffer();
      let changed=0;for(let n=0;n<a.length;n+=3) if(Math.max(Math.abs(a[n]-b[n]),Math.abs(a[n+1]-b[n+1]),Math.abs(a[n+2]-b[n+2]))>25) changed++;
      report.push({id,device,errors,external,layout,originalSize:{width:m.width,height:m.height},snapshotSize:{width,height:meta.height},differentPixelRatio:changed/(commonWidth*commonHeight)});
      console.log(id,device,'errors',errors.length,'external',external.length,'difference',report.at(-1).differentPixelRatio.toFixed(4));
      await context.close();
    }
  }
} finally { await browser.close(); }
await mkdir(join(main,'content/projects/ui-lab'),{recursive:true});
await writeFile(join(main,'content/projects/ui-lab/previews.json'),JSON.stringify(output,null,2)+'\n');
await writeFile(join(archive,'.local/visual-report.json'),JSON.stringify(report,null,2)+'\n');
if(report.some(r=>r.errors.length||r.external.length)) process.exitCode=1;
