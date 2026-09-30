import { z } from "zod";

export const projectSchema = z.object({
  id:z.string(), name:z.string(), companyId:z.string(), companyName:z.string(), region:z.string(),
  status:z.string(), riskLevel:z.enum(["低","中","高"]), declaredInvestment:z.number().nullable(),
  approvedInvestment:z.number().nullable(), requestedSubsidy:z.number(), approvedSubsidy:z.number(), paidSubsidy:z.number(),
  startDate:z.string().optional(), completionDate:z.string().optional(), riskTags:z.array(z.string())
});
export const documentSchema = z.object({ id:z.string(), projectId:z.string(), type:z.string(), name:z.string(), status:z.string(), content:z.string(), extractedFields:z.record(z.string(), z.unknown()).default({}) });
export const policySchema = z.object({ policyId:z.string(), name:z.string(), rules:z.array(z.object({id:z.string(),title:z.string(),description:z.string(),ruleType:z.string(),parameters:z.record(z.string(),z.unknown())})) });
export const operationRecordSchema = z.object({projectId:z.string(),source:z.string(),asOf:z.string(),firstEffectiveRecordDate:z.string(),actualRuntimeMonths:z.number(),actualBusinessVolume:z.number(),actualUtilization:z.number()});
export const performanceSchema = z.object({projectId:z.string(),metrics:z.array(z.object({metric:z.string(),target:z.number(),actual:z.number(),unit:z.string()}))});
export type Project=z.infer<typeof projectSchema>; export type ProjectDocument=z.infer<typeof documentSchema>; export type PolicyBundle=z.infer<typeof policySchema>; export type OperationRecord=z.infer<typeof operationRecordSchema>; export type PerformanceRecord=z.infer<typeof performanceSchema>;
export type ToolName="query_project"|"query_documents"|"check_material_completeness"|"query_policy_rules"|"verify_project_data"|"calculate_subsidy"|"query_performance"|"query_regulatory_stats";
