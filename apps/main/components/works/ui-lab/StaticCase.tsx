import Link from "next/link";
import type { UiExperiment, UiVariant } from "@/content/projects/ui-lab/types";
import { Conditions } from "./Conditions";
import { PreviewImage } from "./PreviewImage";
import { modelLabel } from "@/content/projects/ui-lab/experiments";

export function StaticCase({ experiment, variants }: { experiment: UiExperiment; variants: UiVariant[] }) {
  return <>
    <section className="uil-static-cases" aria-label="桌面截图案例">
      {variants.map(v => <article className="uil-static-case" key={v.id}>
        <div className="uil-window-bar"><span><strong>{modelLabel(v)}</strong> · {v.title}</span></div>
        <div className="uil-preview-scroll" tabIndex={0} role="region" aria-label={`${experiment.title} · ${modelLabel(v)} 桌面截图`}>
          <PreviewImage {...v.desktopPreview} alt={`${experiment.title} · ${modelLabel(v)} · 桌面截图`} eager />
        </div>
        <p className="uil-preview-caption">{v.previewState} · 图高 {v.desktopPreview.height}px</p>
      </article>)}
    </section>
    <section className="uil-section" aria-labelledby="static-conditions-title">
      <div className="uil-section-heading"><h2 id="static-conditions-title">案例条件</h2><p>这些截图只记录视觉结果，不代表可操作产品。</p></div>
      <Conditions variants={variants} />
    </section>
    <div className="uil-viewer-exit"><Link href="/works/ui-lab">← 浏览其他实验</Link></div>
  </>;
}
