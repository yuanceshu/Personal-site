import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { experiments, getExperiment, modelLabel, skillLabel } from "@/content/projects/ui-lab/experiments";
import { Comparison } from "@/components/works/ui-lab/Comparison";
import { StaticCase } from "@/components/works/ui-lab/StaticCase";

export function generateStaticParams() { return experiments.map(e=>({experiment:e.slug})); }
export const dynamicParams = false;
export async function generateMetadata({ params }: { params: Promise<{experiment:string}> }) {
  const e = getExperiment((await params).experiment);
  return {title:e ? `${e.title} · UI 实验室` : "未找到实验"};
}
export default async function ExperimentPage({ params }: { params: Promise<{experiment:string}> }) {
  const e = getExperiment((await params).experiment);
  if (!e) notFound();
  return <>
    <nav className="uil-breadcrumb" aria-label="实验位置"><Link href="/works/ui-lab">← 返回 UI 实验室</Link></nav>
    <section className="uil-experiment-heading">
      <div className="uil-title-row"><h1>{e.title}</h1><span className="uil-badge">视觉展示</span></div>
      <p>{e.briefSummary}</p>
      <details className="uil-information"><summary>实验说明 · {[...new Set(e.variants.map(modelLabel))].join(" / ")} · {e.variants.length} 个桌面案例</summary>
        <p>{e.comparisonNote}</p><p>设计方法：{[...new Set(e.variants.map(skillLabel))].join(" / ")}。</p>
        <p>对照画布只加载桌面截图，不同时运行两个前端。截图案例不提供手机图或交互快照。</p>
        <p>预览中的内部滚动和未展开内容按截图原貌保留。</p>
      </details>
    </section>
    {e.variants.length === 1
      ? <StaticCase experiment={e} variants={e.variants} />
      : <Suspense fallback={<p className="uil-loading" role="status">正在恢复对照组合…</p>}><Comparison experiment={e} /></Suspense>}
  </>;
}
