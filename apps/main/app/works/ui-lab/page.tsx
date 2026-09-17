import Link from "next/link";
import { experiments, skillLabel } from "@/content/projects/ui-lab/experiments";
import { PreviewImage } from "@/components/works/ui-lab/PreviewImage";

export default function UiLabPage() {
  const variants = experiments.flatMap(e => e.variants);
  const methods = new Set(variants.filter(v => v.skillMode === "skill").map(v => v.skillName));
  return <>
    <section className="uil-hero">
      <p className="uil-kicker">UI 实验室</p>
      <h1 aria-label="UI 实验室：同一个命题。不同的界面答案。">同一个命题。<br className="uil-mobile-break" />不同的界面答案。</h1>
      <p className="uil-intro">让不同模型与设计方法，回应同一个产品想法。</p>
      <p className="uil-stats">{experiments.length} 个主题 <span>·</span> {variants.length} 个版本 <span>·</span> {methods.size} 种 Skill <small>含 {variants.filter(v => v.skillMode === "bare").length} 个裸跑版本</small></p>
    </section>
    <section className="uil-projects" aria-label="实验项目">
      {experiments.map(e => {
        const href = `/works/ui-lab/${e.slug}`;
        return <article className="uil-experiment" key={e.slug}>
          <div className="uil-experiment-heading-row">
            <div><p className="uil-kicker">{e.variants[0].model} · {e.variants.length} 个冻结版本</p><h2><Link href={href}>{e.title}</Link></h2><p className="uil-experiment-subtitle">{e.subtitle}</p></div>
            <Link className="primary-link uil-enter" href={href} aria-label={`开始对照：${e.title}`}>开始对照 <span aria-hidden="true">›</span></Link>
          </div>
          <div className={`uil-contact ${e.featuredVariantIds.length === 2 ? "uil-contact--pair" : ""}`}>
            {e.featuredVariantIds.map(slug => e.variants.find(v => v.slug === slug)).filter(v => v !== undefined).map(v => <figure key={v.id}>
              <Link className="uil-thumbnail-window" href={href} aria-label={`对照${e.title}，预览${v.title}`}>
                <PreviewImage src={v.thumbnail} alt={`${e.title} · ${v.model} × ${v.title}桌面预览`} width={720} height={500} eager={e === experiments[0]} />
              </Link>
              <figcaption>{v.title}</figcaption>
            </figure>)}
          </div>
          <div className="uil-experiment-meta"><p>{[...new Set(e.variants.map(skillLabel))].join(" / ")}</p><span className="uil-badge">视觉展示</span></div>
        </article>;
      })}
      {!experiments.length && <p>实验档案正在核验中，通过运行与来源检查后才会公开。</p>}
    </section>
    <section className="uil-method-section" aria-labelledby="method-title">
      <h2 id="method-title">看见差异，也看见条件。</h2>
      <p>本批实验均为视觉展示，不构成严格对照，也不作模型排名。</p>
      <details className="uil-information"><summary>这些实验，应该怎样比较？</summary>
        <p>模型、Skill、任务描述、素材和反馈轮次，都可能改变结果。这批历史版本没有完整的受控记录。</p>
        <div className="uil-method-levels"><p><strong>严格对照</strong><span>功能、任务与素材相同，仅模型或 Skill 不同。</span></p><p><strong>部分对照</strong><span>任务相同，但反馈轮次或素材条件不同。</span></p><p><strong>视觉展示 · 本批档案</strong><span>主题相同，过程或功能范围存在差异。</span></p></div>
        <p>每份快照独立归档，不跟随正式产品更新。未知信息明确写为“未记录”；原始 Prompt 不直接公开。</p>
      </details>
    </section>
  </>;
}
