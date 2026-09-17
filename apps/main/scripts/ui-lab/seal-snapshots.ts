import { readdir, readFile, writeFile, access } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { experimentArchive } from "../../content/projects/ui-lab/experiments";

const main = resolve(import.meta.dirname, "../..");
const publicRoot = join(main, "public");
const local = resolve(main, "../../archives/ui-lab/.local");
const sha = (data: Buffer) => createHash("sha256").update(data).digest("hex");
async function files(dir: string, prefix = ""): Promise<string[]> {
  const result: string[] = [];
  for (const item of await readdir(join(dir,prefix), {withFileTypes:true})) {
    const name = join(prefix,item.name);
    result.push(...(item.isDirectory() ? await files(dir,name) : [name]));
  }
  return result;
}
async function seal() {
const visual = JSON.parse(await readFile(join(local,"visual-report.json"),"utf8"));
const browser = JSON.parse(await readFile(join(main,"test-results/ui-lab/results.json"),"utf8"));
if (visual.length !== 20 || visual.some((r: { errors: unknown[]; external: unknown[] }) => r.errors.length || r.external.length)) throw new Error("Previews have not passed.");
if (browser.stats.expected !== 10 || browser.stats.unexpected || browser.stats.skipped || browser.errors.length) throw new Error("Run the ten snapshot tests successfully before sealing.");
const sources = JSON.parse(await readFile(join(local,"sources.json"),"utf8"));
const changedOriginals = [];
for (const source of sources.files) if (sha(await readFile(source.source)) !== source.sha256) {
  if (!source.archive.startsWith("island-travel/frontend-design/")) throw new Error("Unreviewed source change: "+source.archive);
  changedOriginals.push({archive:source.archive,sourceHashAtCopy:source.sha256,note:"正式岛见在复制归档后迭代；保留最初复制版与首次原版截图，不重取正式文件。"});
}
await writeFile(join(local,"source-drift.json"),JSON.stringify(changedOriginals,null,2)+"\n");
const manifests: {file:string;data:unknown}[] = [];
for (const experiment of experimentArchive) for (const variant of experiment.variants) {
  const dir = join(publicRoot,"projects/ui-lab/experiments",variant.id);
  try { await access(join(dir,"manifest.json")); throw new Error("Already sealed: "+variant.id); } catch(error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const hashes: Record<string,string> = {};
  for (const file of await files(dir)) {
    const data = await readFile(join(dir,file));
    if (/\.(html|js|css|json)$/.test(file) && /\/Users\/|localhost|127\.0\.0\.1|BEGIN (RSA |EC )?PRIVATE KEY|sk-[A-Za-z0-9_-]{24,}/.test(data.toString())) throw new Error("Public safety scan failed: "+variant.id+"/"+file);
    hashes[file] = sha(data);
  }
  const previews: Record<string,string> = {};
  for (const src of [variant.desktopPreview.src,variant.mobilePreview.src,variant.thumbnail]) previews[src.slice(1)] = sha(await readFile(join(publicRoot,src)));
  manifests.push({file:join(dir,"manifest.json"),data:{id:variant.id,title:variant.title,model:variant.model,modelVersion:variant.modelVersion,reasoningEffort:variant.reasoningEffort,skillMode:variant.skillMode,skillName:variant.skillName,skillVersion:variant.skillVersion,createdAt:variant.createdAt,frozenAt:variant.frozenAt,sealedAt:new Date().toISOString(),comparisonLevel:"showcase",sourceType:variant.sourceType,sourceEvidence:variant.sourceEvidence,entry:variant.entryUrl.split("/").at(-1),promptSummary:variant.promptSummary,additionalConstraints:variant.additionalConstraints,references:variant.references,imageGeneration:variant.imageGeneration,archiveChanges:variant.archiveChanges,limitations:variant.limitations,files:hashes,previews}});
}
for (const {file,data} of manifests) await writeFile(file,JSON.stringify(data,null,2)+"\n",{flag:"wx"});
await writeFile(join(main,"content/projects/ui-lab/releases.json"),JSON.stringify(experimentArchive.flatMap(e=>e.variants.map(v=>v.id)),null,2)+"\n");
console.log("Sealed ten snapshots; release list now contains only verified versions.");
}
void seal().catch(error => { console.error(error); process.exitCode = 1; });
