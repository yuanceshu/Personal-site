import type { Brief, CapabilityId } from "@/lib/works/ai-solution-lab/schema";

export const capabilities: Record<
  CapabilityId,
  {
    name: string;
    approach: string;
    ai: boolean;
    llm: string;
    system: string;
    scenario: Brief["scenario"];
  }
> = {
  monitoring_dashboard: {
    name: "经营指标展示",
    approach: "确定性程序",
    ai: false,
    llm: "无需模型参与",
    system: "按统一口径查询、计算并展示指标；权限在服务端校验。",
    scenario: "analytics",
  },
  data_analysis: {
    name: "异常识别与解释",
    approach: "规则计算 + AI 解释",
    ai: true,
    llm: "解释已计算的异常，区分变化现象与待验证原因。",
    system: "计算趋势与异常，不把模型推测作为因果结论。",
    scenario: "analytics",
  },
  data_query: {
    name: "自然语言问数",
    approach: "AI + 查询工具",
    ai: true,
    llm: "理解问题与查询条件，组织返回结果。",
    system: "执行受限查询，检查权限与指标口径。",
    scenario: "analytics",
  },
  recommendation: {
    name: "偏好理解与推荐",
    approach: "AI + 商品筛选",
    ai: true,
    llm: "理解偏好并解释匹配理由。",
    system: "筛选真实商品及价格、库存，限制可推荐范围。",
    scenario: "retail",
  },
  guided_service: {
    name: "店铺信息与到店指引",
    approach: "确定性程序",
    ai: false,
    llm: "无需模型决定店铺位置",
    system: "读取店铺目录、楼层与营业信息。",
    scenario: "retail",
  },
  content_generation: {
    name: "营销活动草稿",
    approach: "AI + 人工审核",
    ai: true,
    llm: "按目标和材料组织活动草稿，不承诺转化效果。",
    system: "管理材料、参数和版本；预算计算与发布由确定性流程处理。",
    scenario: "marketing",
  },
};

export const examples: {
  id: Exclude<Brief["scenario"], "unsupported">;
  label: string;
  subtitle: string;
  input: string;
  brief: Brief;
}[] = [
  {
    id: "analytics",
    label: "经营分析",
    subtitle: "从分散的指标，到有依据的判断",
    input:
      "医院管理人员希望统一查看门诊量、预约量和缴费金额。目前有 HIS、预约和缴费系统，可以每日导出汇总数据。希望按周查看趋势、发现异常，并用自然语言查询；暂不需要实时数据或患者明细。",
    brief: {
      scenario: "analytics",
      industry: "healthcare",
      aiPreference: "allowed",
      clarifications: [],
      title: "医院经营分析工作台",
      users: "医院管理人员",
      problem: "经营数据分散，需要手工汇总后才能发现变化。",
      goal: "按周查看经营趋势、识别异常，并用自然语言查询。",
      conditions:
        "已有 HIS、预约和缴费系统；每日导出汇总数据；不查询患者明细。",
      assumptions: ["暂按各系统指标口径可统一设计，实际落地前仍需核对。"],
      questions: [],
      limitation: "",
    },
  },
  {
    id: "retail",
    label: "消费者导购",
    subtitle: "让一个购物想法，找到合适的去处",
    input:
      "商场顾客想按预算和购物偏好找到商品与店铺。我们已有商品目录、价格和店铺楼层数据，希望提供推荐理由和到店信息，第一版不做实时库存、支付或地图导航。",
    brief: {
      scenario: "retail",
      industry: "retail",
      aiPreference: "allowed",
      clarifications: [],
      title: "商场购物向导",
      users: "到店购物的消费者",
      problem: "顾客不熟悉商品和店铺，需要反复查找。",
      goal: "按偏好和预算找商品，并查看对应店铺。",
      conditions: "已有商品目录、价格与店铺楼层；不做实时库存和支付。",
      assumptions: ["目录内容需要由商场维护，原型只使用虚构示例店铺。"],
      questions: [],
      limitation: "",
    },
  },
  {
    id: "marketing",
    label: "营销策划",
    subtitle: "把目标和材料，整理成活动草稿",
    input:
      "营销人员希望根据历史活动复盘设计下一期活动。已有整理好的活动摘要，想选择活动目标、填写预算并生成可修改的方案草稿，由人员审核后执行，暂不连接广告平台。",
    brief: {
      scenario: "marketing",
      industry: "general",
      aiPreference: "allowed",
      clarifications: [],
      title: "营销活动共创台",
      users: "营销运营人员",
      problem: "整理历史材料、编写下一期方案耗费时间。",
      goal: "根据材料与目标生成可修改的活动草稿，交由人员审核。",
      conditions: "已有活动复盘摘要；人工审核后执行；不连接广告平台。",
      assumptions: ["历史复盘仅作为参考，不能据此承诺下一期效果。"],
      questions: [],
      limitation: "",
    },
  },
];

// All datasets are invented for interaction demonstrations, never customer records.
export const periods = {
  week: {
    label: "本周",
    visits: [1900, 1650, 1600, 1780, 1870, 1950, 1700],
    previous: 13562,
    appointments: 8320,
    revenue: 3260000,
    labels: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
  },
  previous: {
    label: "上周",
    visits: [2010, 1930, 1820, 1980, 1950, 1990, 1882],
    previous: 13200,
    appointments: 8030,
    revenue: 3330000,
    labels: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
  },
};
export const products = [
  {
    id: "tea",
    name: "山间茶礼",
    category: "礼物",
    price: 168,
    store: "茶间",
    floor: "2F · 东侧连廊",
    detail: "从东侧扶梯到 2 楼，沿连廊查看店铺标识。",
    note: "适合偏好茶饮的收礼人",
  },
  {
    id: "lamp",
    name: "暖光阅读灯",
    category: "生活",
    price: 249,
    store: "日常好物",
    floor: "3F · 中庭旁",
    detail: "乘中庭扶梯到 3 楼，店铺位于服务台对面。",
    note: "适合阅读与居家场景",
  },
  {
    id: "cup",
    name: "随行保温杯",
    category: "生活",
    price: 129,
    store: "日常好物",
    floor: "3F · 中庭旁",
    detail: "乘中庭扶梯到 3 楼，店铺位于服务台对面。",
    note: "适合日常通勤",
  },
  {
    id: "scent",
    name: "木质香氛",
    category: "礼物",
    price: 299,
    store: "气味手记",
    floor: "1F · 西侧入口",
    detail: "从西侧入口进入 1 楼，沿店铺标识前往。",
    note: "适合喜欢木质气味的人",
  },
];
