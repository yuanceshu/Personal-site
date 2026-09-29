import type { ServicePoint } from "@/lib/works/linquan/types";
import { servicePointSchema } from "@/lib/works/linquan/schemas/domain";

export const servicePoints: ServicePoint[] = [
  { id: "restroom-gate", name: "入口卫生间", type: "restroom", spotId: "dawn-gate", distanceMinutes: 2, description: "靠近集合广场，设有无障碍厕位和母婴台。", openHours: "08:00–18:00" },
  { id: "restroom-stream", name: "溪谷卫生间", type: "restroom", spotId: "moon-stream", distanceMinutes: 3, description: "位于溪谷观察台上方，沿木牌指引即可到达。", openHours: "08:30–17:30" },
  { id: "restroom-hub", name: "游客中心卫生间", type: "restroom", spotId: "visitor-hub", distanceMinutes: 1, description: "游客中心东侧，距离服务台最近。", openHours: "08:00–18:00" },
  { id: "rest-pine", name: "松风歇脚台", type: "rest", spotId: "pine-rest", distanceMinutes: 0, description: "有遮阴长椅和饮水点，适合调整节奏。", openHours: "全天" },
  { id: "water-boardwalk", name: "木栈道补水点", type: "water", spotId: "cedar-boardwalk", distanceMinutes: 1, description: "可补充直饮水，也可在服务牌扫码查看路线。", openHours: "08:00–18:00" },
  { id: "medical-hub", name: "游客中心急救点", type: "medical", spotId: "visitor-hub", distanceMinutes: 1, description: "配备基础急救用品，紧急情况请联系工作人员。", openHours: "08:00–18:00" },
  { id: "staff-hub", name: "人工服务台", type: "staff", spotId: "visitor-hub", distanceMinutes: 0, description: "可办理文创取货、失物登记和人工求助。", openHours: "08:00–18:00" },
];

export const servicePointMap = Object.fromEntries(servicePoints.map((service) => [service.id, servicePointSchema.parse(service)])) as Record<string, ServicePoint>;
