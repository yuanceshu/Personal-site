"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { pairQuery, resolvePair } from "@/content/projects/ui-lab/experiments";
import type { UiExperiment, UiVariant } from "@/content/projects/ui-lab/types";
import { Conditions } from "./Conditions";
import { SegmentedControl } from "./SegmentedControl";

const subscribeToMount = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function SnapshotViewer({ experiment: e, variant: v }: { experiment: UiExperiment; variant: UiVariant }) {
  // Do not start the iframe before hydration installs its message listener.
  const mounted = useSyncExternalStore(subscribeToMount, clientSnapshot, serverSnapshot);
  const search = useSearchParams();
  const back = `/works/ui-lab/${e.slug}?${pairQuery(resolvePair(e,search.get("left"),search.get("right")))}`;
  const [mode, setMode] = useState<"desktop" | "mobile">("desktop");
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [width, setWidth] = useState(0);
  const [informationOpen, setInformationOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const exit = useRef<HTMLAnchorElement>(null);
  const information = useRef<HTMLDetailsElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const path = v.entryUrl.slice(0,v.entryUrl.lastIndexOf("/")+1);
  function loading() {
    if (timer.current) clearTimeout(timer.current);
    setStatus("loading");
    timer.current = setTimeout(() => setStatus("error"), 12000);
  }
  useEffect(() => {
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow || event.origin !== "null") return;
      const data = event.data;
      if (!data || typeof data.path !== "string" || !data.path.startsWith(path) || data.path.slice(path.length).includes("/")) return;
      if (data.type === "ui-lab:exit") { exit.current?.focus(); return; }
      if (data.type !== "ui-lab:ready" && data.type !== "ui-lab:error") return;
      if (timer.current) clearTimeout(timer.current);
      setStatus(data.type === "ui-lab:ready" ? "ready" : "error");
    }
    window.addEventListener("message", receive);
    timer.current = setTimeout(() => setStatus("error"), 12000);
    return () => { window.removeEventListener("message", receive); if (timer.current) clearTimeout(timer.current); };
  }, [path, revision]);
  const fixedWidth = mode === "mobile" ? 375 : v.viewportMode === "desktop-only" ? 1440 : null;
  const designWidth = fixedWidth ?? (width || 1024);
  const scale = width ? Math.min(1, width / designWidth) : 1;
  const designHeight = mode === "mobile" ? 812 : 1000;
  function reset() { setStatus("loading"); setRevision(value => value+1); }
  return <>
    <nav className="uil-breadcrumb" aria-label="查看器位置"><Link href={back}>← 返回对照</Link><span>/</span><Link href="/works/ui-lab">UI 实验室</Link></nav>
    <div className="uil-viewer-heading"><div><p className="uil-kicker">{v.model} / {v.title}</p><h1>{e.title}</h1></div><span className="uil-badge">冻结快照</span></div>
    <p className="uil-viewer-disclosure">仅演示数据，不调用真实服务；刷新后重置。</p>
    <div className="uil-viewer-tools"><SegmentedControl label="体验视口" value={mode} onChange={setMode} options={[{value:"desktop",label:"桌面"},{value:"mobile",label:"手机"}]} /><button className="uil-button" onClick={reset}>重新开始</button><button className="uil-button" aria-controls="snapshot-information" aria-expanded={informationOpen} onClick={() => { if (information.current) information.current.open = !information.current.open; }}>实验信息</button><span className="uil-viewer-status" role="status">{status === "ready" ? "快照已就绪" : status === "loading" ? "正在加载快照…" : "快照未能完整加载"}</span></div>
    <details ref={information} id="snapshot-information" className="uil-information uil-viewer-information" onToggle={event => setInformationOpen(event.currentTarget.open)}><summary>实验信息与已知限制</summary><p>冻结交互快照，不代表当前正式产品。不调用真实 AI、不下单、不扣款。</p><p>{v.promptSummary}</p><h2>可操作内容</h2><ul>{v.interactionSummary.map(s=><li key={s}>{s}</li>)}</ul><h2>归档调整</h2><ul>{v.archiveChanges.map(s=><li key={s}>{s}</li>)}</ul><h2>素材与限制</h2><p>{v.assetDisclosure}</p><ul>{v.limitations.map(s=><li key={s}>{s}</li>)}</ul><Conditions variants={[v]} /></details>
    {status === "error" && <div className="uil-recovery" role="alert"><p>快照未能完整加载。可能是资源加载失败，或脚本未发出就绪通知。</p><button className="uil-button" onClick={reset}>重新加载</button><Link href={back}>返回对照页</Link></div>}
    <div className="uil-keyboard-help"><button onClick={() => frame.current?.focus()}>进入快照操作</button><a href="#after-snapshot">跳过快照 ↓</a><span>Tab 可进出；快照内按 Esc 返回外层。</span></div>
    {fixedWidth && <p className="uil-viewport-note">{mode === "mobile" ? "375px 手机视口" : "原版1440px大屏视口"} · 自动适配容器</p>}
    <div className="uil-viewer-canvas" ref={container}>
      <div className="uil-frame-position" style={{width:designWidth*scale,height:designHeight*scale}}>
        {mounted && <iframe key={revision} ref={frame} src={v.entryUrl} title={`${e.title} · ${v.model} × ${v.title} · 冻结交互快照`} sandbox="allow-scripts" referrerPolicy="no-referrer" onLoad={loading} style={{width:designWidth,height:designHeight,transform:`scale(${scale})`}} />}
      </div>
    </div>
    <div className="uil-viewer-exit" id="after-snapshot"><Link ref={exit} href={back}>← 返回当前对照组合</Link><Link href="/works/ui-lab">浏览其他实验 →</Link></div>
  </>;
}
