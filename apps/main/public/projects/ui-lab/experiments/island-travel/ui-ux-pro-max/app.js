"use strict";
const data = {
 "三亚": {base:108, minutes:210, label:"约 3 小时 30 分"},
 "琼海": {base:58, minutes:130, label:"约 2 小时 10 分"},
 "文昌": {base:36, minutes:80, label:"约 1 小时 20 分"}
};
let state = {city:"三亚",period:"上午",guests:2,choice:0};
const el = id => document.getElementById(id);
const departure = index => (state.period === "上午" ? ["08:30","09:40","10:20"] : ["13:30","14:40","15:20"])[index];
const fare = index => data[state.city].base + [0,10,5][index];
function arrival(index) { const [h,m] = departure(index).split(":").map(Number); const total = h * 60 + m + data[state.city].minutes; return String(Math.floor(total / 60)).padStart(2,"0") + ":" + String(total % 60).padStart(2,"0"); }
function summary() {
 el("heading-city").textContent=state.city;
 el("heading-period").textContent="明天"+state.period;
 el("heading-guests").textContent=state.guests+" 位成人 · 单程";
 el("summary-date").textContent="明天 · "+state.period+"出发";
 el("summary-city").textContent=state.city;
 el("from-time").textContent=departure(state.choice)+" · 出行站";
 el("to-time").textContent=arrival(state.choice)+" · 出行站";
 el("duration").textContent=data[state.city].label;
 el("summary-guests").textContent=state.guests+" 位成人";
 el("unit-price").textContent="¥"+fare(state.choice);
 el("total").innerHTML="<small>¥</small>"+fare(state.choice)*state.guests+"<em>.00</em>";
}
function render() {
 el("departure-list").replaceChildren();
 for(let i=0;i<3;i++){
  const label=document.createElement("label");
  label.className="departure-option";
  label.innerHTML='<input type="radio" name="departure" value="'+i+'" '+(i===state.choice?'checked':'')+' aria-label="'+departure(i)+'出发，'+arrival(i)+'到达，每人'+fare(i)+'元"><span class="departure-row"><span class="radio-visual" aria-hidden="true"></span><span class="row-number">0'+(i+1)+'</span><span class="time-block"><strong>'+departure(i)+'</strong><small>海口出行站</small></span><span class="duration-block">直达<span class="route-line"></span>无需换乘</span><span class="time-block"><strong>'+arrival(i)+'</strong><small>'+state.city+'出行站</small></span><span class="price-block"><strong><small>¥</small>'+fare(i)+'</strong><small>每人 · 模拟</small></span></span>';
  label.querySelector("input").addEventListener("change",()=>{state.choice=i;summary();});
  el("departure-list").append(label);
 }
 summary();
}
el("trip-search").addEventListener("submit",event=>{
 event.preventDefault();
 state={city:el("destination").value,period:el("period").value,guests:Number(el("guests").value),choice:0};
 render();
 el("result-status").textContent="已更新：海口到"+state.city+"，明天"+state.period+"，"+state.guests+"位成人。共3个预设班次。";
 el("journeys-title").focus({preventScroll:true});
 el("journeys").scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
});
const dialog=el("confirmation");
el("confirm-trip").addEventListener("click",()=>{
 el("confirm-title").innerHTML="为下一程，<br>留一个位置。";
 el("confirm-subtitle").textContent="请确认以下模拟行程。";
 el("confirm-route").textContent="海口 ⟶ "+state.city;
 el("confirm-time").textContent="明天 · "+departure(state.choice)+" 出发 / "+arrival(state.choice)+" 到达";
 el("confirm-guests").textContent=state.guests+" 位成人 · 模拟合计";
 el("confirm-price").textContent="¥"+fare(state.choice)*state.guests+".00";
 el("complete-demo").innerHTML='完成静态体验 <span aria-hidden="true">↗</span>';
 el("complete-demo").dataset.done="";
 el("dialog-note").textContent="本操作不创建订单，也不产生真实支付。";
 dialog.showModal();
});
el("close-dialog").addEventListener("click",()=>dialog.close());
el("complete-demo").addEventListener("click",()=>{
 if(el("complete-demo").dataset.done){dialog.close();return;}
 el("confirm-title").innerHTML="这一程，<br>先在想象中抵达。";
 el("confirm-subtitle").textContent="静态体验已完成，期待下一次出发。";
 el("dialog-note").textContent="体验完成。没有创建订单，没有收取费用。";
 el("complete-demo").textContent="返回行程";
 el("complete-demo").dataset.done="yes";
});
render();

