import type { ReconcileInput } from '@/lib/works/finance-assistant/finance/schemas/reconciliation';
import type { TimeRange } from '@/lib/works/finance-assistant/finance/schemas/common';

export type FinanceConversationContext = {
  lastMetric?: string;
  lastTimeRange?: TimeRange;
  lastCompanyId?: 'C001'|'C002'|'C003';
  lastChannel?: '银联'|'支付宝'|'微信支付'|'宝信';
  lastCategory?: '数码产品'|'家用电器'|'办公用品'|'企业服务';
  lastIntent?: string;
  lastReconciliationIssueType?: ReconcileInput['issueType'];
  lastReconciliationMatchType?: ReconcileInput['matchType'];
};
export type ConversationMessage={role:'user'|'assistant';content:string};
export type ResultBlock={type:'metric'|'table'|'trend'|'comparison'|'variance'|'anomalyList'|'reconciliationSummary'|'reconciliationDetails'|'report';title?:string;data:unknown};
export type ChatRequest={message:string;conversationHistory?:ConversationMessage[];financeContext?:FinanceConversationContext};
export type ChatResponse={answer:string;usedTools:string[];context:FinanceConversationContext;blocks:ResultBlock[]};
export type AgentToolName='query_financial_data'|'compare_financial_periods'|'analyze_variance'|'detect_financial_anomalies'|'reconcile_transactions'|'generate_financial_report';
export type ProviderMessage={role:'system'|'user'|'assistant'|'tool';content:string|null;tool_call_id?:string;tool_calls?:ProviderToolCall[];providerItems?:unknown[]};
export type ProviderToolCall={id:string;name:AgentToolName;arguments:string};
export type AgentToolDefinition={type:'function';function:{name:AgentToolName;description:string;parameters:Record<string,unknown>}};
export type ProviderResult={content:string|null;toolCalls:ProviderToolCall[];providerItems?:unknown[]};
export interface AgentProvider{complete(messages:ProviderMessage[],tools:AgentToolDefinition[]):Promise<ProviderResult>}
