import { Suspense } from "react";
import { notFound } from "next/navigation";
import { experiments, getExperiment } from "@/content/projects/ui-lab/experiments";
import { SnapshotViewer } from "@/components/works/ui-lab/SnapshotViewer";

export function generateStaticParams() { return experiments.flatMap(e=>e.variants.map(v=>({experiment:e.slug,variant:v.slug}))); }
export const dynamicParams = false;
export async function generateMetadata({params}:{params:Promise<{experiment:string;variant:string}>}) {
  const p = await params, e = getExperiment(p.experiment), v = e?.variants.find(v=>v.slug===p.variant);
  return {title:v ? `${e!.title} × ${v.title} · 冻结体验` : "未找到版本"};
}
export default async function VariantPage({params}:{params:Promise<{experiment:string;variant:string}>}) {
  const p = await params, e = getExperiment(p.experiment), v = e?.variants.find(v=>v.slug===p.variant);
  if(!e || !v) notFound();
  return <Suspense fallback={<p className="uil-loading" role="status">正在载入冻结查看器…</p>}><SnapshotViewer experiment={e} variant={v} /></Suspense>;
}
