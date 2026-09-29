"use client";

import { useCallback, useEffect, useState } from "react";
import { useVisitor } from "@/components/works/demos/linquan/shell/visitor-provider";
import { scenicSpots, scenicSpotMap } from "@/lib/works/linquan/data";
import { setCurrentLocation } from "@/lib/works/linquan/tools/location";
import { Icon } from "@/components/works/demos/linquan/ui/icons";

export function ContextPanel({ onPlan, onAsk }: { onPlan: () => void; onAsk: (message: string) => void }) {
  const { context, setContext, hydrated } = useVisitor();
  const spot = scenicSpotMap[context.currentSpotId];
  const [speaking, setSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const route = context.currentRoute;
  const nextStop = route?.stops.find((stop) => !context.visitedSpotIds.includes(stop.spotId));
  const profile = context.profile;
  const speak = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(spot.description);
    utterance.lang = "zh-CN";
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }, [spot.description]);
  useEffect(() => {
    queueMicrotask(() => setVoiceSupported("speechSynthesis" in window));
  }, []);
  useEffect(() => {
    if (hydrated && profile.voiceGuideEnabled) {
      const timer = window.setTimeout(speak, 0);
      return () => { window.clearTimeout(timer); window.speechSynthesis.cancel(); };
    }
    return () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); };
  }, [hydrated, profile.voiceGuideEnabled, speak]);

  return <aside className="context-column" aria-label="本次游览状态">
    <section className="journey-card"><div className="card-heading"><h2>我的游览手记</h2><span className="saved-label"><span />{hydrated ? "已在本机保存" : "恢复中"}</span></div>
      <div className="location-card"><span className="location-icon"><Icon name="pin" size={22} /></span><div><span className="field-caption">我现在在</span><label className="sr-only" htmlFor="current-location">更新当前位置</label><select id="current-location" value={context.currentSpotId} disabled={!hydrated} onChange={(event) => setContext(setCurrentLocation({ context, spotId: event.target.value }).context)}>{scenicSpots.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><span className="location-edit">切换</span></div>
      <p className="location-description">{spot.description}</p>
      <div className="journey-profile"><div className="minor-heading"><span>今天和谁一起出发</span><button className="text-link" onClick={onPlan}>编辑<Icon name="chevron" size={12} /></button></div><div className="party-summary"><Icon name="users" size={18} /><span>{profile.adults} 成人{profile.children > 0 && ` · ${profile.children} 儿童`}{profile.elderly > 0 && ` · ${profile.elderly} 长者`}</span></div><div className="tag-list"><span className="tag"><Icon name="clock" size={12} />{profile.availableMinutes} 分钟</span><span className="tag">{profile.fitness === "low" ? "慢慢走" : profile.fitness === "high" ? "活力探索" : "舒适节奏"}</span>{profile.avoidStairs && <span className="tag">少走台阶</span>}</div></div>
      <div className="journey-route"><div className="minor-heading"><span>接下来这样走</span>{route && <span>{context.visitedSpotIds.length} 处足迹</span>}</div>
        {route ? <><div className="mini-stop"><span className="stop-dot current" /><div><small>当前位置</small><strong>{spot.name}</strong></div></div><div className="mini-stop"><span className="stop-dot" /><div><small>{route.feasible ? nextStop ? "下一站" : "返回集合点" : "建议优先返程"}</small><strong>{route.feasible && nextStop ? scenicSpotMap[nextStop.spotId]?.name : scenicSpotMap[route.returnSpotId]?.name}</strong></div></div><button className="outline-button full-width" onClick={onPlan}>查看我的路线<Icon name="arrow" size={16} /></button></> : <><div className="route-empty"><span className="route-sketch"><Icon name="route" size={32} /></span><p>风景很多，不必赶着看完。<br /><span>让向导帮你选一条刚刚好的路。</span></p></div><button className="primary-button full-width" onClick={onPlan}>规划我的路线<Icon name="arrow" size={16} /></button></>}
      </div>
      <div className="voice-row"><span className="voice-icon"><Icon name="headphones" size={21} /></span><div><strong>边走边听</strong><span>{voiceSupported ? "到达新地点，自动语音讲解" : "此浏览器暂不支持语音"}</span></div><button className={`switch ${profile.voiceGuideEnabled ? "on" : ""}`} role="switch" aria-checked={profile.voiceGuideEnabled} aria-label="自动语音讲解" disabled={!voiceSupported || !hydrated} onClick={() => setContext({ ...context, profile: { ...profile, voiceGuideEnabled: !profile.voiceGuideEnabled }, updatedAt: new Date().toISOString() })}><i /></button></div>
      {profile.voiceGuideEnabled && voiceSupported && <button className="voice-play text-link" onClick={() => { if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); } else speak(); }}><Icon name={speaking ? "stop" : "play"} size={14} />{speaking ? "停止讲解" : "听听这里的故事"}</button>}
    </section>
    <button className="guide-card" onClick={() => onAsk("我现在在哪里，有什么值得看看？")}><span className="guide-icon"><Icon name="spark" size={23} /></span><span><strong>你的随身向导</strong><small>路线怎么走，故事慢慢说。</small></span><Icon name="arrow" size={18} /></button>
    <div className="field-note"><Icon name="leaf" size={22} /><p>只带走回忆，<br />把自然留在这里。</p><span>LEAVE ONLY FOOTPRINTS</span></div>
  </aside>;
}
