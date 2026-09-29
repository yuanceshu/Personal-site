import type { ScenicSpot } from "@/lib/works/linquan/types";
import { scenicSpotSchema } from "@/lib/works/linquan/schemas/domain";

export const scenicSpots: ScenicSpot[] = [
  {
    id: "dawn-gate", name: "晨雾入口", shortName: "入口", description: "景区主入口，设有游客集合区、饮水处和全天候咨询台。", recommendedStayMinutes: 10, difficulty: "easy", stairs: "none", elderlyFriendly: true, childFriendly: true,
    facilities: ["游客中心", "卫生间", "饮水", "医疗点"], tags: ["culture", "relaxation"], nextSpotIds: ["cedar-boardwalk", "visitor-hub"], highlights: ["集合与出发", "领取当日活动卡"]
  },
  {
    id: "cedar-boardwalk", name: "杉影木栈道", shortName: "木栈道", description: "穿过低坡杉林的环形步道，光线柔和，适合慢慢热身和拍照。", recommendedStayMinutes: 25, difficulty: "easy", stairs: "low", elderlyFriendly: true, childFriendly: true,
    facilities: ["休息座椅", "饮水", "语音讲解点"], tags: ["scenery", "photography", "relaxation"], nextSpotIds: ["dawn-gate", "moon-stream", "pine-rest", "visitor-hub"], highlights: ["杉林光影", "低坡无障碍段"]
  },
  {
    id: "moon-stream", name: "月纹溪谷", shortName: "溪谷", description: "溪水沿浅岩床流过，夏季可以观察水生昆虫和溪边植物。", recommendedStayMinutes: 30, difficulty: "moderate", stairs: "medium", elderlyFriendly: false, childFriendly: true,
    facilities: ["亲水观察台", "休息座椅", "卫生间"], tags: ["nature", "family", "photography"], nextSpotIds: ["cedar-boardwalk", "fern-observatory", "pine-rest"], highlights: ["溪流声景", "亲水观察台"]
  },
  {
    id: "pine-rest", name: "松风歇脚台", shortName: "歇脚台", description: "位于林坡转折处的半山休息点，可看到入口方向的林海。", recommendedStayMinutes: 15, difficulty: "easy", stairs: "low", elderlyFriendly: true, childFriendly: true,
    facilities: ["遮阴座椅", "饮水", "急救箱"], tags: ["relaxation", "scenery"], nextSpotIds: ["cedar-boardwalk", "moon-stream", "cloud-platform"], highlights: ["林海远眺", "补水休息"]
  },
  {
    id: "fern-observatory", name: "蕨影自然观察区", shortName: "观察区", description: "保留完整蕨类群落的自然观察区，适合亲子完成寻找叶片形状任务。", recommendedStayMinutes: 25, difficulty: "moderate", stairs: "low", elderlyFriendly: true, childFriendly: true,
    facilities: ["观察牌", "休息座椅", "自然任务点"], tags: ["nature", "family", "scenery"], nextSpotIds: ["moon-stream", "cloud-platform"], highlights: ["叶片观察", "季节性昆虫"]
  },
  {
    id: "cloud-platform", name: "云端观景台", shortName: "观景台", description: "视野开阔的山腰平台，晴天可见远处的河湾和农田。", recommendedStayMinutes: 30, difficulty: "moderate", stairs: "medium", elderlyFriendly: false, childFriendly: true,
    facilities: ["观景座椅", "望远镜", "语音讲解点"], tags: ["scenery", "photography"], nextSpotIds: ["pine-rest", "fern-observatory", "sunridge-garden", "visitor-hub"], highlights: ["河湾全景", "日落拍摄"]
  },
  {
    id: "sunridge-garden", name: "晴脊植物园", shortName: "植物园", description: "山脊上的小型植物园，按季节更换主题花境，是自然与摄影爱好者的高点。", recommendedStayMinutes: 35, difficulty: "challenging", stairs: "high", elderlyFriendly: false, childFriendly: false,
    facilities: ["植物标牌", "观景座椅", "洗手间"], tags: ["nature", "photography", "scenery"], nextSpotIds: ["cloud-platform", "visitor-hub"], highlights: ["季节花境", "山脊风景"]
  },
  {
    id: "visitor-hub", name: "林泉游客中心", shortName: "服务中心", description: "景区中部服务中心，提供咨询、失物招领、文创取货和人工求助。", recommendedStayMinutes: 20, difficulty: "easy", stairs: "none", elderlyFriendly: true, childFriendly: true,
    facilities: ["卫生间", "饮水", "医疗点", "文创取货", "人工服务"], tags: ["culture", "relaxation", "family"], nextSpotIds: ["dawn-gate", "cedar-boardwalk", "cloud-platform", "sunridge-garden"], highlights: ["补给与咨询", "文创取货"]
  },
];

export const scenicSpotMap = Object.fromEntries(scenicSpots.map((spot) => [spot.id, scenicSpotSchema.parse(spot)])) as Record<string, ScenicSpot>;
