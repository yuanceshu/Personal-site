import { evaluateReportSafety } from './safety';
import type { KnowledgeReference, ReportInterpretationResult, StructuredCtReport } from './types';

function hasUncertainty(text: string): boolean {
  return /(考虑|可能|提示|不能排除|不除外|需结合临床|结合临床|进一步判断|不确定|待结合|indeterminate|uncertain|cannot exclude|consider|possible)/i.test(text);
}

function explainFinding(original: string): { explanation: string; significance: 'normal' | 'attention' | 'uncertain' } {
  if (/阑尾轻度增粗/.test(original)) {
    return {
      explanation: '报告观察到阑尾的外观比通常描述得稍粗，这是影像表现本身，单凭这一项不能确定具体疾病。',
      significance: 'uncertain',
    };
  }
  if (/脂肪间隙.*渗出|周围.*渗出/.test(original)) {
    return {
      explanation: '报告描述阑尾周围组织间隙有轻度渗出，属于需要结合腹痛位置、体格检查和其他结果关注的影像表现。',
      significance: 'attention',
    };
  }
  if (/未见明显异常|未见异常|正常/.test(original)) {
    return { explanation: '报告在这一项没有描述明显异常。', significance: 'normal' };
  }
  return {
    explanation: '这是报告记录的影像学描述；它的具体意义需要由医生结合你的症状和检查情况判断。',
    significance: hasUncertainty(original) ? 'uncertain' : 'attention',
  };
}

export function interpretCtReport(report: StructuredCtReport, sources: KnowledgeReference[] = []): ReportInterpretationResult {
  if (report.report_status !== 'READY') throw new Error('报告尚未 READY，不能进行报告解释');
  const reportSafety = evaluateReportSafety(report);
  const impressionFindings = report.impression.map((original) => {
    const explained = explainFinding(original);
    return {
      original,
      explanation: /炎性改变/.test(original)
        ? '报告总结为局部轻度炎性改变，但这是影像学总结，报告同时要求结合临床进一步判断，不能据此确定具体疾病。'
        : explained.explanation,
      significance: hasUncertainty(original) ? 'uncertain' as const : explained.significance,
    };
  });
  const detailedFindings = report.findings.map((original) => {
    const explained = explainFinding(original);
    return { original, ...explained };
  });
  const keyFindings = [...impressionFindings, ...detailedFindings];
  const uncertainty = [
    ...keyFindings.filter((finding) => finding.significance === 'uncertain').map((finding) => `“${finding.original}”保留了报告中的不确定性，需要结合临床判断。`),
    ...report.recommendations.filter(hasUncertainty).map((recommendation) => `报告建议“${recommendation}”，仍需要结合临床判断。`),
  ];
  const recommendationSteps = report.recommendations.map((recommendation) => `报告建议：${recommendation}`);
  const nextSteps = [
    ...recommendationSteps,
    '建议携带这份报告返回普外科，由医生结合症状、体格检查和影像结果综合评估。',
  ];
  const summary = report.impression.length > 0
    ? `这份${report.exam_name}最重要的信息是：${report.impression.join('；').replace(/[。；]+$/u, '')}。`
    : `这份${report.exam_name}的报告没有提供可供概括的 Impression，请以原报告和医生说明为准。`;

  return {
    summary,
    key_findings: keyFindings,
    uncertainty,
    next_steps: nextSteps,
    critical: reportSafety.critical,
    sources,
  };
}
