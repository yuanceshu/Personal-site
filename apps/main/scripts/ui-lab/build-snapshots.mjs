import { readFile, writeFile, mkdir, readdir, copyFile, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const main = resolve(import.meta.dirname, '../..');
const archive = resolve(main, '../../archives/ui-lab');
const publish = resolve(main, 'public/projects/ui-lab/experiments');
export const variantIds = ['dashboards/bare','dashboards/dashboard','dashboards/frontend-design','dashboards/apple-design','dashboards/ui-ux-pro-max','ai-workbench/apple-design','ai-workbench/frontend-design','ai-workbench/ui-ux-pro-max','island-travel/frontend-design','island-travel/ui-ux-pro-max'];
const runtime = await readFile(join(archive,'runtime.js'),'utf8');
const policy = "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'";
async function files(dir, prefix='') {
  const result=[];
  for(const entry of await readdir(join(dir,prefix),{withFileTypes:true})) {
    const path=join(prefix,entry.name);
    result.push(...(entry.isDirectory()?await files(dir,path):[path]));
  }
  return result;
}
function secure(html) {
  return html.replace(/<head([^>]*)>/i,`<head$1><meta charset="utf-8"><link rel="icon" href="data:,"><meta http-equiv="Content-Security-Policy" content="${policy}"><script>${runtime}</script>`);
}
const chosen=process.argv[2]?[process.argv[2]]:variantIds;
for(const id of chosen) {
  if(!variantIds.includes(id)) throw new Error('Unknown version');
  const input=join(archive,'sources',id), output=join(publish,id);
  try { await access(join(output,'manifest.json')); throw new Error('Sealed snapshot: '+id); } catch(e) { if(e.code!=='ENOENT') throw e; }
  await mkdir(output,{recursive:true});
  const react=id==='ai-workbench/apple-design'||id==='island-travel/frontend-design';
  if(react) {
    const apple=id.startsWith('ai-workbench');
    const entry=apple
      ? 'import {createRoot} from "react-dom/client";import {SolutionLab} from "./src/components/works/ai-solution-lab/SolutionLab";import {SiteHeader} from "./src/components/SiteHeader";import "./src/app/globals.css";import "./src/styles/projects/ai-solution-lab/workbench.css";createRoot(document.getElementById("root")).render(<><a className="lab-skip" href="#lab-main">跳到主要内容</a><SiteHeader projectLabel="作品 / AI LAB"/><SolutionLab/></>);'
      : 'import {createRoot} from "react-dom/client";import {IslandTravel} from "./src/components/works/demos/island-travel/IslandTravel";import "./src/app/globals.css";import "./src/styles/projects/demos/island-travel.css";createRoot(document.getElementById("root")).render(<IslandTravel/>);';
    await build({stdin:{contents:entry,loader:'tsx',resolveDir:input,sourcefile:'snapshot-entry.tsx'},bundle:true,format:'iife',platform:'browser',minify:true,legalComments:'none',sourcemap:false,outfile:join(output,'snapshot.js'),jsx:'automatic',nodePaths:[join(main,'node_modules')],alias:{'@':join(input,'src'),'next/link':join(archive,'adaptations/next-link.tsx'),'next/image':join(archive,'adaptations/next-image.tsx')},define:{'process.env.NODE_ENV':'"production"','process.env.JINGMIANSEN_SITE_URL':'"#"'},metafile:true}).then(async result=>{
      const inputs=Object.keys(result.metafile.inputs);
      if(inputs.some(p=>p.includes('apps/main/components/')||p.includes('apps/main/lib/'))) throw new Error('Live source dependency');
      await writeFile(join(output,'build-info.json'),JSON.stringify({tool:'esbuild',version:require('esbuild/package.json').version,react:require('react/package.json').version,reactDom:require('react-dom/package.json').version,zod:require('zod/package.json').version,source:'archived-source-only'},null,2));
    });
    await mkdir(join(output,'assets'),{recursive:true});
    for(const file of await readdir(join(input,'assets'))) await copyFile(join(input,'assets',file),join(output,'assets',file));
    await writeFile(join(output,'index.html'),secure(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>${apple?'AI 场景工作台':'岛见'} · 冻结快照</title><link rel="stylesheet" href="snapshot.css"></head><body><div id="root"></div><script src="snapshot.js"></script></body></html>`));
  } else {
    for(const file of await files(input)) {
      const dest=join(output,file); await mkdir(resolve(dest,'..'),{recursive:true});
      if(file.endsWith('.html')) await writeFile(dest,secure(await readFile(join(input,file),'utf8')));
      else await copyFile(join(input,file),dest);
    }
  }
  console.log('Built '+id);
}
