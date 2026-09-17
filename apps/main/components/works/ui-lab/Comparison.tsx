"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { changePair, pairQuery, resolvePair, scrollRatio } from "@/content/projects/ui-lab/experiments";
import type { UiExperiment } from "@/content/projects/ui-lab/types";
import { Conditions } from "./Conditions";
import { PreviewImage } from "./PreviewImage";
import { SegmentedControl } from "./SegmentedControl";

export function Comparison({ experiment: e }: { experiment: UiExperiment }) {
  const search = useSearchParams();
  const left = search.get("left"), right = search.get("right");
  const repeated = search.getAll("left").length > 1 || search.getAll("right").length > 1;
  const pair = resolvePair(e, repeated ? null : left, right);
  const invalid = left !== pair[0] || right !== pair[1] || repeated;
  const selected = pair.map(slug => e.variants.find(v => v.slug === slug)!);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [sync, setSync] = useState(true);
  const [active, setActive] = useState<0 | 1>(0);
  const [message, setMessage] = useState("");
  const panes = useRef<(HTMLDivElement | null)[]>([null, null]);
  const ratios = useRef([0, 0]);
  const expected = useRef<(number | null)[]>([null, null]);
  const last = useRef<0 | 1>(0);
  const query = pairQuery(pair);
  const [leftSlug, rightSlug] = pair;
  useEffect(() => {
    if (invalid) window.history.replaceState(null, "", `/works/ui-lab/${e.slug}?${query}`);
  }, [invalid, e.slug, query]);
  function restore(index: number) {
    const pane = panes.current[index];
    if (!pane || !pane.getClientRects().length) return;
    const top = ratios.current[index] * Math.max(0, pane.scrollHeight - pane.clientHeight);
    expected.current[index] = top;
    pane.scrollTop = top;
  }
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => { restore(0); restore(1); });
    panes.current.forEach(pane => { if (pane) observer.observe(pane); });
    restore(0); restore(1);
    return () => observer.disconnect();
  }, [leftSlug, rightSlug, device, active]);
  function scroll(index: 0 | 1) {
    const pane = panes.current[index];
    if (!pane?.getClientRects().length) return;
    const target = expected.current[index];
    expected.current[index] = null;
    if (target !== null && Math.abs(pane.scrollTop - target) < 2) return;
    const ratio = scrollRatio(pane.scrollTop, pane.scrollHeight, pane.clientHeight);
    ratios.current[index] = ratio;
    last.current = index;
    if (sync) { ratios.current[1-index] = ratio; restore(1-index); }
  }
  function choose(side: 0 | 1, value: string) {
    setMessage(value === pair[1-side] ? "已交换 A、B 两侧，避免比较同一个版本。" : "版本已切换，保留当前预览滚动比例。");
    window.history.pushState(null, "", `/works/ui-lab/${e.slug}?${pairQuery(changePair(pair, side, value))}`);
  }
  return <>
    <section className="uil-comparison" aria-label="双版本对照">
      <div className="uil-comparison-tools">
        <SegmentedControl label="预览视口" value={device} onChange={setDevice} options={[{value:"desktop",label:"桌面图"},{value:"mobile",label:"手机图"}]} />
        <label className="uil-sync"><input type="checkbox" checked={sync} onChange={event => {
          setSync(event.target.checked);
          if (event.target.checked) { ratios.current[1-last.current] = ratios.current[last.current]; restore(1-last.current); }
        }} />同步滚动</label>
        <span className="uil-small uil-live" role="status" aria-live="polite">{message || "组合随网址保存 · 单独体验可操作完整页面"}</span>
      </div>
      <div className="uil-selectors">{selected.map((v, index) => <label key={index}>
        <span>{index === 0 ? "A / 左侧版本" : "B / 右侧版本"}</span>
        <select value={v.slug} onChange={event => choose(index as 0 | 1, event.target.value)}>{e.variants.map(option => <option value={option.slug} key={option.id}>{option.model} × {option.title}</option>)}</select>
      </label>)}</div>
      <SegmentedControl className="uil-mobile-switch" label="查看对照侧" value={active} onChange={setActive} options={[{value:0,label:"查看 A"},{value:1,label:"查看 B"}]} />
      <div className="uil-canvases">{selected.map((v, index) => {
        const preview = device === "desktop" ? v.desktopPreview : v.mobilePreview;
        return <article className={`uil-canvas ${active === index ? "is-active" : ""}`} key={index}>
          <div className="uil-window-bar"><span>{index === 0 ? "A" : "B"} <strong>{v.title}</strong></span><Link href={`/works/ui-lab/${e.slug}/${v.slug}?${query}`}>单独体验 <span aria-hidden="true">↗</span></Link></div>
          <div ref={element => { panes.current[index] = element; }} className={`uil-preview-scroll uil-preview-scroll--${device}`} tabIndex={0} role="region" aria-label={`${index === 0 ? "A" : "B"} ${v.title}截图滚动区`} onScroll={() => scroll(index as 0 | 1)}>
            <PreviewImage key={`${v.id}/${device}`} {...preview} alt={`${e.title} · ${v.model} × ${v.title} · ${device === "desktop" ? "桌面" : "手机"}完整页面截图`} onLoad={() => restore(index)} eager />
          </div>
          <div className="uil-preview-caption"><p>{v.previewState}</p><span>{preview.viewport.width} × {preview.viewport.height} 视口 · 图高 {preview.height}px</span>{v.limitations.filter(s => !s.startsWith("历史")).map(s => <p key={s}>{s}</p>)}</div>
        </article>;
      })}</div>
    </section>
    <section className="uil-section" aria-labelledby="observations-title">
      <div className="uil-section-heading"><span className="uil-kicker">READING THE DIFFERENCES</span><h2 id="observations-title">差异，来自具体的选择。</h2><p>以下为页面观察与使用取舍，不是模型评分。</p></div>
      <div className="uil-observations">{selected.map((v,index) => <article key={v.id}><h3>{index === 0 ? "A" : "B"} / {v.title}</h3><dl>{Object.entries(v.observations).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></article>)}</div>
    </section>
    <section className="uil-section" aria-labelledby="conditions-title"><div className="uil-section-heading"><span className="uil-kicker">EXPERIMENT CONDITIONS</span><h2 id="conditions-title">把条件放在台面上。</h2></div><Conditions variants={selected} /></section>
  </>;
}
