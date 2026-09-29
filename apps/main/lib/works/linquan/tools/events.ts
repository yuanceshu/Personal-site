import { activities, activityMap } from "@/lib/works/linquan/data";
import { queryEventsInputSchema, registerEventInputSchema } from "@/lib/works/linquan/schemas/domain";
import { queryEventsOutputSchema, registerEventOutputSchema } from "@/lib/works/linquan/schemas/tool";

export function queryEvents(rawInput: unknown) {
  const input = queryEventsInputSchema.parse(rawInput);
  const keyword = input.keyword?.toLowerCase();
  return queryEventsOutputSchema.parse(activities.filter((activity) => !keyword || `${activity.name}${activity.description}${activity.suitableFor.join("")}`.toLowerCase().includes(keyword)));
}

export function registerEvent(rawInput: unknown) {
  const input = registerEventInputSchema.parse(rawInput);
  const activity = activityMap[input.activityId];
  if (!activity) throw new Error("活动不存在");
  if (input.visitorCount > activity.remaining) throw new Error(`报名人数超过剩余名额，目前只剩 ${activity.remaining} 个名额`);
  return registerEventOutputSchema.parse({ success: true, confirmationCode: `DEMO-${activity.id.slice(0, 4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`, activity, visitorCount: input.visitorCount, message: "已模拟报名成功，到现场后请向工作人员出示确认码。" });
}
