import { natureTasks } from "@/lib/works/linquan/data";
import { scenicSpotMap } from "@/lib/works/linquan/data";
import { getNatureTaskInputSchema } from "@/lib/works/linquan/schemas/domain";
import { getNatureTaskOutputSchema } from "@/lib/works/linquan/schemas/tool";

export function getNatureTask(rawInput: unknown) {
  const input = getNatureTaskInputSchema.parse(rawInput);
  if (!scenicSpotMap[input.currentSpotId]) throw new Error("当前位置不存在，无法匹配自然任务");
  const matching = natureTasks.filter((task) => task.spotIds.includes(input.currentSpotId));
  const source = matching.length ? matching : natureTasks;
  const eligible = source.filter((task) => task.durationMinutes <= input.profile.availableMinutes);
  if (!eligible.length) return null;
  const scored = eligible.map((task) => ({
    task,
    score: task.interests.reduce((total, interest) => total + (input.profile.interests.includes(interest) ? 4 : 0), 0)
      + (input.profile.children > 0 && task.suitableFor.some((item) => item.includes("儿童") || item.includes("亲子")) ? 5 : 0)
      + (task.durationMinutes <= input.profile.availableMinutes ? 6 : -10)
      - Math.max(0, task.durationMinutes - input.profile.availableMinutes),
  }));
  return getNatureTaskOutputSchema.parse(scored.sort((a, b) => b.score - a.score)[0]?.task ?? null);
}
