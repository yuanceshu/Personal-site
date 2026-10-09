import { demos, type DemoCollection } from "@/content/projects/demos/catalog";

type CollectionDemo = {
  id: string;
  title: string;
  href: string;
  collection: DemoCollection;
  featuresLabel: string;
  entryLabel: string;
};

const existingIds = ["island-travel", "finance-assistant", "linquan", "qintai-ticketing", "medical-ai", "restaurant-ai"];
const heating = demos.find((demo) => demo.id === "heating")!;

// 展示口径和顺序仅用于合集页，不改变共享目录中的作品信息。
export const collectionDemos: readonly CollectionDemo[] = [
  {
    id: heating.id,
    href: heating.href,
    title: "通用AI缴费助手",
    collection: {
      category: "咨询&缴费",
      description: "从业务咨询到费用查询，再到材料提交与缴费。通用场景，多行业适配。",
      features: ["业务政策咨询", "办理对象选择", "费用查询与模拟缴费", "支付记录与模拟发票", "材料提交与补件", "办理进度查询"],
      image: "/projects/demos/collection/mobile-payment.png",
    },
    featuresLabel: "可体验功能",
    entryLabel: "进入 Demo",
  },
  ...existingIds.map((id) => {
    const demo = demos.find((item) => item.id === id)!;
    return {
      id: demo.id,
      title: demo.title,
      href: demo.href,
      collection: demo.collection,
      featuresLabel: "可体验功能",
      entryLabel: "进入 Demo",
    };
  }),
  {
    id: "special-fund-supervision",
    href: "/works/demos/special-fund-supervision",
    title: "专项资金监管 · AI 政务助手（建设中）",
    collection: {
      category: "政务",
      description: "围绕专项资金申报、材料审核与绩效跟踪，探索 AI 如何辅助监管判断。",
      features: ["项目总览", "申报材料审核", "政策规则查询", "跨来源数据核验", "补贴测算", "绩效跟踪"],
      image: "/projects/demos/collection/government-service.png",
    },
    featuresLabel: "建设内容",
    entryLabel: "预览 Demo",
  },
];
