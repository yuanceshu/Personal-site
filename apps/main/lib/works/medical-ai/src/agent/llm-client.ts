export type LlmMode = 'fallback' | 'llm';

export interface LlmConfig {
  mode: LlmMode;
  apiKey: string;
  baseUrl: string;
  model: string;
  fallbackReason: string | null;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: LlmToolCall[];
  tool_call_id?: string;
}

export interface LlmToolCall {
  id: string;
  function?: { name?: string; arguments?: string };
}

export interface LlmAssistantMessage {
  content?: string | null;
  tool_calls?: LlmToolCall[];
}

export function getLlmConfig(env: NodeJS.ProcessEnv = process.env): LlmConfig {
  const requestedMode = env.LLM_MODE?.toLowerCase();
  const hasApiKey = Boolean(env.LLM_API_KEY);
  const mode: LlmMode = requestedMode === 'mock' || !hasApiKey ? 'fallback' : 'llm';
  return {
    mode,
    apiKey: env.LLM_API_KEY ?? '',
    baseUrl: (env.LLM_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: env.LLM_MODEL ?? 'gpt-4o-mini',
    fallbackReason: requestedMode === 'mock' ? 'LLM_MODE=mock' : (!hasApiKey ? '未设置 LLM_API_KEY' : null),
  };
}

export class LlmClient {
  private readonly config: LlmConfig;
  private readonly fetchImpl: typeof fetch;

  constructor({ env = process.env, fetchImpl = globalThis.fetch }: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch } = {}) {
    this.config = getLlmConfig(env);
    this.fetchImpl = fetchImpl;
  }

  get mode(): LlmMode {
    return this.config.mode;
  }

  async complete({ messages, tools }: { messages: LlmMessage[]; tools: unknown[] }): Promise<LlmAssistantMessage> {
    if (this.mode !== 'llm') throw new Error('当前为开发 fallback 模式，未启用真实 LLM：' + this.config.fallbackReason);
    const response = await this.fetchImpl(this.config.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + this.config.apiKey },
      body: JSON.stringify({ model: this.config.model, messages, tools, tool_choice: 'auto', temperature: 0.2 }),
    });
    const body: unknown = await response.json();
    if (!response.ok) {
      const data = body as { error?: { message?: string }; message?: string };
      throw new Error('LLM 请求失败: ' + (data.error?.message ?? data.message ?? 'HTTP ' + response.status));
    }
    const message = (body as { choices?: Array<{ message?: LlmAssistantMessage }> }).choices?.[0]?.message;
    if (!message) throw new Error('LLM 返回中缺少 message');
    return message;
  }
}
