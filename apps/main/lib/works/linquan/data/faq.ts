import type { FAQ } from "@/lib/works/linquan/types";
import { faqSchema } from "@/lib/works/linquan/schemas/domain";

export const faqs: FAQ[] = [
  { id: "opening", question: "景区几点开放？", answer: "景区每日 08:00–18:00 开放，17:20 后不建议前往山脊区域，请为返程预留时间。", tags: ["开放时间", "营业时间"] },
  { id: "transport", question: "怎么到景区？", answer: "自驾可导航至“晨雾入口”停车区；公共交通在林泉站下车后步行约 8 分钟到入口。", tags: ["交通", "到达"] },
  { id: "stairs", question: "有适合长者的路线吗？", answer: "可以。优先选择杉影木栈道、松风歇脚台和游客中心，避开月纹溪谷与晴脊植物园的中高台阶段。", tags: ["老人", "长者", "台阶"] },
  { id: "language", question: "Can I ask in English?", answer: "Yes. You can ask questions in English, and I will keep the answer concise and connected to your current location.", tags: ["English", "多语言"] },
];

export const faqMap = Object.fromEntries(faqs.map((faq) => [faq.id, faqSchema.parse(faq)])) as Record<string, FAQ>;
