"use client";

import { useEffect, useRef, useState } from "react";
import {
  capabilities,
  examples,
} from "@/content/projects/ai-solution-lab/catalog";
import {
  briefSchema,
  diagnosisSchema,
  type Brief,
  type Diagnosis,
  type PrototypeSpec,
  type LabRequest,
  type CapabilityId,
} from "@/lib/works/ai-solution-lab/schema";
import {
  buildPrototype,
  diagnoseExample,
  validateDiagnosis,
  validatePrototype,
} from "@/lib/works/ai-solution-lab/planner";
import { PrototypeRenderer } from "./PrototypeRenderer";

type Result = {
  id: number;
  input: string;
  brief: Brief;
  diagnosis: Diagnosis;
  prototype: PrototypeSpec;
  mode: "example" | "live" | "fallback";
};
const steps = ["描述问题", "确认理解", "方案与原型"] as const;
const failureMessage = "这次没有得到可用结果。输入与上一版已保留，请重试。";

function ActivityPanel({
  message,
  onCancel,
}: {
  message: string;
  onCancel: () => void;
}) {
  const isAnalyzing = message.includes("梳理");
  const activeStage = message.includes("组合") ? 1 : 0;
  const stages = isAnalyzing ? ["理解需求"] : ["判断能力", "组合草稿"];
  return (
    <div className="lab-activity" role="status" aria-live="polite">
      <span className="lab-activity-pulse" aria-hidden="true" />
      <div className="lab-activity-copy">
        <strong>{message}</strong>
        <span>
          {stages.map((stage, index) => (
            <span
              className={index === activeStage ? "is-active" : ""}
              key={stage}
            >
              {stage}
              {index < stages.length - 1 && <i aria-hidden="true">→</i>}
            </span>
          ))}
        </span>
      </div>
      <button className="lab-text-button" type="button" onClick={onCancel}>
        取消
      </button>
    </div>
  );
}

function ErrorPanel({
  message,
  action,
  onRetry,
}: {
  message: string;
  action: string;
  onRetry: () => void;
}) {
  return (
    <div className="lab-error" role="alert">
      <span className="lab-feedback-icon" aria-hidden="true">
        !
      </span>
      <div>
        <strong>暂时没有完成</strong>
        <p>{message}</p>
      </div>
      <button className="lab-secondary" type="button" onClick={onRetry}>
        {action}
      </button>
    </div>
  );
}

function NoticePanel({ message }: { message: string }) {
  return (
    <p role="status" className="lab-notice">
      <span aria-hidden="true">✓</span>
      {message}
    </p>
  );
}

async function requestStage(payload: LabRequest, signal: AbortSignal) {
  signal.throwIfAborted();
  if (payload.stage === "analyze") throw new Error("冻结快照不调用 AI。请在下方选择经营分析、消费者导购或营销策划示例，再体验理解修正与原型调整。");
  if (payload.stage === "diagnose") return { stage: "diagnose" as const, data: diagnoseExample(payload.brief, payload.selectedCapabilities), mode: "example" as const };
  return { stage: "plan" as const, data: buildPrototype(payload.brief, payload.diagnosis), mode: "example" as const };
}
export function SolutionLab() {
  const [step, setStep] = useState<"input" | "brief" | "result">("input");
  const [input, setInput] = useState("");
  const [exampleId, setExampleId] = useState("");
  const [assumptionsText, setAssumptionsText] = useState("");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [previous, setPrevious] = useState<Result | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [highlight, setHighlight] = useState({ capability: "", revision: 0 });
  const [pageId, setPageId] = useState("");
  const [selected, setSelected] = useState<CapabilityId[]>([]);
  const [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const version = useRef(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const planRef = useRef<HTMLElement>(null);
  const prototypeRef = useRef<HTMLDivElement>(null);
  const activeStep = ["input", "brief", "result"].indexOf(step);
  useEffect(() => {
    titleRef.current?.focus();
  }, [step]);
  useEffect(
    () => () => {
      sequence.current++;
      controller.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 7000);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  function begin(message: string) {
    controller.current?.abort();
    const id = ++sequence.current;
    const current = new AbortController();
    controller.current = current;
    setError("");
    setBusy(message);
    return { id, signal: current.signal };
  }
  function cancel() {
    sequence.current++;
    controller.current?.abort();
    setBusy("");
    setNotice("已取消本次操作，已有内容保留。");
  }
  function updateBrief(patch: Partial<Brief>) {
    if (!brief) return;
    setBrief({ ...brief, ...patch });
    setExampleId("");
    if (patch.scenario) setSelected([]);
    if (patch.aiPreference === "none")
      setSelected((ids) => ids.filter((id) => id !== "data_query"));
  }
  async function analyze() {
    const run = begin("正在梳理你的需求…");
    try {
      const example = examples.find(
        (e) => e.id === exampleId && e.input === input,
      );
      let next: Brief;
      if (example) next = briefSchema.parse(example.brief);
      else {
        const response = await requestStage(
          { stage: "analyze", input },
          run.signal,
        );
        if (response.stage !== "analyze") throw new Error(failureMessage);
        next = response.data;
      }
      if (sequence.current !== run.id || run.signal.aborted) return;
      setExampleId(example ? example.id : "");
      setBrief(next);
      setAssumptionsText(next.assumptions.join("\n"));
      setAnswers(next.questions.map(() => ""));
      setSelected([]);
      setStep("brief");
      setNotice("");
    } catch (e) {
      if (sequence.current === run.id && !run.signal.aborted)
        setError(e instanceof Error ? e.message : failureMessage);
    } finally {
      if (sequence.current === run.id) setBusy("");
    }
  }
  async function generate() {
    if (!brief) return;
    const checked = briefSchema.safeParse({
      ...brief,
      assumptions: assumptionsText.split("\n").filter((s) => s.trim()),
      clarifications: brief.questions.length
        ? brief.questions.map((question, i) => ({
            question,
            answer: answers[i]?.trim() || "暂不清楚",
          }))
        : brief.clarifications,
      questions: [],
    });
    if (!checked.success) {
      setError("请检查名称、必填内容与字数限制。假设最多6条，每条600字以内。");
      return;
    }
    const finalBrief = checked.data;
    const run = begin("正在判断能力与实现边界…");
    try {
      let diagnosis: Diagnosis;
      if (exampleId) diagnosis = diagnoseExample(finalBrief, selected);
      else {
        const response = await requestStage(
          {
            stage: "diagnose",
            brief: finalBrief,
            selectedCapabilities: selected,
          },
          run.signal,
        );
        if (response.stage !== "diagnose") throw new Error(failureMessage);
        diagnosis = response.data;
      }
      if (sequence.current !== run.id || run.signal.aborted) return;
      validateDiagnosis(finalBrief, diagnosisSchema.parse(diagnosis), selected);
      setBusy("正在组合产品草稿…");
      let prototype: PrototypeSpec;
      let mode: Result["mode"] = exampleId ? "example" : "live";
      if (exampleId) prototype = buildPrototype(finalBrief, diagnosis);
      else {
        const response = await requestStage(
          { stage: "plan", brief: finalBrief, diagnosis },
          run.signal,
        );
        if (response.stage !== "plan") throw new Error(failureMessage);
        prototype = validatePrototype(finalBrief, diagnosis, response.data);
        mode = response.mode;
      }
      if (sequence.current !== run.id || run.signal.aborted) return;
      const isUpdate = Boolean(result);
      if (result) setPrevious(result);
      const nextVersion = ++version.current;
      setResult({
        id: nextVersion,
        input,
        brief: finalBrief,
        diagnosis,
        prototype,
        mode,
      });
      setBrief(finalBrief);
      setHighlight({ capability: "", revision: 0 });
      setPageId(prototype.pages[0].id);
      setStep("result");
      setNotice(
        isUpdate
          ? `版本 ${nextVersion} 已生成，上一版仍然保留。`
          : `版本 ${nextVersion} 已生成。`,
      );
    } catch (e) {
      if (sequence.current === run.id && !run.signal.aborted)
        setError(e instanceof Error ? e.message : failureMessage);
    } finally {
      if (sequence.current === run.id) setBusy("");
    }
  }
  function edit() {
    if (!result) return;
    setInput(result.input);
    setBrief(result.brief);
    setAssumptionsText(result.brief.assumptions.join("\n"));
    setAnswers([]);
    setSelected(result.diagnosis.capabilities.map((c) => c.id));
    setExampleId(result.mode === "example" ? result.brief.scenario : "");
    setStep("brief");
    setError("");
  }
  function showCapability(id: string) {
    const page = result?.prototype.pages.find((p) =>
      p.sections.some((s) => s.components.some((c) => c.capability === id)),
    );
    if (page) setPageId(page.id);
    setHighlight((h) => ({ capability: id, revision: h.revision + 1 }));
  }
  function chooseExample(id: string) {
    const example = examples.find((e) => e.id === id)!;
    setInput(example.input);
    setExampleId(id);
    setError("");
  }
  function startOver() {
    setStep("input");
    setError("");
    setNotice("");
  }
  function startNew() {
    sequence.current++;
    controller.current?.abort();
    setBusy("");
    setInput("");
    setExampleId("");
    setBrief(null);
    setAnswers([]);
    setAssumptionsText("");
    setSelected([]);
    setStep("input");
    setError("");
    setNotice("");
  }
  function scrollToRegion(target: "plan" | "prototype") {
    const element = target === "plan" ? planRef.current : prototypeRef.current;
    element?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }
  return (
    <div className="solution-lab">
      <main
        id="lab-main"
        className={`lab-main ${step === "result" ? "lab-main--wide" : ""}`}
        aria-busy={Boolean(busy)}
      >
        <nav aria-label="设计进度" className="lab-steps">
          {steps.map((name, i) => (
            <span
              aria-current={i === activeStep ? "step" : undefined}
              data-state={
                i === activeStep ? "current" : i < activeStep ? "complete" : "upcoming"
              }
              key={name}
            >
              <b>{String(i + 1).padStart(2, "0")}</b>
              {name}
              {i < 2 && <i aria-hidden="true">—</i>}
            </span>
          ))}
        </nav>
        {step === "input" && (
          <section className="lab-stage lab-stage--input" aria-labelledby="lab-input-title">
            {result && (
              <button
                className="lab-return-existing lab-text-button"
                type="button"
                onClick={() => {
                  setStep("result");
                  setError("");
                }}
              >
                ← 返回版本 {result.id}
              </button>
            )}
            <section className="lab-intro">
              <p className="lab-overline">MAKE YOUR IDEA TANGIBLE</p>
              <h1 id="lab-input-title" ref={titleRef} tabIndex={-1}>
                一个想法，
                <br />
                从这里<span>变得具体。</span>
              </h1>
              <p>
                描述一件想改善的工作或服务。一起理清需求，判断哪里适合 AI，
                <br className="lab-desktop-break" />
                再把它变成可以点击、可以继续讨论的产品草稿。
              </p>
            </section>
            <form
              className="lab-input-card"
              aria-busy={Boolean(busy)}
              onSubmit={(e) => {
                e.preventDefault();
                void analyze();
              }}
            >
              <div className="lab-row">
                <label htmlFor="lab-input">你想解决什么问题？</label>
                <span className="lab-tag">不需要写成正式需求</span>
              </div>
              <textarea
                id="lab-input"
                placeholder={
                  "谁遇到了什么麻烦？现在怎么处理？你希望有什么变化？\n\n比如：同事总要在几个表格间整理经营数据，我想让大家更快看到变化……"
                }
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setExampleId("");
                }}
                minLength={10}
                maxLength={3000}
                required
                disabled={!!busy}
              />
              <div className="lab-input-bottom">
                <small>
                  {input.length}/3000 · 请使用概括性描述，不填真实敏感数据
                </small>
                <button
                  className="lab-button"
                  disabled={!!busy || input.trim().length < 10}
                >
                  {busy ? (
                    <>
                      <span className="lab-button-spinner" aria-hidden="true" />
                      正在梳理
                    </>
                  ) : (
                    <>
                      开始梳理 <span aria-hidden="true">↗</span>
                    </>
                  )}
                </button>
              </div>
              {exampleId && (
                <p className="lab-note">
                  已选择预设示例，使用演示诊断；自由输入不会调用 AI，请保留示例描述。
                </p>
              )}
            </form>
            {busy && <ActivityPanel message={busy} onCancel={cancel} />}
            {error && (
              <ErrorPanel
                message={error}
                action="重新梳理"
                onRetry={() => void analyze()}
              />
            )}
            {notice && <NoticePanel message={notice} />}
            <section className="lab-examples" aria-label="示例需求">
              <div className="lab-row">
                <h2>还没想好？从一个场景开始</h2>
                <span className="lab-note">三个不同的产品方向</span>
              </div>
              <div className="lab-example-grid">
                {examples.map((e, i) => (
                  <button
                    type="button"
                    disabled={!!busy}
                    className={`lab-example ${exampleId === e.id ? "lab-example--active" : ""}`}
                    aria-pressed={exampleId === e.id}
                    key={e.id}
                    onClick={() => chooseExample(e.id)}
                  >
                    <span className="lab-example-number">
                      0{i + 1}{" "}
                      <span className="lab-example-state" aria-hidden="true">
                        {exampleId === e.id ? "✓" : "↗"}
                      </span>
                    </span>
                    <strong>{e.label}</strong>
                    <span>{e.subtitle}</span>
                  </button>
                ))}
              </div>
            </section>
            <div className="lab-expectations">
              <span>✓ 先判断，再设计</span>
              <span>✓ AI 与程序各司其职</span>
              <span>✓ 原型可操作，方案可修改</span>
            </div>
          </section>
        )}
        {step === "brief" && brief && (
          <section
            className="lab-brief lab-stage lab-stage--brief"
            aria-labelledby="lab-brief-title"
          >
            <div className="lab-section-title">
              <p className="lab-overline">A SHARED UNDERSTANDING</p>
              <h1 id="lab-brief-title" ref={titleRef} tabIndex={-1}>
                先确认，我们想的是同一件事。
              </h1>
              <p>
                下面是当前理解。你可以直接修改，不清楚的条件也可以留待确认。
              </p>
            </div>
            <form
              aria-busy={Boolean(busy)}
              onSubmit={(e) => {
                e.preventDefault();
                void generate();
              }}
            >
              <fieldset disabled={!!busy} className="lab-brief-fields">
                <legend>核心理解</legend>
                {(
                  [
                    ["title", "草稿名称"],
                    ["users", "谁来使用"],
                    ["problem", "现在的困扰"],
                    ["goal", "希望完成的事"],
                  ] as const
                ).map(([key, label]) => (
                  <label className={`lab-brief-field lab-brief-field--${key}`} key={key}>
                    {label}
                    <textarea
                      rows={2}
                      required
                      maxLength={key === "title" ? 80 : 600}
                      value={brief[key]}
                      onChange={(e) => updateBrief({ [key]: e.target.value })}
                    />
                  </label>
                ))}
              </fieldset>
              <fieldset disabled={!!busy} className="lab-boundary-card">
                <legend>方案边界</legend>
                <label>
                  已有条件与范围
                  <textarea
                    rows={3}
                    maxLength={1200}
                    value={brief.conditions}
                    onChange={(e) => updateBrief({ conditions: e.target.value })}
                  />
                </label>
                <div className="lab-brief-options">
                  <label>
                    产品方向
                    <select
                      value={brief.scenario}
                      onChange={(e) =>
                        updateBrief({
                          scenario: e.target.value as Brief["scenario"],
                        })
                      }
                    >
                      <option value="analytics">经营分析</option>
                      <option value="retail">消费者导购</option>
                      <option value="marketing">营销策划</option>
                      <option value="unsupported">其他 / 待明确</option>
                    </select>
                  </label>
                  <label>
                    业务领域
                    <select
                      value={brief.industry}
                      onChange={(e) =>
                        updateBrief({
                          industry: e.target.value as Brief["industry"],
                        })
                      }
                    >
                      <option value="healthcare">医疗经营</option>
                      <option value="retail">零售</option>
                      <option value="general">其他 / 通用参考</option>
                    </select>
                  </label>
                  <label>
                    AI 使用偏好
                    <select
                      value={brief.aiPreference}
                      onChange={(e) =>
                        updateBrief({
                          aiPreference: e.target.value as Brief["aiPreference"],
                        })
                      }
                    >
                      <option value="allowed">有价值时使用</option>
                      <option value="none">这次不使用 AI</option>
                      <option value="undecided">请帮我判断</option>
                    </select>
                  </label>
                </div>
                <label className="lab-assumption-editor">
                  当前假设（每行一条，可修改或删除）
                  <textarea
                    rows={3}
                    maxLength={3605}
                    value={assumptionsText}
                    onChange={(e) => {
                      setAssumptionsText(e.target.value);
                      setExampleId("");
                    }}
                  />
                </label>
                <p className="lab-note">
                  {exampleId
                    ? "当前是冻结示例。修改条件与假设后，仍使用本地确定性演示。"
                    : "将按你确认的内容重新诊断，明确答案优先于暂定假设。"}
                </p>
              </fieldset>
              {(brief.questions.length > 0 || brief.clarifications.length > 0) && (
                <section className="lab-clarifications" aria-labelledby="lab-clarifications-title">
                  <div>
                    <span className="lab-feedback-icon" aria-hidden="true">?</span>
                    <div>
                      <h2 id="lab-clarifications-title">还需要确认</h2>
                      <p>不清楚可以留空，我们会把它保留为待确认条件。</p>
                    </div>
                  </div>
                  {brief.questions.map((q, i) => (
                    <label className="lab-question" key={q}>
                      {q}
                      <input
                        disabled={!!busy}
                        maxLength={300}
                        value={answers[i] || ""}
                        onChange={(e) =>
                          setAnswers(
                            brief.questions.map((_, j) =>
                              j === i ? e.target.value : answers[j] || "",
                            ),
                          )
                        }
                        placeholder="暂不清楚也可以"
                      />
                    </label>
                  ))}
                  {brief.clarifications.map((item, i) => (
                    <label className="lab-question" key={item.question}>
                      {item.question}
                      <input
                        disabled={!!busy}
                        maxLength={300}
                        value={item.answer}
                        onChange={(e) =>
                          updateBrief({
                            clarifications: brief.clarifications.map((c, j) =>
                              j === i ? { ...c, answer: e.target.value } : c,
                            ),
                          })
                        }
                        placeholder="暂不清楚也可以"
                      />
                    </label>
                  ))}
                </section>
              )}
              {!!selected.length && result && (
                <fieldset disabled={!!busy} className="lab-priorities">
                  <legend>这次优先保留哪些能力？</legend>
                  {result.diagnosis.capabilities
                    .filter(
                      (c) =>
                        capabilities[c.id].scenario === brief.scenario &&
                        (brief.aiPreference !== "none" ||
                          c.id !== "data_query"),
                    )
                    .map((c) => (
                      <label key={c.id}>
                        <input
                          type="checkbox"
                          checked={selected.includes(c.id)}
                          disabled={
                            selected.length === 1 && selected.includes(c.id)
                          }
                          onChange={() =>
                            setSelected(
                              selected.includes(c.id)
                                ? selected.filter((id) => id !== c.id)
                                : [...selected, c.id],
                            )
                          }
                        />
                        {capabilities[c.id].name}
                      </label>
                    ))}
                </fieldset>
              )}
              {brief.scenario === "unsupported" && (
                <div className="lab-assumptions">
                  <strong>当前模板还不能覆盖这个需求</strong>
                  <p>
                    {brief.limitation ||
                      "目前主要支持经营分析、消费者导购和营销策划。请缩小到其中一个具体流程，或选择示例。"}
                  </p>
                </div>
              )}
              <div className="lab-form-dock">
                {busy && <ActivityPanel message={busy} onCancel={cancel} />}
                {error && (
                  <ErrorPanel
                    message={error}
                    action="重新生成"
                    onRetry={() => void generate()}
                  />
                )}
                {notice && <NoticePanel message={notice} />}
                <div className="lab-form-actions">
                  <button
                    className="lab-secondary"
                    type="button"
                    disabled={!!busy}
                    onClick={startOver}
                  >
                    ← 修改原始描述
                  </button>
                  {result && (
                    <button
                      className="lab-text-button"
                      type="button"
                      disabled={!!busy}
                      onClick={() => {
                        setStep("result");
                        setError("");
                      }}
                    >
                      返回已有方案
                    </button>
                  )}
                  <button
                    className="lab-button"
                    disabled={!!busy || brief.scenario === "unsupported"}
                  >
                    {busy ? (
                      <>
                        <span className="lab-button-spinner" aria-hidden="true" />
                        生成中
                      </>
                    ) : (
                      <>
                        生成方案与原型 <span aria-hidden="true">↗</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </section>
        )}
        {step === "result" && result && (
          <section
            className="lab-stage lab-stage--result"
            aria-labelledby="lab-result-title"
          >
            <div className="lab-result-title">
              <div>
                <p className="lab-overline">AN IDEA, TAKING SHAPE</p>
                <h1 id="lab-result-title" ref={titleRef} tabIndex={-1}>
                  让方案，落到可以体验的地方。
                </h1>
                <div className="lab-result-meta" aria-label="生成信息">
                  <span>
                    {result.mode === "example"
                      ? "预设示例"
                      : result.mode === "fallback"
                        ? "规则草稿"
                        : "定制生成"}
                  </span>
                  <span>版本 {result.id}</span>
                </div>
              </div>
              <div className="lab-result-actions">
                {previous && (
                  <button
                    className="lab-secondary"
                    onClick={() => {
                      const swap = result;
                      setResult(previous);
                      setPrevious(swap);
                      setHighlight({ capability: "", revision: 0 });
                      setPageId(previous.prototype.pages[0].id);
                      setNotice(
                        `已切换到版本 ${previous.id}。原型中的临时操作会重新开始。`,
                      );
                    }}
                  >
                    切换到版本 {previous.id}
                  </button>
                )}
                <button className="lab-secondary" onClick={startNew}>
                  开始新需求
                </button>
                <button className="lab-button" onClick={edit}>
                  调整需求与能力 <span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>
            <div className="lab-mode-note">
              {result.mode === "example"
                ? "预设示例方案 · 用于体验完整流程，未调用模型。"
                : result.mode === "fallback"
                  ? "诊断已完成；原型规划未成功，当前展示基于诊断组合的规则草稿。"
                  : "根据当前需求生成 · 建议仍需业务核对。"}{" "}
              原型内部始终使用演示数据。
            </div>
            {notice && <NoticePanel message={notice} />}
            <nav className="lab-result-jump" aria-label="结果内容">
              <button type="button" onClick={() => scrollToRegion("plan")}>
                查看方案
              </button>
              <button type="button" onClick={() => scrollToRegion("prototype")}>
                查看原型
              </button>
            </nav>
            <div className="lab-result-grid">
              <aside
                id="lab-plan"
                ref={planRef}
                className="lab-diagnosis"
                aria-label="方案与设计判断"
              >
                <div className="lab-summary">
                  <span className="lab-overline">方案摘要</span>
                  <h2>{result.brief.title}</h2>
                  <p>{result.diagnosis.summary}</p>
                  <dl>
                    <dt>服务于</dt>
                    <dd>{result.brief.users}</dd>
                    <dt>优先解决</dt>
                    <dd>{result.brief.goal}</dd>
                  </dl>
                </div>
                <div className="lab-decisions">
                  <h3>为什么这样设计</h3>
                  <p className="lab-note">点击判断，定位对应原型模块。</p>
                  {result.diagnosis.capabilities.map((c, i) => (
                    <article key={c.id}>
                      <button
                        className="lab-decision"
                        aria-pressed={highlight.capability === c.id}
                        onClick={() => showCapability(c.id)}
                      >
                        <span>0{i + 1}</span>
                        <div>
                          <strong>{capabilities[c.id].name}</strong>
                          <small>
                            {c.approach === "software"
                              ? "确定性程序"
                              : "AI + 确定性程序"}
                          </small>
                        </div>
                        <span aria-hidden="true">↗</span>
                      </button>
                      <p>{c.reason}</p>
                    </article>
                  ))}
                </div>
                <details className="lab-technical">
                  <summary>实现建议与待确认事项</summary>
                  {result.diagnosis.capabilities.map((c) => (
                    <section key={c.id}>
                      <h4>{capabilities[c.id].name}</h4>
                      <p>
                        模型：
                        {c.approach === "software"
                          ? "无需模型参与"
                          : capabilities[c.id].llm}
                      </p>
                      <p>程序：{capabilities[c.id].system}</p>
                      <p>条件：{c.prerequisite}</p>
                    </section>
                  ))}
                  <h4>假设与风险</h4>
                  <ul>
                    {[
                      ...result.brief.assumptions,
                      ...result.brief.clarifications.map(
                        (c) => `${c.question}：${c.answer}`,
                      ),
                      ...result.diagnosis.risks,
                    ].map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </details>
              </aside>
              <div
                id="lab-prototype"
                ref={prototypeRef}
                className="lab-prototype-region"
              >
                <PrototypeRenderer
                  key={result.id}
                  spec={result.prototype}
                  highlight={highlight}
                  pageId={pageId}
                  onPageChange={(id) => {
                    setPageId(id);
                    setHighlight({ capability: "", revision: 0 });
                  }}
                />
              </div>
            </div>
          </section>
        )}
        <footer className="lab-footer">
          <span>AI 场景诊断与原型生成工作台</span>
          <span>草稿仅保留在当前页面，刷新后清空。</span>
        </footer>
      </main>
    </div>
  );
}
