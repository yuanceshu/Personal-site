import { queryFinancialData } from './query'; import { queryInput,queryOutput } from './schemas/query'; import { compareFinancialPeriods } from './comparison'; import { compareInput,compareOutput } from './schemas/comparison'; import { analyzeVariance } from './variance'; import { varianceInput,varianceOutput } from './schemas/variance'; import { reconcileInput,reconcileOutput } from './schemas/reconciliation'; import { reconcileFromData } from './reconciliation'; import { detectFinancialAnomalies } from './anomaly'; import { anomalyInput,anomalyOutput } from './schemas/anomaly'; import { reportInput,reportOutput } from './schemas/report'; import { generateFinancialReport } from './report';
export const financeTools={
 queryFinancialData:(input:unknown)=>queryOutput.parse(queryFinancialData(queryInput.parse(input))),
 compareFinancialPeriods:(input:unknown)=>compareOutput.parse(compareFinancialPeriods(compareInput.parse(input))),
 analyzeVariance:(input:unknown)=>varianceOutput.parse(analyzeVariance(varianceInput.parse(input))),
 reconcileTransactions:(input:unknown)=>reconcileOutput.parse(reconcileFromData(reconcileInput.parse(input))),
 detectFinancialAnomalies:(input:unknown)=>anomalyOutput.parse(detectFinancialAnomalies(anomalyInput.parse(input))),
 generateFinancialReport:(input:unknown)=>reportOutput.parse(generateFinancialReport(reportInput.parse(input)))
};
export type FinanceToolName=keyof typeof financeTools;
