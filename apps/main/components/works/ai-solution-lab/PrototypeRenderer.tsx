"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { periods, products } from "@/content/projects/ai-solution-lab/catalog";
import {
  getStats,
  metricDatasets,
  type MetricRef,
} from "@/content/projects/ai-solution-lab/datasets";
import type {
  ComponentSpec,
  PrototypeSpec,
} from "@/lib/works/ai-solution-lab/schema";

type PreviewState = {
  period: keyof typeof periods;
  setPeriod: (v: keyof typeof periods) => void;
  goal: string;
  setGoal: (v: string) => void;
  budget: string;
  setBudget: (v: string) => void;
  material: string;
  setMaterial: (v: string) => void;
  document: string | null;
  setDocument: (v: string) => void;
};
const PreviewContext = createContext<PreviewState | null>(null);
function usePreview() {
  const state = useContext(PreviewContext);
  if (!state) throw new Error("Missing preview context");
  return state;
}
function Metrics({ spec }: { spec: ComponentSpec }) {
  const { period } = usePreview();
  const { data, dataset, total, change } = getStats(
    spec.dataRef as MetricRef,
    period,
  );
  return (
    <div className="lab-metrics">
      {[
        [
          dataset.metric,
          total.toLocaleString(),
          `${Number(change) > 0 ? "+" : ""}${change}% 较前一周`,
        ],
        [dataset.secondary, data.appointments.toLocaleString(), "示例汇总"],
        [dataset.money, `${(data.revenue / 10000).toFixed(0)} 万`, "示例汇总"],
      ].map(([label, value, note]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
          <small>{note}</small>
        </div>
      ))}
    </div>
  );
}
function Trend({ spec }: { spec: ComponentSpec }) {
  const { period } = usePreview();
  const { data, dataset } = getStats(spec.dataRef as MetricRef, period);
  const ceiling = Math.ceil((Math.max(...data.visits) * 1.2) / 10) * 10;
  const points = data.visits
    .map((v, i) => `${32 + i * 80},${180 - (v / ceiling) * 150}`)
    .join(" ");
  return (
    <figure className="lab-chart">
      <figcaption>
        <span>
          <i /> {dataset.metric}
        </span>
        <span>{data.label} · 演示数据</span>
      </figcaption>
      <svg
        viewBox="0 0 560 215"
        role="img"
        aria-label={`${data.label}${dataset.metric}：${data.visits.join("、")}${dataset.unit}`}
      >
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <line
              x1="30"
              x2="525"
              y1={30 + i * 75}
              y2={30 + i * 75}
              stroke="#e8ece8"
              strokeDasharray="4 5"
            />
            <text x="32" y={21 + i * 75} fill="#6d7772" fontSize="10">
              {Math.round(ceiling * (1 - i / 2))}
            </text>
          </g>
        ))}
        <polygon points={`32,180 ${points} 512,180`} fill="#ecf3ec" />
        <polyline
          points={points}
          fill="none"
          stroke="#47745a"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {data.visits.map((v, i) => (
          <g key={i}>
            <circle
              cx={32 + i * 80}
              cy={180 - (v / ceiling) * 150}
              r="4"
              fill="#fff"
              stroke="#47745a"
              strokeWidth="2"
            />
            <text
              x={32 + i * 80}
              y="205"
              textAnchor="middle"
              fill="#67716b"
              fontSize="11"
            >
              {data.labels[i]}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
function Records({ spec }: { spec: ComponentSpec }) {
  const { period } = usePreview();
  const { data, dataset } = getStats(spec.dataRef as MetricRef, period);
  return (
    <details className="lab-records">
      <summary>展开每日明细</summary>
      <table>
        <caption>{dataset.label}</caption>
        <thead>
          <tr>
            <th scope="col">日期</th>
            <th scope="col">{dataset.metric}</th>
          </tr>
        </thead>
        <tbody>
          {data.visits.map((v, i) => (
            <tr key={i}>
              <th scope="row">{data.labels[i]}</th>
              <td>{v.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
function Insight({ spec }: { spec: ComponentSpec }) {
  const { period } = usePreview();
  const [expanded, setExpanded] = useState(false);
  if (spec.capability === "recommendation")
    return (
      <p className="lab-note">
        原型按分类和预算筛选示例商品。真实产品可由 AI
        理解更细的偏好，商品信息仍应来自商场目录。
      </p>
    );
  if (spec.capability === "content_generation")
    return (
      <p className="lab-note">
        先确认活动目标，再用材料形成草稿；预算、权益和发布内容需由人员审核。
      </p>
    );
  const { total, change, dataset, minimum, minimumDay } = getStats(
    spec.dataRef as MetricRef,
    period,
  );
  return (
    <div className="lab-insight">
      <span className="lab-tag">规则观察 · 模拟解释</span>
      <p>
        {dataset.metric}较前一周{Number(change) < 0 ? "下降" : "增加"}{" "}
        {Math.abs(Number(change))}%，最低为{minimumDay}的 {minimum}{" "}
        {dataset.unit}。
      </p>
      <button
        className="lab-text-button"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? "收起依据 ↑" : "查看分析依据 ↗"}
      </button>
      {expanded && (
        <div className="lab-note">
          合计 {total.toLocaleString()} {dataset.unit}，较前一周变化 {change}
          %。这只能说明数据变化；排班、节假日或数据缺漏等可能原因仍需补充证据，不能直接推断因果。
        </div>
      )}
    </div>
  );
}
function Query({ spec }: { spec: ComponentSpec }) {
  const { period } = usePreview();
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  function ask(value: string) {
    const { data, dataset, total, change } = getStats(
      spec.dataRef as MetricRef,
      period,
    );
    setQuery(value);
    setAnswer(
      /总|多少|门诊|下降|异常|为什么/.test(value)
        ? `${data.label}示例${dataset.metric}为 ${total.toLocaleString()} ${dataset.unit}，较前一周变化 ${change}%。最低为${data.labels[data.visits.indexOf(Math.min(...data.visits))]}的 ${Math.min(...data.visits)} ${dataset.unit}。当前只能查看示例汇总，无法判断变化原因。`
        : "这个模拟问答只支持当前指标总量、最低值与周变化。试试“本周总量是多少？”；没有访问真实业务系统。",
    );
  }
  return (
    <div>
      <p className="lab-note">模拟问答 · 只查询当前示例数据</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(query);
        }}
        className="lab-query"
      >
        <input
          aria-label="询问示例数据"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={200}
          placeholder="本周总量是多少？"
          required
        />
        <button aria-label="发送示例问题" type="submit">
          ↑
        </button>
      </form>
      <button
        className="lab-text-button"
        onClick={() => ask("本周总量是多少？")}
      >
        试问：本周总量是多少？
      </button>
      {answer && (
        <p className="lab-note" role="status">
          {answer}
        </p>
      )}
    </div>
  );
}
function Recommendations({ spec }: { spec: ComponentSpec }) {
  const [category, setCategory] = useState("全部");
  const [price, setPrice] = useState("300");
  const [selected, setSelected] = useState("");
  const matches = products.filter(
    (p) =>
      (category === "全部" || p.category === category) &&
      p.price <= Number(price),
  );
  if (spec.capability === "guided_service")
    return (
      <div className="lab-store-list">
        {[...new Map(products.map((p) => [p.store, p])).values()].map((p) => (
          <details key={p.store}>
            <summary>
              {p.store} · {p.floor}
            </summary>
            <p>{p.detail}</p>
            <small>虚构店铺，非真实导航。</small>
          </details>
        ))}
      </div>
    );
  return (
    <div>
      <div className="lab-product-filters">
        <label>
          想找什么
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setSelected("");
            }}
          >
            <option>全部</option>
            <option>礼物</option>
            <option>生活</option>
          </select>
        </label>
        <label>
          预算上限
          <select
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
              setSelected("");
            }}
          >
            <option value="150">150 元</option>
            <option value="200">200 元</option>
            <option value="300">300 元</option>
          </select>
        </label>
      </div>
      <div className="lab-products">
        {matches.map((p) => (
          <article key={p.id}>
            <div
              className={`lab-product-art lab-product-art--${p.id}`}
              aria-hidden="true"
            >
              {p.id === "tea"
                ? "茶"
                : p.id === "lamp"
                  ? "光"
                  : p.id === "cup"
                    ? "日"
                    : "木"}
            </div>
            <span className="lab-note">
              {p.category} / {p.store}
            </span>
            <h4>{p.name}</h4>
            <p>{p.note}</p>
            <div className="lab-row">
              <strong>¥{p.price}</strong>
              <button
                className="lab-text-button"
                aria-expanded={selected === p.id}
                onClick={() => setSelected(selected === p.id ? "" : p.id)}
              >
                店铺信息 ↗
              </button>
            </div>
            {selected === p.id && (
              <div className="lab-note" role="status">
                <strong>{p.floor}</strong>
                <p>{p.detail}</p>
                <small>虚构店铺，仅演示信息结构；不提供真实导航。</small>
              </div>
            )}
          </article>
        ))}
      </div>
      {!matches.length && (
        <p role="status">当前预算下没有匹配的示例商品，请调整条件。</p>
      )}
    </div>
  );
}
function BriefForm() {
  const state = usePreview();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const budget = Number(state.budget);
        state.setDocument(
          `活动主题：${state.goal === "老客复购" ? "熟悉的好物，再次相见" : "第一次相遇的小惊喜"}\n\n目标：${state.goal}。\n参考材料：${state.material}。\n预算上限：${budget.toLocaleString()} 元（演示参数）。\n\n建议流程\n1. 选择一组符合目标的商品，核对库存和活动权益。\n2. 面向${state.goal === "老客复购" ? "曾购买相关商品的老客户" : "首次了解品牌的访客"}准备活动说明，由运营审核后触达。\n3. 记录参与人数与实际订单，活动结束后复盘。\n\n审核清单\n确认预算、权益、触达范围与衡量口径。当前草稿不承诺销量、转化率或投资回报。`,
        );
      }}
      className="lab-campaign-form"
    >
      <label>
        示例材料
        <select
          value={state.material}
          onChange={(e) => state.setMaterial(e.target.value)}
        >
          <option>春季会员活动复盘摘要</option>
          <option>新品体验活动复盘摘要</option>
        </select>
      </label>
      <div className="lab-file">
        ▤{" "}
        <div>
          <strong>{state.material}</strong>
          <small>演示材料 · 无需上传文件</small>
        </div>
      </div>
      <label>
        这次优先关注
        <select
          value={state.goal}
          onChange={(e) => state.setGoal(e.target.value)}
        >
          <option>老客复购</option>
          <option>新客体验</option>
        </select>
      </label>
      <label>
        预算上限（元）
        <input
          type="number"
          min="100"
          max="1000000"
          step="100"
          value={state.budget}
          onChange={(e) => state.setBudget(e.target.value)}
          required
        />
      </label>
      <button className="lab-button" type="submit">
        生成示例草稿 <span>↗</span>
      </button>
      <p className="lab-note">
        按钮演示材料 → 参数 → 草稿的流程，不调用业务系统。
      </p>
    </form>
  );
}
function Document() {
  const { document, setDocument } = usePreview();
  return document !== null ? (
    <div className="lab-document">
      <span className="lab-tag">模拟生成 · 可直接修改</span>
      <textarea
        aria-label="活动方案草稿"
        value={document}
        onChange={(e) => setDocument(e.target.value)}
        maxLength={5000}
      />
      <p className="lab-note">修改仅保留在当前预览中。</p>
    </div>
  ) : (
    <div className="lab-document-empty">
      <span aria-hidden="true">▤</span>
      <h4>让想法有一个起稿点</h4>
      <p>选择材料和活动目标，生成后在这里继续修改。</p>
    </div>
  );
}
const componentRegistry = {
  Metrics,
  Trend,
  Records,
  Insight,
  Query,
  Recommendations,
  BriefForm,
  Document,
};
const templateRegistry: Record<
  PrototypeSpec["pages"][number]["template"],
  (props: { children: ReactNode }) => ReactNode
> = {
  analytics_workspace: ({ children }) => (
    <div className="lab-template lab-template--analytics">{children}</div>
  ),
  guided_service: ({ children }) => (
    <div className="lab-template lab-template--guide">{children}</div>
  ),
  ai_workspace: ({ children }) => (
    <div className="lab-template lab-template--workspace">{children}</div>
  ),
};
export function PrototypeRenderer({
  spec,
  highlight,
  pageId,
  onPageChange,
}: {
  spec: PrototypeSpec;
  highlight: { capability: string; revision: number };
  pageId: string;
  onPageChange: (id: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!highlight.capability) return;
    const element = rootRef.current?.querySelector<HTMLElement>(
      `[data-capability="${highlight.capability}"]`,
    );
    element?.scrollIntoView({ behavior: "instant", block: "center" });
    element?.focus({ preventScroll: true });
  }, [highlight, pageId]);
  const [period, setPeriod] = useState<keyof typeof periods>("week");
  const [goal, setGoal] = useState("老客复购");
  const [budget, setBudget] = useState("10000");
  const [material, setMaterial] = useState("春季会员活动复盘摘要");
  const [document, setDocument] = useState<string | null>(null);
  const page = spec.pages.find((p) => p.id === pageId) ?? spec.pages[0];
  const Template = templateRegistry[page.template];
  return (
    <PreviewContext.Provider
      value={{
        period,
        setPeriod,
        goal,
        setGoal,
        budget,
        setBudget,
        material,
        setMaterial,
        document,
        setDocument,
      }}
    >
      <div ref={rootRef} className="lab-preview">
        <div className="lab-preview-chrome">
          <span>
            <i />
            <i />
            <i />
          </span>
          <small>产品草稿 / 交互预览</small>
          <span className="lab-tag">演示数据</span>
        </div>
        <header className="lab-preview-header">
          <div>
            <span className="lab-overline">PROTOTYPE</span>
            <h3>{spec.appTitle}</h3>
          </div>
          {page.template === "analytics_workspace" && (
            <select
              aria-label="查看时间"
              value={period}
              onChange={(e) =>
                setPeriod(e.target.value as keyof typeof periods)
              }
            >
              <option value="week">本周</option>
              <option value="previous">上周</option>
            </select>
          )}
        </header>
        {spec.pages.length > 1 && (
          <nav className="lab-preview-tabs" aria-label="原型页面">
            {spec.pages.map((p) => (
              <button
                key={p.id}
                aria-current={p.id === page.id ? "page" : undefined}
                onClick={() => onPageChange(p.id)}
              >
                {p.title}
              </button>
            ))}
          </nav>
        )}
        <p className="lab-preview-data-note">
          {page.template === "analytics_workspace"
            ? metricDatasets[
                page.sections[0].components[0].dataRef as MetricRef
              ].label
            : page.template === "guided_service"
              ? "商品与店铺均为虚构示例，不代表你的业务目录。"
              : "预置活动材料与流程示例，不代表真实营销效果。"}
        </p>
        <Template>
          {page.sections.map((section) => (
            <section
              key={section.slot}
              className={`lab-slot lab-slot--${section.slot}`}
            >
              {section.components.map((c) => {
                const Component = componentRegistry[c.type];
                return (
                  <section
                    tabIndex={-1}
                    id={`prototype-${c.id}`}
                    key={c.id}
                    data-capability={c.capability}
                    className={`lab-module ${highlight.capability === c.capability ? "lab-module--highlight" : ""}`}
                  >
                    <h4 className="lab-module-title">{c.title}</h4>
                    <Component key={`${c.id}-${period}`} spec={c} />
                  </section>
                );
              })}
            </section>
          ))}
        </Template>
        <footer className="lab-preview-footer">
          此处操作仅用于讨论产品流程，不连接真实业务系统。
        </footer>
      </div>
    </PreviewContext.Provider>
  );
}
