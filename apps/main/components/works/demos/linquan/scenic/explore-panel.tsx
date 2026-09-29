"use client";

import Image from "next/image";
import { Icon, type IconName } from "@/components/works/demos/linquan/ui/icons";
import { activities, scenicSpotMap } from "@/lib/works/linquan/data";
import { useVisitor } from "@/components/works/demos/linquan/shell/visitor-provider";

const services: { title: string; icon: IconName; prompt: string }[] = [
  { title: "找卫生间", icon: "restroom", prompt: "最近的厕所在哪里？" },
  { title: "歇脚补水", icon: "bench", prompt: "附近哪里可以休息和饮水？" },
  { title: "活动报名", icon: "sun", prompt: "今天有什么活动？" },
  { title: "文创取货", icon: "gift", prompt: "我想领取文创，如何取货？" },
  { title: "交通出入", icon: "bus", prompt: "景区交通和停车有什么信息？" },
  { title: "人工求助", icon: "help", prompt: "需要人工求助" },
];

export function ExplorePanel({ onPlan, onAsk }: { onPlan: () => void; onAsk: (message: string) => void }) {
  const { context } = useVisitor();
  const activity = activities[1];
  return <div className="explore-content">
    <section className="hero">
      <Image src="/projects/demos/linquan/forest.jpg" alt="晨光穿过层叠杉林，照亮林间小径" fill priority sizes="(max-width: 760px) 100vw, 70vw" className="hero-image" />
      <div className="hero-shade" /><div className="hero-content"><span className="hero-kicker"><span /> 你的林泉之旅，从这里开始</span><h2>把时间，<br />交给山野。</h2><p>穿过杉林，听一听溪水。<br />让向导为你安排一路的风景。</p><button className="light-button" onClick={onPlan}>{context.currentRoute ? "继续我的行程" : "定制我的游览路线"}<Icon name="arrow" size={18} /></button></div>
      <div className="hero-caption"><Icon name="leaf" size={17} /><span>去自然里，深呼吸。<small>WANDER SLOW. FEEL MORE.</small></span></div><span className="photo-note">自然意境图</span>
    </section>
    <section className="service-section" aria-labelledby="service-title"><div className="section-heading compact"><h2 id="service-title">游园小帮手</h2><span>需要的时候，就在身边</span></div><div className="service-grid">{services.map((service) => <button key={service.title} className="service-button" onClick={() => onAsk(service.prompt)}><span><Icon name={service.icon} size={23} /></span>{service.title}</button>)}</div></section>
    <section aria-labelledby="discover-title"><div className="section-heading"><div><span className="eyebrow">FIND YOUR MOMENT</span><h2 id="discover-title">总有一种方式，适合今天的你</h2></div></div><div className="experience-grid">
      <button className="experience-card forest-card" onClick={onPlan}><Image src="/projects/demos/linquan/woodland.jpg" alt="阳光下的葱郁森林" fill sizes="(max-width: 760px) 90vw, 35vw" /><span className="experience-shade" /><span className="experience-label">轻松漫游</span><span className="experience-copy"><strong>不赶路，只感受。</strong><span>根据体力和时间，找到刚好的路线</span></span><span className="circle-arrow"><Icon name="arrow" /></span></button>
      <button className="experience-card nature-card" onClick={() => onAsk("给我一个适合当前地点的自然探索任务")}><span className="experience-label">自然探索</span><svg className="botanical" viewBox="0 0 200 200" aria-hidden="true"><path d="M98 188C90 129 114 80 155 24" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M102 148C49 143 42 113 45 91c32 7 53 23 57 57ZM107 116c52 0 65-23 66-47-34 0-57 16-66 47ZM122 88C82 77 80 48 87 31c24 12 38 29 35 57ZM137 53c31 0 45-16 46-37-25-1-41 10-46 37Z" fill="currentColor" opacity=".3" /><path d="m99 142-46-42m59 11 52-31m-42 1L91 40m50 7 33-24" stroke="currentColor" fill="none" strokeWidth="1" /></svg><span className="experience-copy"><strong>和孩子，一起发现。</strong><span>一片叶子，也能开启一场小探险</span></span><span className="circle-arrow"><Icon name="arrow" /></span></button>
    </div></section>
    <section className="activity-feature"><span className="activity-emblem"><Icon name="sun" size={30} /></span><div className="activity-copy"><span className="eyebrow">今日活动 · DEMO 场次</span><h3>{activity.name}</h3><p>{activity.time} · {activity.duration} 分钟 · {scenicSpotMap[activity.locationSpotId].name}</p></div><button className="text-link" onClick={() => onAsk(`介绍一下${activity.name}活动，适合孩子吗？`)}>了解活动<Icon name="arrow" size={17} /></button></section>
  </div>;
}
