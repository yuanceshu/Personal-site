'use client';

import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { DashboardSnapshot, WorkspaceData } from './ui/types';
import ChatPanel, { type ChatHandle } from './chat-panel';
import { AnomalyList, ComparisonResult, MetricResult, QueryTable, ReconciliationResult, SectionHead, TrendChart, VarianceResult } from './result-blocks';
import Icon, { type IconName } from './ui/icons';
import { date, ratio } from './ui/display';
import { DemoCollectionLink } from '@/components/works/demos/navigation/demo-collection-link';

type ViewKey = 'overview' | 'analysis' | 'reconcile' | 'anomaly';
const nav: { key: ViewKey; label: string; note: string; icon: IconName }[] = [
  { key: 'overview', label: '经营总览', note: 'Overview', icon: 'overview' },
  { key: 'analysis', label: '智能分析', note: 'Ask anything', icon: 'spark' },
  { key: 'reconcile', label: '渠道对账', note: 'Reconciliation', icon: 'reconcile' },
  { key: 'anomaly', label: '异常监测', note: 'Watchlist', icon: 'alert' },
];

function Brand({ onHome }: { onHome: () => void }) { return <button type="button" className="brand" aria-label="云川财务智能体首页" onClick={onHome}><span className="brand-mark"><i /><i /><i /></span><span><b>云川</b><small>商业集团</small></span></button>; }

function Sidebar({ active, onSelect, onNewChat, data }: { active: ViewKey; onSelect: (key: ViewKey) => void; onNewChat: () => void; data: WorkspaceData }) {
  const anomalyCount = data.anomalies.items.length;
  return <aside className="sidebar"><Brand onHome={() => onSelect('analysis')} /><div className="workspace-switcher" aria-label="当前范围：集团财务部"><span className="workspace-dot" />集团财务部</div><button className="new-chat" onClick={onNewChat}><Icon name="plus" />新建分析会话</button><nav className="primary-nav" aria-label="主要导航"><p>工作台</p>{nav.map(item => <button key={item.key} className={`nav-item ${active === item.key ? 'active' : ''}`} onClick={() => onSelect(item.key)}><Icon name={item.icon} /><span><b>{item.label}</b><small>{item.note}</small></span>{item.key === 'anomaly' && anomalyCount > 0 && <em>{anomalyCount}</em>}</button>)}</nav><div className="sidebar-bottom"><div className="data-health"><span className="pulse" /><div><b>数据连接正常</b><small>截至 {date(data.referenceDate)}</small></div></div><div className="profile"><span>林</span><div><b>林知行</b><small>财务负责人</small></div><Icon name="menu" /></div></div></aside>;
}

function Header({ active, data }: { active: ViewKey; data: WorkspaceData }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const help = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (helpOpen) help.current?.showModal(); else help.current?.close(); }, [helpOpen]);
  const labels: Record<ViewKey, string> = { overview: '经营总览', analysis: '智能分析', reconcile: '渠道对账', anomaly: '异常监测' };
  return <header className="topbar"><div className="breadcrumbs"><span>工作台</span><b>/</b><strong>{labels[active]}</strong></div><div className="topbar-center"><span className="date-chip"><Icon name="calendar" />数据更新于 {date(data.referenceDate)}</span></div><div className="topbar-actions"><button className="top-icon" aria-label="帮助" onClick={() => setHelpOpen(true)}><Icon name="help" /></button><DemoCollectionLink className="collection-back" /></div><dialog className="finance-help" ref={help} aria-labelledby="finance-help-title" onCancel={() => setHelpOpen(false)}><h2 id="finance-help-title">如何体验财务工作台</h2><p>可以查询经营指标、比较变化、追溯渠道对账差异、查看异常和生成报告。智能分析需要已配置的对话服务；其他工作区可直接浏览。</p><p>范围为虚构集团的 3 家公司、4 个支付渠道，所有金额与流水均为模拟数据。</p><p>会话保存在当前设备。切换工作区或点击 Logo 会保留会话；只有“新会话”会清空当前对话和上下文。</p><button className="primary-button" autoFocus onClick={() => setHelpOpen(false)}>知道了</button></dialog></header>;
}

function SnapshotCards({ snapshot }: { snapshot: DashboardSnapshot }) {
  const overview = snapshot.report.overview; const comparison = snapshot.report.comparison; const orders = snapshot.orders; const refund = snapshot.refundRate;
  const orderCount = orders.unit === 'count' ? orders.totalValue : 0; const refundRate = refund.unit === 'ratio' ? refund.totalValue : 0;
  return <div className="snapshot-cards"><div className="snapshot-card main"><span>上月销售额</span><MetricResult data={overview} /><small className="card-caption">较前月 <b className={comparison.changeRate !== null && comparison.changeRate < 0 ? 'negative' : 'positive'}>{ratio(comparison.changeRate, true)}</b></small></div><div className="snapshot-card"><span>同比变化</span><strong className={snapshot.yearComparison.changeRate !== null && snapshot.yearComparison.changeRate < 0 ? 'negative' : 'positive'}>{ratio(snapshot.yearComparison.changeRate, true)}</strong><small className="card-caption">与去年同期销售额相比</small></div><div className="snapshot-card"><span>订单数</span><strong>{orderCount.toLocaleString('zh-CN')}<small> 笔</small></strong><small className="card-caption">上月完成订单</small></div><div className="snapshot-card"><span>退款率</span><strong>{ratio(refundRate)}</strong><small className="card-caption">销售与退款关系</small></div></div>;
}

function Overview({ data, onAsk }: { data: WorkspaceData; onAsk: (prompt: string) => void }) {
  const snapshot = data.snapshots.group;
  return <div className="view-content overview-view"><div className="welcome-row"><div><p className="section-kicker">MONDAY · {date(data.referenceDate)}</p><h1>今天，先看懂经营的变化。</h1><p className="welcome-copy">从集团全域看到关键变化，再用智能分析追到公司、渠道和具体流水。</p></div><div className="scope-summary"><span>当前数据范围</span><b>集团全域</b><small>3 家公司 · 4 个支付渠道</small></div></div><SnapshotCards snapshot={snapshot} /><div className="overview-grid"><section className="panel trend-panel"><SectionHead title="销售趋势" subtitle={`${date(snapshot.trend.range.start)} — ${date(snapshot.trend.range.end)}`}><button className="panel-action" onClick={() => onAsk('给我看看上个月每天的销售趋势。')}>问智能体 <Icon name="arrow" /></button></SectionHead><TrendChart data={snapshot.trend} /></section><section className="panel insight-panel"><SectionHead title="经营变化" subtitle="由真实 Finance Tool 计算"><button className="panel-action" onClick={() => onAsk('为什么上个月销售额发生变化？')}>深入分析 <Icon name="arrow" /></button></SectionHead><ComparisonResult data={snapshot.report.comparison} /><div className="mini-variance"><span>主要变化因素</span><VarianceResult data={snapshot.report.varianceDrivers} /></div></section></div><div className="overview-grid bottom-grid"><section className="panel company-panel"><SectionHead title="公司表现" subtitle="上月销售额贡献" /><QueryTable data={snapshot.report.companyBreakdown} /></section><section className="panel signal-panel"><SectionHead title="需要关注" subtitle="最近一周异常信号" /><AnomalyList data={data.anomalies} /></section></div></div>;
}

function AnalysisView({ chatRef, onAsk }: { chatRef: RefObject<ChatHandle | null>; onAsk: (prompt: string) => void }) {
  return <div className="view-content analysis-view"><div className="subpage-heading"><div><p className="section-kicker">CONVERSATION WORKSPACE</p><h1>把问题交给数据。</h1><p>每个回答都带着可追溯的结果卡片，支持继续追问。</p></div><div className="analysis-guide"><Icon name="spark" /><span>支持经营查询、环比分析、根因解释、异常检测、对账和报告</span></div></div><div className="analysis-layout"><ChatPanel ref={chatRef} /><aside className="analysis-rail"><div className="rail-card"><SectionHead title="提问建议" subtitle="试试这些表达" />{['8 月销售额比 7 月怎么样？', '华东下降主要是哪个渠道造成的？', '最大那笔差异对应哪个订单？', '生成一份 8 月经营分析'].map(prompt => <button className="suggestion" key={prompt} onClick={() => onAsk(prompt)}>{prompt}<Icon name="arrow" /></button>)}</div><div className="rail-card trust-card"><Icon name="check" /><h3>结果可追溯</h3><p>数字来自服务端 Finance Tool，模型负责理解问题和解释结果。</p></div></aside></div></div>;
}

function ReconcileView({ data, onAsk }: { data: WorkspaceData; onAsk: (prompt: string) => void }) {
  return <div className="view-content subview"><div className="subpage-heading"><div><p className="section-kicker">RECONCILIATION CENTER</p><h1>渠道对账，追到每一笔。</h1><p>先看匹配健康度，再展开差异原因和流水关系。</p></div><button className="primary-button" onClick={() => onAsk('把上周银联渠道金额不一致的流水展开看看。')}><Icon name="spark" />问智能体</button></div><div className="filter-strip"><span>当前范围</span><b>上周 · 银联</b><span className="filter-note">{date(data.reconciliationRange.start)} — {date(data.reconciliationRange.end)}</span><button onClick={() => onAsk('帮我看看上周银联渠道的对账情况。')}>更换条件 <Icon name="chevron" /></button></div><section className="panel"><SectionHead title="对账概览" subtitle="匹配结构与待处理差异" /><ReconciliationResult data={data.reconciliation} /></section><section className="panel details-panel"><SectionHead title="差异明细" subtitle="按绝对差异金额从高到低展示" /><ReconciliationResult data={data.reconciliationDetails} /></section></div>;
}

function AnomalyView({ data, onAsk }: { data: WorkspaceData; onAsk: (prompt: string) => void }) {
  return <div className="view-content subview"><div className="subpage-heading"><div><p className="section-kicker">WATCHLIST</p><h1>把值得关注的变化拎出来。</h1><p>异常检测帮助你定位偏离事实，原因仍需结合业务核实。</p></div><button className="primary-button" onClick={() => onAsk('最近有什么值得关注的异常？')}><Icon name="spark" />让智能体解释</button></div><div className="alert-summary"><div><span>当前异常</span><strong>{data.anomalies.items.length}</strong><small>上周识别</small></div><div><span>高关注</span><strong>{data.anomalies.items.filter(item => item.severity === 'high').length}</strong><small>需要优先确认</small></div><div><span>规则范围</span><strong>3</strong><small>销售 · 渠道 · 退款</small></div></div><section className="panel anomaly-panel"><SectionHead title="异常清单" subtitle="按检测规则返回真实数据" /><AnomalyList data={data.anomalies} /></section><div className="note-panel"><Icon name="alert" /><div><b>如何阅读异常</b><p>异常意味着实际值与基线或阈值出现偏离。系统不会根据常识猜测原因，请结合订单、渠道和业务记录进一步核实。</p></div></div></div>;
}

export default function FinanceWorkspace({ data }: { data: WorkspaceData }) {
  const [active, setActive] = useState<ViewKey>('analysis'); const chatRef = useRef<ChatHandle>(null);
  const ask = (prompt: string) => { setActive('analysis'); window.setTimeout(() => chatRef.current?.ask(prompt), 0); };
  const newChat = () => { setActive('analysis'); window.setTimeout(() => chatRef.current?.reset(), 0); };
  return <main className="app-shell"><Sidebar active={active} onSelect={setActive} onNewChat={newChat} data={data} /><section className="workspace"><Header active={active} data={data} />{active === 'overview' && <Overview data={data} onAsk={ask} />}<div hidden={active !== 'analysis'}><AnalysisView chatRef={chatRef} onAsk={ask} /></div>{active === 'reconcile' && <ReconcileView data={data} onAsk={ask} />}{active === 'anomaly' && <AnomalyView data={data} onAsk={ask} />}</section></main>;
}
