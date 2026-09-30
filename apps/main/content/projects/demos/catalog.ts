export type DemoFeatureGroup = {
  label: string;
  items: readonly string[];
};

export type DemoCollection = {
  category: string;
  description: string;
  features: readonly string[];
  image: string;
};

export const demos = [{
  id: "island-travel",
  title: "岛见 · 智能出行",
  subtitle: "一句出发，走完一段行程。",
  description: "从一句自然语言，到选班次、确认乘车人和模拟出票。体验 AI 理解与明确确认之间的衔接。",
  tags: ["交通出行", "对话式服务", "模拟交易"],
  href: "/works/demos/island-travel",
  audience: "准备出发的旅客",
  collection: { category: "出行", description: "用自然语言发起需求，全程处理行程规划、改签与票务问题。", features: ["自然语言规划行程", "班次与人数筛选", "确认行程并模拟出票", "行程状态与提醒", "退票、改签与开票试算", "接驳产品与客服工单"], image: "/projects/demos/collection/island-travel.jpg" },
  cover: { label: "岛见", sub: "班次、行程与旅途服务 · 虚构演示", line: "去见一面。也见一座岛。", note: "AI 创作示意 · 非真实线路照片", theme: "island" },
  featureGroups: [{ label: "出发与购票", items: ["自然语言找行程", "班次、日期与人数筛选", "确认行程并模拟出票"] }, { label: "出票后", items: ["行程状态与演示凭证", "退票、改签与开票试算", "接驳产品、客服工单与出发提醒"] }],
}, {
  id: "finance-assistant",
  title: "云川财务智能体",
  subtitle: "把复杂的数据问题，变成清楚的答案。",
  description: "从经营指标、期间变化到渠道对账与异常监测，确定性 Finance Tool 保留每一笔数字的来源，Agent 负责把问题带到正确结果。",
  tags: ["财务分析", "Tool Agent", "虚构演示"],
  href: "/works/demos/finance-assistant",
  audience: "集团财务与经营负责人",
  collection: { category: "财务", description: "从经营问题出发，自动追溯数据来源、分析波动并给出判断。", features: ["经营总览与销售趋势", "公司和渠道拆解", "变化原因与经营报告", "渠道对账明细追踪", "异常监测与关注等级", "可追溯的自然语言查询"], image: "/projects/demos/collection/finance-assistant.jpg" },
  cover: { label: "云川财务", sub: "经营分析、对账与异常 · 虚构集团", line: "把复杂的数据问题，变成清楚的答案。", note: "虚构财务数据 · 无真实系统连接", theme: "finance" },
  featureGroups: [{ label: "经营分析", items: ["经营总览与销售趋势", "环比、同比、公司与渠道拆解", "变化原因与经营报告"] }, { label: "风险与核对", items: ["渠道对账概览与明细追踪", "异常监测与关注等级", "自然语言查询与可追溯结果卡片"] }],
}, {
  id: "linquan",
  title: "林泉 · 智能伴游",
  subtitle: "先看脚下，再决定下一站。",
  description: "景区里的位置、同行者、时间和兴趣会持续被承接，路线、服务、活动与自然探索都从当前现场继续展开。",
  tags: ["景区服务", "路线规划", "现场伴游"],
  href: "/works/demos/linquan",
  audience: "正在游园的个人与家庭",
  collection: { category: "景区", description: "基于位置、时间与同行者，智能规划下一步游览路线。", features: ["更新当前位置与游览状态", "按兴趣规划游览路线", "计算步行与安全返程", "景点与活动问答", "厕所、休息与交通查询", "现场服务与人工求助"], image: "/projects/demos/collection/linquan.jpg" },
  cover: { label: "林泉", sub: "位置、路线与现场服务 · 虚构景区", line: "先看脚下，再决定下一站。", note: "虚构景区资料 · 无 GPS 或真实业务连接", theme: "linquan" },
  featureGroups: [{ label: "游览规划", items: ["更新当前位置与游览状态", "按同行者、时间和兴趣规划路线", "计算步行、停留与安全返程"] }, { label: "现场向导", items: ["景点、活动与自然探索问答", "厕所、休息、饮水和交通查询", "活动报名、文创取货与人工求助"] }],
}, {
  id: "qintai-ticketing",
  title: "琴台票务 · 武汉演出票务",
  subtitle: "把价格和余量，说清楚。",
  description: "从演出检索、锁座与候补回流，到运营台的改价补货待审批。价格、费用与库存口径在两条侧线上保持一致。",
  tags: ["现场演出", "票务库存", "双端 Agent"],
  href: "/works/demos/qintai-ticketing",
  audience: "演出观众与票务运营人员",
  collection: { category: "票务", description: "演出、票档、库存与锁座全流程透明，一键完成购票。", features: ["演出、场馆与票档筛选", "费用拆分与座位示意", "锁座、候补与票夹", "库存提醒与销售进度", "价格与补货待审批", "助手解释规则与分析场次"], image: "/projects/demos/collection/qintai-ticketing.jpg" },
  cover: { label: "琴台票务", sub: "演出、票档与锁座 · 虚构库存数据", line: "把价格和余量，说清楚。", note: "演出与票价来自公开资料 · 库存与交易为模拟", theme: "qintai" },
  featureGroups: [{ label: "观众侧", items: ["演出、场馆、价格与张数筛选", "票档比较、费用拆分与座位示意", "锁座、候补、回流领取与票夹"] }, { label: "运营侧", items: ["库存提醒与销售进度", "价格、补货和待审批改动", "助手解释规则与分析场次"] }],
}, {
  id: "medical-ai",
  title: "明川医院 · AI 就医助手",
  subtitle: "从症状开始，陪你走完一次就医旅程。",
  description: "把症状采集、挂号、院内路线、检查缴费、排队和报告解释放进一条持续理解状态的就医流程。",
  tags: ["医疗行业", "就医旅程", "Safety + Tools"],
  href: "/works/demos/medical-ai",
  audience: "需要就医流程辅助的患者",
  collection: { category: "医疗", description: "从症状问询开始，全程引导挂号、就诊、检查与报告解读。", features: ["症状采集与方向建议", "医生、号源与挂号", "到院与院内路线", "检查缴费与排队状态", "报告查询与只读 AI 解读", "安全提醒与动作确认"], image: "/projects/demos/collection/medical-ai.jpg" },
  cover: { label: "明川医院", sub: "就医旅程、检查与报告 · 虚构医院", line: "把复杂的就医流程，交给一个懂你的助手。", note: "虚构医院资料 · 不连接真实医疗系统", theme: "medical" },
  featureGroups: [{ label: "就诊流程", items: ["症状采集与就医方向建议", "医生、号源与挂号确认", "到院、院内路线与就医阶段推进"] }, { label: "检查与安全", items: ["检查缴费与排队状态", "报告查询与只读 AI 解读", "Safety 提醒与明确的动作确认"] }],
}, {
  id: "restaurant-ai",
  title: "食智助手 · 餐饮 Agent 工作台",
  subtitle: "让餐饮服务继续往前走。",
  description: "三个餐饮 Agent 分别为顾客、运营和财务查阅演示资料、解释数据并准备待确认草案。",
  tags: ["餐饮行业", "Agent 工作流", "虚构演示"],
  href: "/works/demos/restaurant-ai",
  audience: "餐饮顾客、门店运营与财务",
  collection: { category: "餐饮", description: "顾客、运营、财务共用一套数据，流程自动衔接推进。", features: ["顾客菜单、桌位与预订", "运营经营快照与库存", "财务对账差额与复核", "查看工具进度与来源", "继续追问具体问题", "生成待确认工作草案"], image: "/projects/demos/collection/restaurant-ai.jpg" },
  cover: { label: "食智助手", sub: "顾客、运营与财务 · 虚构演示", line: "让数据、判断与操作有据可依。", note: "虚拟知识库 · 无外部业务连接", theme: "restaurant" },
  featureGroups: [{ label: "三种角色", items: ["顾客菜单、桌位与预订草案", "运营经营快照、库存与制度", "财务对账差额与复核清单"] }, { label: "工作方式", items: ["查看工具进度与来源", "继续追问具体问题", "确认只保存在当前页面的草案"] }],
}] as const;
