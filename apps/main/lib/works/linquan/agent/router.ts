export type Intent = "location" | "set-location" | "route" | "events" | "nature" | "service" | "scenic" | "hours" | "transport" | "registration" | "pickup" | "assistance" | "greeting" | "unknown";

const locationNames: Record<string, string> = {
  "晨雾入口": "dawn-gate", "入口": "dawn-gate", "杉影木栈道": "cedar-boardwalk", "木栈道": "cedar-boardwalk", "月纹溪谷": "moon-stream", "溪谷": "moon-stream", "松风歇脚台": "pine-rest", "歇脚台": "pine-rest", "蕨影自然观察区": "fern-observatory", "观察区": "fern-observatory", "云端观景台": "cloud-platform", "观景台": "cloud-platform", "晴脊植物园": "sunridge-garden", "植物园": "sunridge-garden", "林泉游客中心": "visitor-hub", "游客中心": "visitor-hub",
};

export function detectLocationId(message: string) {
  return Object.entries(locationNames).find(([name]) => message.includes(name))?.[1];
}

export function detectIntent(message: string): Intent {
  const text = message.toLowerCase();
  if (detectLocationId(message) && /(到了|在|到达|当前位置|我在|我到|到[^，。！？!?]*了|arrive|at )/.test(text + message)) return "set-location";
  if (/(报名|参加|register|sign up|报名活动)/i.test(message)) return "registration";
  if (/(第[一二三123]个|适合.*(孩子|儿童)|孩子.*适合)/i.test(message)) return "events";
  if (/(取货|文创|pickup|collect|取货码|^[A-Za-z]{2}-\d{4}$)/i.test(message.trim())) return "pickup";
  if (/(人工求助|找工作人员|需要帮助|help me|staff assistance)/i.test(message)) return "assistance";
  if (/(厕所|卫生间|洗手间|出口|休息|饮水|急救|医疗|人工|服务点|restroom|toilet|exit|water|help)/i.test(message)) return "service";
  if (/(活动|演出|今天有什么|event|activity)/i.test(message)) return "events";
  if (/(自然任务|探索|观察|叶片|鸟|植物|nature|explore|leaf|bird)/i.test(message)) return "nature";
  if (/(路线|怎么走|下一站|伴游|规划|还有多久|route|where should|itinerary)/i.test(message)) return "route";
  if (/(开放|几点|营业|开门|关门|open|hours)/i.test(message)) return "hours";
  if (/(交通|怎么到|停车|公交|地铁|transport|parking)/i.test(message)) return "transport";
  if (/(我(?:现在)?在哪|我现在在哪里|当前位置|current location|where am i)/i.test(message)) return "location";
  if (/(成人|大人|儿童|孩子|长者|老人|体力|分钟|小时|台阶|山顶|来得及|下一站|route|路线)/i.test(message)) return "route";
  if (/(成人|大人|儿童|孩子|长者|老人|体力|分钟|小时|台阶|少走|route|路线)/i.test(message)) return "route";
  if (/^(你好|嗨|hello|hi|在吗)/i.test(message.trim())) return "greeting";
  return "scenic";
}

export function extractActivityId(message: string) {
  const match = message.match(/(晨光听鸟小组|溪谷小小观察员|云端落日速写)/);
  return match?.[1];
}

export const activityNameToId: Record<string, string> = { "晨光听鸟小组": "dawn-birdwalk", "溪谷小小观察员": "stream-lab", "云端落日速写": "sunset-sketch" };
