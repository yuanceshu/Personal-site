"use client";

import { useRef, useState } from "react";
import { agreementSchema, signatureSchema, type Agreement, type Signature } from "@/lib/works/heating/agreement";
import { amount } from "@/lib/works/heating/client-contract";
import { Modal } from "./business-ui";

export function AgreementCard({ agreement, active, busy, open }: { agreement: Agreement; active: boolean; busy: boolean; open: (mode: "read" | "sign") => void }) {
  return <section className="heat-business-card heat-agreement-card" data-testid="agreement-card"><div className="heat-card-top"><h3>{agreement.title}</h3><span className={`heat-badge${agreement.signedAt ? " good" : ""}`}>{agreement.signedAt ? "已模拟签署" : "待签署"}</span></div><p>{agreement.year} 年度 · {agreement.address}</p><dl className="heat-facts"><dt>计费面积</dt><dd>{agreement.areaHundredths / 100}㎡</dd><dt>本次费用</dt><dd>¥ {amount(agreement.amountCents)}</dd></dl><p className="heat-storage-note">仅为演示签署，不具备真实电子合同效力，请勿使用真实签名。</p>{active && <div className="heat-actions"><button className="heat-button quiet" disabled={busy} onClick={() => open("read")}>查看完整协议</button>{!agreement.signedAt && <button className="heat-button primary" disabled={busy} onClick={() => open("sign")}>手写签署</button>}</div>}{agreement.signedAt && <p className="heat-good-text">{agreement.source === "preset_demo" ? "预设模拟签署记录" : "已完成演示签署"} · {new Date(agreement.signedAt).toLocaleString("zh-CN", { hour12: false })}</p>}</section>;
}

export function AgreementDialog({ agreement: raw, initialMode, busy, close, sign, error }: { agreement: Agreement; initialMode: "read" | "sign"; error: string; busy: boolean; close: () => void; sign: (signature: Signature, idempotencyKey: string) => void }) {
  const agreement = agreementSchema.parse(raw);
  const [mode, setMode] = useState(initialMode);
  const [strokes, setStrokes] = useState<Signature>([]);
  const strokesRef = useRef<Signature>([]), pointer = useRef<number | null>(null), requestId = useRef(crypto.randomUUID());
  const [limit, setLimit] = useState(false);
  const count = () => strokesRef.current.reduce((n, stroke) => n + stroke.length, 0);
  const update = () => setStrokes(strokesRef.current.map(stroke => [...stroke]));
  const valid = signatureSchema.safeParse(strokes).success;
  return <Modal drawer className="heat-agreement-dialog" title={mode === "read" ? "完整演示协议" : "手写演示签署"} close={() => { if (!busy) close(); }}><p className="heat-agreement-title">{agreement.title}</p><p>{agreement.year} · {agreement.address}<br/>计费面积 {agreement.areaHundredths / 100}㎡ · 本次费用 ¥{amount(agreement.amountCents)}</p><p className="heat-callout">仅为演示签署，不具备真实电子合同效力，请勿使用真实签名。</p>{mode === "read" ? <><ol className="heat-agreement-clauses">{agreement.clauses.map((clause, index) => <li key={index}>{clause}</li>)}</ol>{!agreement.signedAt && <button className="heat-button primary full" onClick={() => setMode("sign")}>开始手写签署</button>}</> : <><button className="heat-button quiet full" disabled={busy} onClick={() => setMode("read")}>查看完整协议</button><p className="heat-sign-label">请用手指或鼠标写下演示笔迹</p><svg className="heat-signature" aria-label="演示手写签名板" role="img" viewBox="0 0 1000 400" preserveAspectRatio="none" onPointerDown={event => {
      if (busy || pointer.current !== null) return;
      if (count() >= 2047 || strokesRef.current.length >= 64) { setLimit(true); return; }
      event.preventDefault(); pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId);
      const bounds = event.currentTarget.getBoundingClientRect();
      const point: [number, number] = [(event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height];
      strokesRef.current.push([point]); requestId.current = crypto.randomUUID(); update();
    }} onPointerMove={event => {
      if (busy || pointer.current !== event.pointerId) return;
      if (count() >= 2048) { setLimit(true); return; }
      const bounds = event.currentTarget.getBoundingClientRect();
      strokesRef.current.at(-1)!.push([Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))]); update();
    }} onPointerUp={() => { pointer.current = null; strokesRef.current = strokesRef.current.filter(stroke => stroke.length > 1); update(); }} onPointerCancel={() => { pointer.current = null; strokesRef.current = strokesRef.current.filter(stroke => stroke.length > 1); update(); }}>{strokes.map((stroke, index) => <polyline key={index} points={stroke.map(([x,y]) => `${x * 1000},${y * 400}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>)}</svg>{limit && <p className="heat-warn-text" role="status">笔迹已达上限，请清除后简写。</p>}{error && <p className="heat-error" role="alert">{error}</p>}<div className="heat-actions"><button className="heat-button quiet" disabled={busy || !strokes.length} onClick={() => { strokesRef.current = []; pointer.current = null; update(); setLimit(false); requestId.current = crypto.randomUUID(); }}>清除重签</button><button className="heat-button primary" disabled={busy || !valid} onClick={() => sign(strokes, requestId.current)}>{busy ? "正在登记签署…" : "确认模拟签署"}</button></div><p className="heat-storage-note">笔迹仅用于本次校验，不保存、不发送给 AI。签署后仍需您确认账单和模拟付款。</p></>}</Modal>;
}
