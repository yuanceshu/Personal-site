import { faqs, scenicSpotMap } from "@/lib/works/linquan/data";
import { contextBrief, normalizeContext } from "@/lib/works/linquan/agent/context";
import { explainWithOptionalLlm } from "@/lib/works/linquan/agent/llm";
import { activityNameToId, detectIntent, detectLocationId, extractActivityId } from "@/lib/works/linquan/agent/router";
import { adviseRoute, getCurrentLocation, getNatureTask, getScenicInfo, getServiceInfo, pickupCreative, planTourRoute, queryEvents, registerEvent, requestStaffHelp, setCurrentLocation } from "@/lib/works/linquan/tools";
import type { ChatMessage, VisitorContext, VisitorProfile } from "@/lib/works/linquan/types";

export interface AgentResponse {
  answer: string;
  tool?: string;
  context?: VisitorContext;
  action?: ChatMessage["action"];
  data?: unknown;
  engine?: { mode: "demo" | "llm" | "fallback"; model?: string; reason?: string };
}

export async function runAgentWithOptionalLlm(message: string, rawContext: unknown, history: AgentHistoryMessage[] = [], request?: Request) {
  const deterministic = runAgent(message, rawContext, history);
  const operationNeedsSuccess = ["register_event", "pickup_creative", "request_staff_help"].includes(deterministic.tool ?? "");
  if (operationNeedsSuccess && deterministic.data === undefined) {
    return { ...deterministic, engine: { mode: "demo" as const, reason: "业务 Tool 未成功，保留规则错误结果" } };
  }
  const explanation = await explainWithOptionalLlm({
    message,
    context: normalizeContext(deterministic.context ?? rawContext),
    history,
    deterministicAnswer: deterministic.answer,
    tool: deterministic.tool,
    data: deterministic.data,
  }, request);
  return { ...deterministic, answer: explanation.answer ?? deterministic.answer, engine: { mode: explanation.mode, model: explanation.model, reason: explanation.reason } };
}

function isEnglish(message: string) {
  return /^[\x00-\x7F\s\d\p{P}]+$/u.test(message) && /[a-z]/i.test(message);
}

type AgentHistoryMessage = { role: "user" | "assistant"; content: string };

function countInMessage(message: string, labels: string[]) {
  const numeral: Record<string, number> = { 零: 0, 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  for (const label of labels) {
    const match = message.match(new RegExp("(\\d+|[零一二两三四五六七八九十]+)\\s*(?:位|个|名)?\\s*" + label));
    if (match) return Number.isFinite(Number(match[1])) ? Number(match[1]) : (numeral[match[1]] ?? numeral[match[1].slice(-1)] ?? 0);
  }
  return undefined;
}

function updateProfileFromMessage(profile: VisitorProfile, message: string) {
  const adults = countInMessage(message, ["成人", "大人"]);
  const children = countInMessage(message, ["儿童", "孩子"]);
  const elderly = countInMessage(message, ["长者", "老人"]);
  const timeMatch = message.match(/(\d+)\s*(?:分钟|min|minutes?)/i);
  const fitness = /体力(?:较低|偏低|不太好|差)/.test(message) ? "low" : /体力(?:较好|很好|充沛)/.test(message) ? "high" : profile.fitness;
  const interests = [...profile.interests];
  if (/自然|观察|鸟|植物|nature/i.test(message) && !interests.includes("nature")) interests.push("nature");
  if (/摄影|拍照|photo/i.test(message) && !interests.includes("photography")) interests.push("photography");
  if (/风景|景色|scenery/i.test(message) && !interests.includes("scenery")) interests.push("scenery");
  return {
    ...profile,
    adults: adults ?? profile.adults,
    children: children ?? profile.children,
    elderly: elderly ?? profile.elderly,
    availableMinutes: timeMatch ? Number(timeMatch[1]) : profile.availableMinutes,
    fitness,
    interests,
    avoidStairs: /少走台阶|避开台阶|不要台阶|avoid stairs/i.test(message) ? true : profile.avoidStairs,
  };
}

function contextWithProfile(context: VisitorContext, message: string) {
  const profile = updateProfileFromMessage(context.profile, message);
  return JSON.stringify(profile) === JSON.stringify(context.profile)
    ? context
    : { ...context, profile, updatedAt: new Date().toISOString() };
}

function ordinalIndex(message: string) {
  const match = message.match(/第([一二三123])个/);
  if (!match) return undefined;
  return ({ 一: 0, 1: 0, 二: 1, 2: 1, 三: 2, 3: 2 } as Record<string, number>)[match[1]];
}

function activityIdFromHistory(message: string, history: AgentHistoryMessage[], context: VisitorContext) {
  const explicit = extractActivityId(message);
  if (explicit) return activityNameToId[explicit];
  const events = queryEvents({ keyword: "" });
  const index = ordinalIndex(message);
  if (index !== undefined && context.conversation.activityIds[index]) return context.conversation.activityIds[index];
  if (index !== undefined && events[index]) return events[index].id;
  const latestMention = [...history].reverse().flatMap((item) => events.filter((event) => item.content.includes(event.name))).at(0);
  return latestMention?.id ?? context.conversation.selectedActivityId ?? null;
}

export function runAgent(message: string, rawContext: unknown, history: AgentHistoryMessage[] = []): AgentResponse {
  const context = contextWithProfile(normalizeContext(rawContext), message);
  const intent = detectIntent(message);
  const brief = contextBrief(context);
  const english = isEnglish(message);

  if (intent === "greeting") return { answer: english ? `Hello! You are near ${brief.currentSpotName}. I can plan a route, find services, check events, or start a nature task.` : `你好！你现在在${brief.currentSpotName}。我可以帮你规划路线、找现场服务、查活动，也可以开始自然探索。` };
  if (intent === "set-location") {
    const spotId = detectLocationId(message);
    if (!spotId) return { answer: "我没有识别出具体地点，请告诉我你到了哪个景点。" };
    const result = setCurrentLocation({ spotId, context });
    return { answer: english ? `Location updated to ${result.spot.name}. I will continue from here.` : `已把你的位置更新为${result.spot.name}，接下来我会从这里继续服务。`, tool: "set_current_location", context: result.context, action: { type: "location-updated", label: `已到达${result.spot.shortName}` }, data: result.spot };
  }
  if (intent === "location") {
    const result = getCurrentLocation(context);
    return { answer: english ? `You are at ${result.currentSpot.name}. ${result.currentSpot.description}` : `你现在在${result.currentSpot.name}。${result.currentSpot.description}`, tool: "get_current_location", data: result };
  }
  if (intent === "route") {
    if (context.currentRoute && /(下一站|还来得及|继续|山顶|植物园)/.test(message)) {
      const advice = adviseRoute({ context, destinationSpotId: /山顶|植物园/.test(message) ? "sunridge-garden" : undefined });
      return { answer: advice.explanation + (advice.canVisit ? " 可以继续，但请按当前路线返回。" : " 请先返回入口或缩短停留。"), tool: "advise_route", data: advice, context };
    }
    const plan = planTourRoute({ currentSpotId: context.currentSpotId, profile: context.profile, visitedSpotIds: context.visitedSpotIds });
    const nextContext = { ...context, currentRoute: plan, updatedAt: new Date().toISOString() };
    const answer = english
      ? plan.summary + " It takes about " + (plan.feasible ? plan.totalMinutes : plan.requiredMinutes) + " minutes including " + plan.returnMinutes + " minutes to return."
      : plan.summary + " " + (plan.feasible ? "全程约 " + plan.totalMinutes + " 分钟，其中已预留 " + plan.returnMinutes + " 分钟返程。" : "最短安全方案需要 " + plan.requiredMinutes + " 分钟。") + plan.rationale[0];
    return { answer, tool: "plan_tour_route", context: nextContext, action: { type: "route-created", label: "路线已生成" }, data: plan };
  }
  if (intent === "events") {
    const events = queryEvents({ keyword: "" });
    const index = ordinalIndex(message);
    const selected = index === undefined ? undefined : events[index];
    const nextContext = { ...context, conversation: { ...context.conversation, activityIds: events.map((event) => event.id), selectedActivityId: selected?.id ?? context.conversation.selectedActivityId }, updatedAt: new Date().toISOString() };
    if (selected) {
      const childFit = selected.suitableFor.some((item) => item.includes("儿童") || item.includes("亲子"));
      return { answer: "第二个活动是「" + selected.name + "」，" + (childFit ? "适合孩子参加" : "更适合成人或有对应兴趣的游客") + "。" + selected.description, tool: "query_events", context: nextContext, data: selected };
    }
    const answer = english
      ? "There are " + events.length + " demo activities today: " + events.map((event) => event.name + " at " + event.time).join(", ") + "."
      : "今天有 " + events.length + " 个 Demo 活动：" + events.map((event) => event.time + " " + event.name).join("、") + "。你可以说“帮我报名 + 活动名称”。";
    return { answer, tool: "query_events", context: nextContext, data: events };
  }
  if (intent === "registration") {
    const activityId = activityIdFromHistory(message, history, context) ?? undefined;
    if (!activityId) return { answer: "请告诉我你想报名的活动名称，例如“帮我报名溪谷小小观察员”。" };
    try {
      const adults = countInMessage(message, ["成人", "大人"]);
      const children = countInMessage(message, ["儿童", "孩子"]);
      const elderly = countInMessage(message, ["长者", "老人"]);
      const hasExplicitPeople = adults !== undefined || children !== undefined || elderly !== undefined;
      const visitorCount = hasExplicitPeople
        ? (adults ?? 0) + (children ?? 0) + (elderly ?? 0)
        : context.profile.adults + context.profile.children + context.profile.elderly;
      const result = registerEvent({ activityId, visitorCount });
      const nextContext = { ...context, conversation: { ...context.conversation, selectedActivityId: activityId }, updatedAt: new Date().toISOString() };
      return { answer: result.message + " 活动：" + result.activity.name + "，" + visitorCount + " 人，确认码：" + result.confirmationCode + "。", tool: "register_event", context: nextContext, action: { type: "event-registered", label: "活动报名成功" }, data: result };
    } catch (error) {
      return { answer: error instanceof Error ? error.message : "报名失败，请稍后再试。", tool: "register_event" };
    }
  }
  if (intent === "nature") {
    const task = getNatureTask({ currentSpotId: context.currentSpotId, profile: context.profile });
    return task ? { answer: `给你一个适合当前地点的自然任务：**${task.title}**。${task.description} ${task.prompt}预计用时 ${task.durationMinutes} 分钟。`, tool: "get_nature_task", data: task } : { answer: "当前地点暂时没有匹配的自然任务。" };
  }
  if (intent === "pickup") {
    const code = message.match(/[A-Za-z]{2}-\d{4}/)?.[0];
    if (!code) return { answer: "可以帮你查询文创取货。请告诉我取货码，例如 LQ-2048。", tool: "pickup_creative", context: { ...context, conversation: { ...context.conversation, pendingPickup: true }, updatedAt: new Date().toISOString() } };
    try {
      const result = pickupCreative({ orderCode: code });
      return { answer: `${result.message} Demo 取货码：${result.orderCode}。`, tool: "pickup_creative", data: result };
    } catch (error) {
      return { answer: error instanceof Error ? error.message : "取货查询失败。", tool: "pickup_creative" };
    }
  }
  if (intent === "assistance") {
    const result = requestStaffHelp({ currentSpotId: context.currentSpotId, reason: message });
    return { answer: `${result.message} 工单号：${result.ticketId}。`, tool: "request_staff_help", data: result };
  }
  if (intent === "service") {
    const type = /厕所|卫生间|洗手间|restroom|toilet/i.test(message) ? "restroom" : /休息/i.test(message) ? "rest" : /饮水|water/i.test(message) ? "water" : /急救|医疗/i.test(message) ? "medical" : undefined;
    const result = getServiceInfo({ currentSpotId: context.currentSpotId, type });
    return result ? { answer: `离你最近的是${result.service.name}，从${scenicSpotMap[context.currentSpotId].shortName}出发约 ${result.distance} 分钟。${result.service.description}开放时间：${result.service.openHours}。`, tool: "get_service_info", data: result } : { answer: "我暂时没有找到匹配的服务点。" };
  }
  if (intent === "hours") return { answer: faqs.find((faq) => faq.id === "opening")?.answer ?? "景区每日 08:00–18:00 开放。", tool: "get_scenic_info" };
  if (intent === "transport") return { answer: faqs.find((faq) => faq.id === "transport")?.answer ?? "请从晨雾入口进入景区。", tool: "get_scenic_info" };

  const result = getScenicInfo({ query: message });
  if (result.type === "spot" && result.spot) return { answer: `${result.spot.name}：${result.spot.description} 推荐停留 ${result.spot.recommendedStayMinutes} 分钟。亮点：${result.spot.highlights.join("、")}。`, tool: "get_scenic_info", data: result };
  if (result.type === "search" && result.spots.length) return { answer: `我找到这些相关景点：${result.spots.map((spot) => spot.name).join("、")}。你可以继续问我开放时间、路线、活动或现场服务。`, tool: "get_scenic_info", data: result };
  return { answer: english ? "I can help with scenic information, routes, events, nature tasks, services, and your current location." : "我可以帮你查询景点、开放时间、交通、路线、活动、自然任务、厕所和其他现场服务。也可以直接说“我到观景台了”。" };
}
