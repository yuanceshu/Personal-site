"use client";

import Link from "next/link";
import Image from "next/image";
import { addDays, dateLabel, searchTrips } from "@/lib/works/island-travel/domain";
import { travelRoot, useTravel } from "./TravelProvider";
import { Arrow, IslandMark, QueryForm, TripList, TripSummary } from "./TravelUI";

export function IslandTravel() {
  const { today, conditions, queried, trips, orders, selection, selectTrip } = useTravel();
  const suggestions = today ? searchTrips({ origin: "海口", destination: "三亚", date: addDays(today, 1), time_preference: "上午", quantity: 1 }, today, orders) : [];
  const shown = queried ? trips : suggestions;
  const selected = shown.find(t => t.id === selection?.trip.id) ?? shown[0];
  const quantity = conditions.quantity ?? 1;
  return <>
    <section className="hero" aria-labelledby="hero-title">
      <Image className="hero-image" src="/projects/demos/island-travel/rainforest.webp" alt="晨雾中的热带山谷，深绿山林环抱一条宁静的河流。AI 生成的虚构景观。" fill sizes="100vw" preload />
      <div className="hero-shade" />
      <div className="hero-center"><p className="overline">海南 · 不止一种抵达</p><h1 id="hero-title" tabIndex={-1}>山海之间，<br />自有去处。</h1><p className="hero-english">Beyond the everyday.</p><p className="hero-description">不必把每一刻排满。<br />告诉岛见下一站，给沿途留一点时间。</p><a className="explore" href="#search"><span>开启一段旅程</span><span aria-hidden="true">↓</span></a></div>
      <span className="hero-side">AN INVITATION TO SLOW DOWN</span><div className="hero-caption"><span>山林之间 / 一次关于出发的想象</span><span>AI 生成景观 · 非实地摄影</span></div>
    </section>
    <QueryForm home />
    <section className="journeys container" aria-labelledby="journeys-title">
      <div className="section-heading"><div><p className="overline">A JOURNEY, AT YOUR PACE</p><h2 id="journeys-title">选择一个，<span>刚好的出发。</span></h2></div><p>少一点匆忙，多一点余地。<br />从一段从容的旅途开始。</p></div>
      <div className="journey-layout"><section className="departures" aria-label="推荐行程">
        <div className="route-title"><div><span className="route-small">DEPARTURES</span><h3>{conditions.origin || "海口"}<span aria-hidden="true">⟶</span>{conditions.destination || "三亚"}</h3></div><p className="route-context">{today && dateLabel(conditions.date || addDays(today, 1))}<br />{quantity} 位乘客 · 单程</p></div>
        <TripList trips={shown} selectedId={selected?.id} onSelect={trip => selectTrip(trip, quantity, false)} />
        {!shown.length && <p className="travel-notice">{today ? "暂时没有符合条件的班次，可进入规划页调整日期与时段。" : "正在准备演示班次。"}</p>}
        <div className="table-note"><span>以上均为虚构班次与票价</span><span>已包含全部模拟费用</span></div>
        <div className="concierge-note"><IslandMark /><div><h4>这段路，让自己从容一点。</h4><p>不必把每一步想好。和岛见聊聊，<br />让出发的时间，更贴合你的计划。</p><Link href={travelRoot + "/plan"} className="text-link">和 AI 礼宾聊聊 <Arrow /></Link></div></div>
      </section>{selected && <TripSummary trip={selected} quantity={quantity}><button className="button gold full" onClick={() => selectTrip(selected, quantity)}>确认这段旅程 <Arrow /></button></TripSummary>}</div>
    </section>
    <section className="philosophy container"><div><p className="overline">THE ART OF GOING SLOW</p><h2>目的地之外，<br />还有<span>旅途本身。</span></h2></div><div className="philosophy-copy"><p>我们喜欢的旅行，不是把地图上的地点逐一打卡，而是经过一片山林时，愿意把目光留在窗外。</p><p>岛见是一个关于海南出行的产品想象。从选择班次到确认行程，让每一步都清楚，也让出发少一点负担。</p><a href="#search" className="text-link">回到出发的地方 <Arrow /></a></div></section>
  </>;
}
