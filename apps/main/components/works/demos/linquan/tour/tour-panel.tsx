"use client";

import { useRef, useState } from "react";
import { useVisitor } from "@/components/works/demos/linquan/shell/visitor-provider";
import { scenicSpots } from "@/lib/works/linquan/data";
import type { Interest } from "@/lib/works/linquan/types";
import { Icon } from "@/components/works/demos/linquan/ui/icons";

const interestOptions: Array<{ value: Interest; label: string }> = [
  { value: "scenery", label: "山野风景" }, { value: "nature", label: "自然观察" }, { value: "family", label: "亲子互动" }, { value: "photography", label: "拍照" }, { value: "relaxation", label: "轻松休息" }, { value: "culture", label: "在地故事" },
];
export function TourPanel({ onAsk }: { onAsk?: (message: string) => void }) {
  const { context, updateProfile, updateRouteStart, applyRoute, routeNeedsUpdate } = useVisitor();
  const plan = context.currentRoute;
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const profile = context.profile;
  const [peopleDraft, setPeopleDraft] = useState<Record<"adults" | "children" | "elderly", string> | null>(null);
  const people = peopleDraft ?? { adults: String(profile.adults), children: String(profile.children), elderly: String(profile.elderly) };
  const invalidPeople = (value: string) => !/^\d+$/.test(value) || Number(value) > 20;
  const peopleInvalid = Object.values(people).some(invalidPeople);
  const stalePlan = Boolean(plan && (routeNeedsUpdate || peopleInvalid));
  function changePeople(field: "adults" | "children" | "elderly", value: string) {
    setPeopleDraft({ ...people, [field]: value });
    if (!invalidPeople(value)) updateProfile({ ...profile, [field]: Number(value) });
  }
  const preview = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLDivElement>(null);
  const [conditionsOpen, setConditionsOpen] = useState(true);
  function update(field: keyof typeof profile, value: string | number | boolean | Interest[]) { updateProfile({ ...profile, [field]: value }); }
  function toggleInterest(interest: Interest) { update("interests", profile.interests.includes(interest) ? profile.interests.filter((item) => item !== interest) : [...profile.interests, interest]); }
  async function generate() {
    if (peopleInvalid) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/experiments/linquan/tour", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentSpotId: context.currentSpotId, profile, visitedSpotIds: context.visitedSpotIds }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "路线暂时无法生成");
      if (!applyRoute(payload.plan, context)) { setError("条件已更新，请按当前条件重新生成路线。"); return; }
      setConditionsOpen(false);
      requestAnimationFrame(() => preview.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }));
    } catch (err) { setError(err instanceof Error ? err.message : "路线暂时无法生成"); requestAnimationFrame(() => preview.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })); }
    finally { setLoading(false); }
  }
  return <div className="tour-content"><div className="tour-intro"><span className="eyebrow">YOUR OWN PACE</span><h2>把同行的人，<br /><em>告诉这条路。</em></h2><p>每个人的林泉，都可以有自己的走法。告诉我今天的时间和心情，我会把返程也一起算好。</p></div>
    <div className="tour-layout"><div className={`tour-form-card ${plan && !conditionsOpen ? "is-collapsed" : ""}`} ref={form}><div className="form-card-heading"><div><h3>今天一起出发</h3><span>{plan ? `${profile.adults + profile.children + profile.elderly} 人 · ${profile.availableMinutes} 分钟` : "随时可以回来修改"}</span>{plan && <button type="button" className="text-link mobile-adjust" aria-expanded={conditionsOpen} onClick={() => { setConditionsOpen(!conditionsOpen); if (!conditionsOpen) requestAnimationFrame(() => form.current?.scrollIntoView({ block: "start", behavior: "instant" })); }}>{conditionsOpen ? "收起条件" : "调整条件"}</button>}</div><span className="form-icon"><Icon name="users" size={22} /></span></div><div className="people-fields">{([['adults', '成人'], ['children', '儿童'], ['elderly', '长者']] as const).map(([field, title]) => <label key={field}><span>{title}</span><input type="number" min={0} max={20} step={1} value={people[field]} aria-label={title} aria-invalid={invalidPeople(people[field])} aria-describedby={invalidPeople(people[field]) ? `tour-${field}-error` : undefined} onChange={event => changePeople(field, event.target.value)} />{invalidPeople(people[field]) && <small id={`tour-${field}-error`} className="people-error">请输入 0–20 的整数</small>}</label>)}</div><div className="form-field"><label htmlFor="tour-available-minutes">今天大约还有多久</label><div className="range-row"><input id="tour-available-minutes" type="range" min={20} max={360} step={10} value={profile.availableMinutes} onChange={(event) => update("availableMinutes", Number(event.target.value))} /><output>{profile.availableMinutes} <small>分钟</small></output></div></div><div className="form-field"><label htmlFor="tour-start-location">从哪里开始</label><select id="tour-start-location" value={context.currentSpotId} onChange={(event) => updateRouteStart(event.target.value)}>{scenicSpots.map((spot) => <option key={spot.id} value={spot.id}>{spot.name}</option>)}</select></div><div className="form-field"><label>今天更想要</label><div className="interest-picker">{interestOptions.map((option) => <button type="button" className={`interest-chip ${profile.interests.includes(option.value) ? "selected" : ""}`} key={option.value} aria-pressed={profile.interests.includes(option.value)} onClick={() => toggleInterest(option.value)}>{option.label}</button>)}</div></div><div className="form-field"><label>行走偏好</label><div className="preference-row"><label className="preference"><input type="checkbox" checked={profile.avoidStairs} onChange={(event) => update("avoidStairs", event.target.checked)} /><span><Icon name="route" size={16} />少走台阶</span></label><label className="preference"><input type="checkbox" checked={profile.voiceGuideEnabled} onChange={(event) => update("voiceGuideEnabled", event.target.checked)} /><span><Icon name="headphones" size={16} />边走边听</span></label></div></div><button className="primary-button plan-submit" type="button" onClick={() => void generate()} disabled={loading || peopleInvalid}>{loading ? "正在为你找路…" : "找到我的路线"}<Icon name="arrow" size={18} /></button></div>
      <div className="route-preview" ref={preview} aria-live="polite"><div className="route-preview-head"><div><span className="eyebrow">YOUR ROUTE</span><h3>{stalePlan ? "条件已变，路线待更新" : plan ? plan.feasible ? "今天这样走，刚刚好" : "时间有点紧，先别赶路" : "一条还没写完的路线"}</h3></div>{plan && !stalePlan && <span className={`feasibility ${plan.feasible ? "good" : "warn"}`}>{plan.feasible ? "可从容完成" : "建议调整"}</span>}</div>{stalePlan && <p className="route-stale" role="status">下方保留的是上一次路线，请按当前条件重新生成后再出发。</p>}{error && <p className="error-text">{error}</p>}{plan ? <><p className="route-summary">{plan.summary}</p><div className="route-stats"><span><strong>{plan.feasible ? plan.totalMinutes : plan.requiredMinutes}</strong>分钟总计</span><span><strong>{plan.returnMinutes}</strong>分钟返程</span><span><strong>{plan.stops.length}</strong>个停留点</span></div><div className="route-timeline"><div className="timeline-line" />{plan.stops.map((stop) => <div className="timeline-stop" key={stop.spotId}><span className="timeline-dot">{stop.order}</span><div><small>{stop.walkMinutesFromPrevious ? `步行 ${stop.walkMinutesFromPrevious} 分钟后` : "从这里出发"}</small><strong>{scenicSpots.find((spot) => spot.id === stop.spotId)?.name}</strong><p>停留约 {stop.stayMinutes} 分钟 · {stop.reason}</p></div></div>)}<div className="timeline-stop return"><span className="timeline-dot"><Icon name="arrow" size={13} /></span><div><small>最后留给返程</small><strong>{scenicSpots.find((spot) => spot.id === plan.returnSpotId)?.name}</strong><p>预留 {plan.returnMinutes} 分钟，安心回到集合点</p></div></div></div><ul className="rationale">{plan.rationale.map((item) => <li key={item}><Icon name="check" size={14} />{item}</li>)}</ul>{onAsk && !stalePlan && <button className="text-link route-ask" onClick={() => onAsk("我已经看完路线了，告诉我下一站去哪？")}>问问向导下一步<Icon name="arrow" size={15} /></button>}</> : <div className="route-placeholder"><span className="route-placeholder-icon"><Icon name="mountain" size={40} /></span><p>设置好条件后，<br />我会为你铺开一条路。</p></div>}</div></div></div>;
}
