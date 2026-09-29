import type { NatureTask } from "@/lib/works/linquan/types";
import { natureTaskSchema } from "@/lib/works/linquan/schemas/domain";

export const natureTasks: NatureTask[] = [
  { id: "leaf-shapes", title: "叶片形状收集", description: "在不采摘的前提下，找到三种不同叶缘：锯齿、波浪和羽状。", spotIds: ["cedar-boardwalk", "fern-observatory"], suitableFor: ["儿童", "亲子"], interests: ["nature", "family"], durationMinutes: 15, prompt: "请观察脚边和标牌旁的叶片，用手机拍下三种形状。" },
  { id: "stream-life", title: "溪边生命线索", description: "观察水面、石缝和岸边，寻找至少两种小型生命线索。", spotIds: ["moon-stream"], suitableFor: ["儿童", "亲子", "自然爱好者"], interests: ["nature", "family"], durationMinutes: 20, prompt: "保持在观察线外，记录你看到的水生昆虫、苔藓或鸟类。" },
  { id: "light-frame", title: "光影取景挑战", description: "利用杉林或观景台的明暗变化，完成一张不拍人的光影照片。", spotIds: ["cedar-boardwalk", "cloud-platform"], suitableFor: ["摄影爱好者"], interests: ["photography", "scenery"], durationMinutes: 15, prompt: "打开取景网格，让光线沿着对角线进入画面。" },
  { id: "quiet-minute", title: "一分钟自然静听", description: "找一个舒适座位，安静记录一分钟内听到的三种声音。", spotIds: ["pine-rest", "fern-observatory"], suitableFor: ["所有游客"], interests: ["relaxation", "nature"], durationMinutes: 8, prompt: "先闭眼十秒，再把听到的声音按远近写下来。" },
];

export const natureTaskMap = Object.fromEntries(natureTasks.map((task) => [task.id, natureTaskSchema.parse(task)])) as Record<string, NatureTask>;
