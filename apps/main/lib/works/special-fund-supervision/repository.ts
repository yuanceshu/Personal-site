import projectsJson from "./data/projects.json"; import documentsJson from "./data/documents.json"; import policiesJson from "./data/policies.json"; import operationsJson from "./data/operation-records.json"; import performanceJson from "./data/performance.json"; import historicalJson from "./data/historical-applications.json"; import { documentSchema, operationRecordSchema, performanceSchema, policySchema, projectSchema, type Project, type ProjectDocument, type OperationRecord, type PerformanceRecord, type PolicyBundle } from "./types";
export const projects=projectSchema.array().parse(projectsJson); export const documents=documentSchema.array().parse(documentsJson); export const policies=policySchema.parse(policiesJson); export const operations=operationRecordSchema.array().parse(operationsJson); export const performance=performanceSchema.array().parse(performanceJson);
export const historicalApplications=historicalJson;
export function findProject(idOrName:string){const q=idOrName.trim().toLowerCase(); return projects.find(p=>p.id.toLowerCase()===q||p.name.toLowerCase().includes(q)||p.companyName.toLowerCase()===q);}
export function documentsFor(projectId:string):ProjectDocument[]{return documents.filter(d=>d.projectId===projectId);}
export function operationFor(projectId:string):OperationRecord|undefined{return operations.find(r=>r.projectId===projectId);}
export function performanceFor(projectId:string):PerformanceRecord|undefined{return performance.find(r=>r.projectId===projectId);}

