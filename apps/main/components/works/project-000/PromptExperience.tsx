"use client";

import { useState } from "react";

type Phase = "prompt" | "generic" | "refine" | "compare";

const dimensions = [
  { label: "需求", value: "一页汇报要点" },
  { label: "场景", value: "给领导做周会汇报" },
  { label: "约束", value: "领导很看重数据" },
];

export function PromptExperience() {
  const [phase, setPhase] = useState<Phase>("prompt");

  const reset = () => {
    setPhase("prompt");
  };

  return (
    <div className="prompt-demo">
      <div className="prompt-demo__progress" aria-label="体验进度">
        {["先看结果", "补充信息", "比较差别"].map((label, index) => {
          const activeIndex =
            phase === "prompt" || phase === "generic"
              ? 0
              : phase === "refine"
                ? 1
                : 2;

          return (
            <span key={label} className={index <= activeIndex ? "is-active" : ""}>
              <i aria-hidden="true" />
              {label}
            </span>
          );
        })}
      </div>

      <div className="prompt-demo__stage" aria-live="polite">
        {phase === "prompt" && (
          <div className="demo-panel demo-panel--compact">
            <p className="demo-label">你对 AI 说</p>
            <blockquote>把这些材料汇总一下。</blockquote>
            <button className="primary-button" type="button" onClick={() => setPhase("generic")}>
              让 AI 回答
            </button>
          </div>
        )}

        {phase === "generic" && (
          <div className="demo-panel">
            <div className="answer-card answer-card--muted">
              <div className="answer-card__topline">
                <span>网页预置演示</span>
                <span>第一次回答</span>
              </div>
              <p>
                这些材料主要围绕近期工作进展、存在问题及后续计划展开。建议持续关注重点事项，加强协同，并根据实际情况及时优化后续安排。
              </p>
            </div>
            <p className="demo-insight">
              每句话都没错，但你还是不知道它能不能拿去汇报。
            </p>
            <button className="primary-button" type="button" onClick={() => setPhase("refine")}>
              补上三个关键信息
            </button>
          </div>
        )}

        {phase === "refine" && (
          <div className="demo-panel">
            <p className="demo-label">一次补上三个信息</p>
            <div className="dimension-list">
              {dimensions.map((dimension) => (
                <div className="dimension-row is-selected" key={dimension.label}>
                  <span>{dimension.label}</span>
                  <strong>{dimension.value}</strong>
                  <i aria-hidden="true">✓</i>
                </div>
              ))}
            </div>

            <div className="composed-prompt">
              <p className="demo-label">现在，AI 收到的是</p>
              <p>
                把这些材料汇总成一页汇报要点，用于给领导做周会汇报，优先突出关键数据、变化和需要决策的问题。
              </p>
              <button className="primary-button" type="button" onClick={() => setPhase("compare")}>
                再回答一次
              </button>
            </div>
          </div>
        )}

        {phase === "compare" && (
          <div className="demo-panel">
            <div className="answer-comparison">
              <article className="answer-card answer-card--muted">
                <div className="answer-card__topline">
                  <span>第一次</span>
                  <span>正确，但不可用</span>
                </div>
                <p>
                  材料围绕工作进展、存在问题及后续计划展开。建议持续关注重点事项并加强协同。
                </p>
              </article>

              <article className="answer-card answer-card--focused">
                <div className="answer-card__topline">
                  <span>第二次</span>
                  <span>围绕决策组织</span>
                </div>
                <ul>
                  <li>关键数据与环比变化</li>
                  <li>异常项、原因与影响</li>
                  <li>需要领导决策的三个问题</li>
                </ul>
              </article>
            </div>
            <p className="demo-conclusion">
              AI 没有突然变聪明。它只是终于知道：你要什么、用在哪、最在意什么。
            </p>
            <button className="secondary-button" type="button" onClick={reset}>
              再体验一次
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
