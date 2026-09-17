import { skillLabel } from "@/content/projects/ui-lab/experiments";
import type { Disclosure, UiVariant } from "@/content/projects/ui-lab/types";

function disclosure(item: Disclosure) { return `${{yes:"是",no:"否",unknown:"未记录"}[item.value]}${item.note !== "未记录" ? ` · ${item.note}` : ""}`; }
export function conditionRows(v: UiVariant): [string, string][] {
  return [
    ["模型", v.model], ["模型具体版本", v.modelVersion ?? "版本未记录"],
    ["推理强度", v.reasoningEffort ?? "未记录"], ["设计方法", skillLabel(v)],
    ["Skill 版本", v.skillMode === "bare" ? "不适用（裸跑）" : v.skillVersion ?? "未记录"],
    ["任务摘要", v.promptSummary], ["追加约束", v.additionalConstraints.join("；") || "未记录"],
    ["参考材料", disclosure(v.references)], ["生成图像", disclosure(v.imageGeneration)],
    ["生成 / 定稿日期", v.createdAt ?? "未记录"], ["归档基准日期", v.frozenAt],
    ["来源依据", v.sourceEvidence], ["对照等级", "视觉展示 · 不构成严格对照"],
  ];
}
export function Conditions({ variants }: { variants: UiVariant[] }) {
  const rows = variants.map(conditionRows);
  return <div className="uil-table-wrap" role="region" aria-label="实验条件对照表" tabIndex={0}>
    <table className="uil-table"><caption>未知条件不视为相同；公开的是清理后的摘要，不是原始 Prompt。</caption>
      <thead><tr><th scope="col">实验条件</th>{variants.map(v=><th key={v.id} scope="col">{v.model} × {v.title}</th>)}</tr></thead>
      <tbody>{rows[0].map(([label], index)=><tr key={label}><th scope="row">{label}</th>{rows.map((row,i)=><td key={variants[i].id}>{row[index][1]}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}
