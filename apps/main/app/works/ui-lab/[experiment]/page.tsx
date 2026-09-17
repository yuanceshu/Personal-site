import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { experiments, getExperiment, skillLabel } from "@/content/projects/ui-lab/experiments";
import { Comparison } from "@/components/works/ui-lab/Comparison";

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
      <details className="uil-information"><summary>实验说明 · {e.variants[0].model} · {e.variants.length} 个版本</summary>
        <p>{e.comparisonNote}</p><p>设计方法：{[...new Set(e.variants.map(skillLabel))].join(" / ")}。</p>
        <p>对照画布只加载代表状态截图，不同时运行两个前端。每个版本可单独进入冻结体验，版本条件与归档调整在页面下方和查看器中公开。</p>
        <p>历史页面的原有手机适配、字号与操作限制按原貌保留，不为对比而重做。预览中的内部滚动和未展开内容需要进入体验查看。</p>
      </details>
    </section>
    <Suspense fallback={<p className="uil-loading" role="status">正在恢复对照组合…</p>}><Comparison experiment={e} /></Suspense>
  </>;
}
