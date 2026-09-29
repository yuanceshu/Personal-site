'use client';

import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import type { ResultBlock } from '@/lib/works/finance-assistant/agent/types';
import { queryOutput, type QueryOutput } from '@/lib/works/finance-assistant/finance/schemas/query';
import { compareOutput, type CompareOutput } from '@/lib/works/finance-assistant/finance/schemas/comparison';
import { varianceOutput, type VarianceOutput } from '@/lib/works/finance-assistant/finance/schemas/variance';
import { anomalyOutput, type AnomalyOutput } from '@/lib/works/finance-assistant/finance/schemas/anomaly';
import { reconcileOutput, type ReconcileOutput } from '@/lib/works/finance-assistant/finance/schemas/reconciliation';
import { reportOutput, type ReportOutput } from '@/lib/works/finance-assistant/finance/schemas/report';
import { currency, ratio, scalar, label, date, metricNames, matchNames, issueNames, reasonNames } from './ui/display';
import Icon from './ui/icons';

export function SectionHead({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return <div className="section-head"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{children}</div>;
}

export function MetricResult({ data }: { data: QueryOutput }) {
  if (!data.rows.length) return <EmptyResult />;
  return <div className="metric-result"><span>{metricNames[data.metric]}</span><strong title={data.unit === 'cents' ? currency(data.totalCents, false) : undefined}>{data.unit === 'cents' ? currency(data.totalCents) : scalar(data.totalValue, data.unit)}</strong><small>{date(data.range.start)} — {date(data.range.end)}</small></div>;
}

export function QueryTable({ data }: { data: QueryOutput }) {
  const [expanded, setExpanded] = useState(false);
  const rows = data.unit === 'cents' ? data.rows.map(row => ({ key: row.key, formatted: currency(row.valueCents), share: row.share })) : data.rows.map(row => ({ key: row.key, formatted: scalar(row.value, data.unit), share: row.share }));
  if (!rows.length) return <EmptyResult />;
  const hasShare = rows.some(row => row.share !== undefined);
  return <><div className="table-scroll"><table><thead><tr><th>维度</th><th>{metricNames[data.metric]}</th>{hasShare && <th>占比</th>}</tr></thead><tbody>{(expanded ? rows : rows.slice(0, 6)).map(row => <tr key={row.key}><td>{label(row.key)}</td><td className="number">{row.formatted}</td>{hasShare && <td className="number muted">{row.share === undefined ? '—' : ratio(row.share)}</td>}</tr>)}</tbody></table></div>{rows.length > 6 && <button className="text-button table-expand" onClick={() => setExpanded(!expanded)}>{expanded ? '收起明细' : `展开全部 ${rows.length} 项`}<Icon name="chevron" /></button>}</>;
}

export function TrendChart({ data, compact = false }: { data: QueryOutput; compact?: boolean }) {
  const id = useId().replaceAll(':', '');
  const [hover, setHover] = useState<number | null>(null);
  const rows = data.unit === 'cents' ? data.rows.map(row => ({ key: row.key, value: row.valueCents })) : data.rows.map(row => ({ key: row.key, value: row.value }));
  if (!rows.length) return <EmptyResult />;
  const width = 640, height = compact ? 175 : 230, left = 55, top = 18, right = 15, bottom = 33;
  const max = Math.max(...rows.map(row => row.value), 1) * 1.14;
  const x = (index: number) => left + index / Math.max(rows.length - 1, 1) * (width - left - right);
  const y = (value: number) => top + (1 - value / max) * (height - top - bottom);
  const path = rows.map((row, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(row.value)}`).join(' ');
  const selected = hover === null ? null : rows[hover];
  const format = (value: number) => data.unit === 'cents' ? currency(value) : scalar(value, data.unit);
  return <div className="trend-chart"><div className="chart-key"><span><i />{metricNames[data.metric]}</span><span className="chart-readout">{selected ? `${date(selected.key)} · ${format(selected.value)}` : '移动到曲线上查看每日数据'}</span></div><svg role="img" aria-label={`${metricNames[data.metric]}每日趋势，${data.range.start}至${data.range.end}`} viewBox={`0 0 ${width} ${height}`} onMouseLeave={() => setHover(null)}>
    <defs><linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#298979" stopOpacity=".18" /><stop offset="100%" stopColor="#298979" stopOpacity="0" /></linearGradient></defs>
    {[0, .25, .5, .75, 1].map(tick => <g key={tick}><line x1={left} x2={width - right} y1={y(max * tick)} y2={y(max * tick)} stroke="#e9ece6" strokeDasharray="4 5" /><text x={left - 9} y={y(max * tick) + 4} textAnchor="end">{data.unit === 'cents' ? `${(max * tick / 1000000).toFixed(0)}万` : scalar(max * tick, data.unit)}</text></g>)}
    <path d={`${path} L ${x(rows.length - 1)} ${height - bottom} L ${left} ${height - bottom} Z`} fill={`url(#fill-${id})`} />
    <path d={path} fill="none" stroke="#288879" strokeWidth="2.4" strokeLinejoin="round" />
    {rows.map((row, index) => <g key={row.key}>{(index === 0 || index === rows.length - 1 || index % 7 === 0) && <text x={x(index)} y={height - 10} textAnchor="middle">{row.key.slice(5).replace('-', '.')}</text>}<rect x={x(index) - 9} y={top} width="18" height={height - top - bottom} fill="transparent" onMouseEnter={() => setHover(index)} /><circle cx={x(index)} cy={y(row.value)} r={hover === index ? 4 : 0} fill="#288879" stroke="#fff" strokeWidth="2"><title>{`${date(row.key)}：${format(row.value)}`}</title></circle></g>)}
    {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={top} y2={height - bottom} stroke="#288879" opacity=".35" strokeDasharray="3 3" />}
  </svg><details className="data-disclosure"><summary>查看每日数值</summary><QueryTable data={data} /></details></div>;
}

export function ComparisonResult({ data }: { data: CompareOutput }) {
  const values = data.unit === 'cents' ? [currency(data.currentCents), currency(data.previousCents), currency(data.absoluteChangeCents)] : [scalar(data.currentValue, data.unit), scalar(data.previousValue, data.unit), scalar(data.changeValue, data.unit)];
  return <><div className="comparison-grid"><div><span>当前期间</span><strong>{values[0]}</strong></div><div><span>对比期间</span><strong>{values[1]}</strong></div><div className="change-cell"><span>绝对变化</span><strong>{values[2]}</strong></div><div><span>变化率</span><strong className={data.changeRate !== null && data.changeRate < 0 ? 'negative' : 'positive'}>{ratio(data.changeRate, true)}</strong></div></div><details className="data-disclosure"><summary>查看公司贡献</summary><div className="table-scroll"><table><thead><tr><th>公司</th><th>变化金额 / 数值</th><th>贡献率</th></tr></thead><tbody>{data.unit === 'cents' ? data.breakdown.map(row => <tr key={row.key}><td>{label(row.key)}</td><td className="number">{currency(row.changeCents)}</td><td className="number">{ratio(row.contributionRate)}</td></tr>) : data.breakdown.map(row => <tr key={row.key}><td>{label(row.key)}</td><td className="number">{scalar(row.changeValue, data.unit)}</td><td className="number">{ratio(row.contributionRate)}</td></tr>)}</tbody></table></div></details></>;
}

export function VarianceResult({ data }: { data: VarianceOutput }) {
  const contributors = data.unit === 'cents' ? data.topContributors.map(row => ({ key: row.key, change: row.changeCents, formatted: currency(row.changeCents), rate: row.contributionRate })) : data.topContributors.map(row => ({ key: row.key, change: row.changeValue, formatted: scalar(row.changeValue, data.unit), rate: row.contributionRate }));
  const max = Math.max(...contributors.map(row => Math.abs(row.change)), 1);
  return <><div className="variance-summary"><span>整体变化</span><strong>{data.unit === 'cents' ? currency(data.overall.absoluteChangeCents) : scalar(data.overall.changeValue, data.unit)}</strong>{data.concentratedPeriod && <small>变化集中：{data.concentratedPeriod}</small>}</div><div className="contributor-list">{contributors.map(row => <div className="contributor" key={row.key}><div><span>{label(row.key)}</span><b className={row.change < 0 ? 'negative' : 'positive'}>{row.formatted}</b></div><div className="contributor-bar"><span className={row.change < 0 ? 'decline' : 'growth'} style={{ width: `${Math.abs(row.change) / max * 100}%` }} /></div><small>贡献率 {ratio(row.rate)}</small></div>)}</div><p className="result-note">贡献率可超过 100%；其他维度的反向变化会抵消部分影响。</p></>;
}

export function AnomalyList({ data }: { data: AnomalyOutput }) {
  const [expanded, setExpanded] = useState(false);
  if (!data.items.length) return <EmptyResult text="当前条件下未检测到异常" />;
  const items = expanded ? data.items : data.items.slice(0, 5);
  return <>
    <div className="anomaly-list">{items.map((item, index) => <details className="anomaly-item" key={`${item.date}-${item.scope}-${item.rule}-${index}`}>
      <summary><span className={`severity-dot ${item.severity}`} /><div><strong>{label(item.message)}</strong><small>{item.date && date(item.date)} · {label(item.scope ?? '集团')}</small></div><span className={`severity-tag ${item.severity}`}>{item.severity === 'high' ? '高关注' : item.severity === 'medium' ? '中关注' : '低关注'}</span><Icon name="chevron" /></summary>
      <div className="anomaly-facts"><span>实际值 <b>{'valueCents' in item ? currency(item.valueCents) : ratio(item.valueRatio)}</b></span><span>基线 / 阈值 <b>{'baselineCents' in item ? currency(item.baselineCents) : ratio(item.baselineRatio)}</b></span>{item.deviationRate !== undefined && <span>偏离值 <b>{ratio(item.deviationRate, true)}</b></span>}</div>
    </details>)}</div>
    {data.items.length > 5 && <button className="text-button table-expand" onClick={() => setExpanded(!expanded)}>{expanded ? '收起异常' : `查看全部 ${data.items.length} 条异常`}<Icon name="chevron" /></button>}
    <p className="result-note">异常规则识别数据偏离，不代表已确认业务原因。</p>
  </>;
}

export function ReconciliationResult({ data }: { data: ReconcileOutput }) {
  const [issue, setIssue] = useState('all');
  if (data.mode === 'summary') {
    const s = data.summary;
    if (!s.totalInternalCount && !s.totalSettlementCount) return <EmptyResult />;
    const issues = [['金额不一致', s.issueCounts.amountMismatch], ['仅内部有记录', s.issueCounts.internalOnly], ['仅渠道有记录', s.issueCounts.channelOnly], ['状态不一致', s.issueCounts.statusMismatch], ['疑似重复', s.issueCounts.duplicateSuspected], ['需人工复核', s.issueCounts.manualReviewRequired]] as const;
    return <><div className="recon-stats"><div><span>记录匹配率</span><strong>{ratio(s.recordMatchRate)}</strong><small>{s.matchedInternalCount} / {s.totalInternalCount} 笔内部流水</small></div><div><span>金额匹配率</span><strong>{ratio(s.amountMatchRate)}</strong><small>已匹配 {currency(s.matchedAmountCents)}</small></div><div className="warm-stat"><span>未匹配内部金额</span><strong>{currency(s.unmatchedAmountCents)}</strong><small>未匹配渠道金额 {currency(s.unmatchedSettlementAmountCents)}</small></div></div><div className="recon-issues">{issues.map(([name, count]) => <div key={name}><span>{name}</span><b>{count}<small> 组</small></b></div>)}</div><div className="match-breakdown"><span>匹配结构</span><b>1:1 <em>{s.matchedCounts.oneToOne}</em></b><b>1:N <em>{s.matchedCounts.oneToMany}</em></b><b>N:1 <em>{s.matchedCounts.manyToOne}</em></b><b>N:N <em>{s.matchedCounts.manyToMany}</em></b></div></>;
  }
  if (!data.groups.length) return <EmptyResult text="当前条件下没有对账明细" />;
  const groups = data.groups.filter(group => issue === 'all' || group.issueType === issue);
  return <><div className="details-toolbar"><span>已返回 {data.groups.length} 组 · 按工具排序展示</span><label className="sr-only" htmlFor="issue-filter">筛选已返回的明细</label><select id="issue-filter" value={issue} onChange={event => setIssue(event.target.value)}><option value="all">全部类型</option>{Object.entries(issueNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></div><div className="recon-details">{groups.map(group => <details key={group.reconciliationId} className="recon-detail"><summary><div><strong>{group.orderIds.join(' / ') || group.reconciliationId}</strong><small>{label(group.companyId)} · {group.channel} · {date(group.dateRange.start)}</small></div><div className="detail-amount"><b>{currency(group.differenceCents, false)}</b><span>{group.issueType ? issueNames[group.issueType] : matchNames[group.matchType]}</span></div><Icon name="chevron" /></summary><div className="trace-grid"><span>内部金额<b>{currency(group.internalAmountCents, false)}</b></span><span>渠道金额<b>{currency(group.settlementAmountCents, false)}</b></span><span>手续费调整<b>{currency(group.feeAdjustmentCents, false)}</b></span><span>匹配方式<b>{matchNames[group.matchType]}</b></span><span className="trace-wide">规则解释<b>{reasonNames[group.reasonCode]}</b></span><span className="trace-wide">内部流水<b>{group.internalIds.join('、') || '无'}</b></span><span className="trace-wide">渠道流水<b>{group.settlementIds.join('、') || '无'}</b></span><span className="trace-wide">外部交易号<b>{group.externalTxnIds.join('、') || '无'}</b></span><span className="trace-wide">批次 / 对账组<b>{group.batchId} / {group.reconciliationId}</b></span></div></details>)}</div>{!groups.length && <EmptyResult text="已返回的明细中没有该类型" />}</>;
}

export function ReportResult({ data }: { data: ReportOutput }) {
  return <div className="report-sections"><section><SectionHead title="01 / 经营概览" /><MetricResult data={data.overview} /></section><section><SectionHead title="02 / 环比表现" /><ComparisonResult data={data.comparison} /></section><section><SectionHead title="03 / 公司表现" /><QueryTable data={data.companyBreakdown} /></section><section><SectionHead title="04 / 渠道结构" /><QueryTable data={data.channelStructure} /></section><section><SectionHead title="05 / 主要变化原因" /><VarianceResult data={data.varianceDrivers} /></section><section><SectionHead title="06 / 异常事项" /><AnomalyList data={data.anomalies} /></section></div>;
}

function EmptyResult({ text = '当前条件下没有可用数据' }: { text?: string }) { return <div className="empty-result"><Icon name="check" /><p>{text}</p></div>; }

export default function ResultBlockView({ block }: { block: ResultBlock }) {
  let content: ReactNode = <p className="result-note">结果格式暂不可展示，请重新查询。</p>;
  if (['metric', 'table', 'trend'].includes(block.type)) { const parsed = queryOutput.safeParse(block.data); if (parsed.success) content = block.type === 'metric' ? <MetricResult data={parsed.data} /> : block.type === 'trend' ? <TrendChart data={parsed.data} /> : <QueryTable data={parsed.data} />; }
  if (block.type === 'comparison') { const parsed = compareOutput.safeParse(block.data); if (parsed.success) content = <ComparisonResult data={parsed.data} />; }
  if (block.type === 'variance') { const parsed = varianceOutput.safeParse(block.data); if (parsed.success) content = <VarianceResult data={parsed.data} />; }
  if (block.type === 'anomalyList') { const parsed = anomalyOutput.safeParse(block.data); if (parsed.success) content = <AnomalyList data={parsed.data} />; }
  if (block.type.startsWith('reconciliation')) { const parsed = reconcileOutput.safeParse(block.data); if (parsed.success) content = <ReconciliationResult data={parsed.data} />; }
  if (block.type === 'report') { const parsed = reportOutput.safeParse(block.data); if (parsed.success) content = <ReportResult data={parsed.data} />; }
  return <div className="result-card"><SectionHead title={block.title ?? '分析结果'}><span className="data-badge"><Icon name="check" />数据结果</span></SectionHead>{content}</div>;
}
