import type { Activity } from "@/lib/works/linquan/types";
import { activitySchema } from "@/lib/works/linquan/schemas/domain";

export const activities: Activity[] = [
  { id: "dawn-birdwalk", name: "晨光听鸟小组", time: "08:30", duration: 45, capacity: 12, remaining: 5, suitableFor: ["自然爱好者", "亲子", "摄影爱好者"], description: "由自然导师带队，从入口沿杉影木栈道寻找三种常见鸟鸣。", locationSpotId: "dawn-gate" },
  { id: "stream-lab", name: "溪谷小小观察员", time: "10:30", duration: 40, capacity: 10, remaining: 3, suitableFor: ["儿童", "亲子", "自然爱好者"], description: "在安全观察台认识溪边植物与水生昆虫，完成一张自然观察卡。", locationSpotId: "moon-stream" },
  { id: "sunset-sketch", name: "云端落日速写", time: "16:20", duration: 60, capacity: 15, remaining: 8, suitableFor: ["摄影爱好者", "文化爱好者"], description: "在观景台用简易画材记录河湾色彩，适合初学者。", locationSpotId: "cloud-platform" },
];

export const activityMap = Object.fromEntries(activities.map((activity) => [activity.id, activitySchema.parse(activity)])) as Record<string, Activity>;
