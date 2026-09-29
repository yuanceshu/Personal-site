import { MainAgent } from './main-agent';

/** 医疗作品的业务 Agent 只使用确定性 fallback；自然语言润色经主站实验服务完成。 */
export const mainAgent = new MainAgent({
  llmClient: {
    mode: 'fallback',
    complete: async () => { throw new Error('医疗作品模型调用由 experiment-agents 统一处理'); },
  },
});
