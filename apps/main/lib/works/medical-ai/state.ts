import { z } from "zod";
import type { AgentSession } from "./src/agent/main-agent";
import { exportAgentSession, importAgentSession } from "./src/agent/main-agent";
import { exportMockState, importMockState, resetMockState, type MockStateSnapshot } from "./src/tools/mock-tools";

export const medicalChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  patient_id: z.string().min(1).max(80).default("demo001"),
  session_id: z.string().min(1).max(120).default("demo001"),
  state: z.unknown().optional(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2400) })).max(16).default([]),
}).strict();

export const medicalActionRequestSchema = z.object({
  action: z.literal("update_visit_stage"),
  stage: z.string(),
  patient_id: z.string().min(1).max(80).default("demo001"),
  session_id: z.string().min(1).max(120).default("demo001"),
  state: z.unknown().optional(),
}).strict();

export interface MedicalClientState {
  mock: MockStateSnapshot | null;
  agent: AgentSession | null;
}

export function defaultMedicalState(): MedicalClientState {
  resetMockState();
  return { mock: exportMockState(), agent: null };
}

export function parseMedicalState(value: unknown): MedicalClientState {
  if (!value || typeof value !== "object") return defaultMedicalState();
  const input = value as { mock?: unknown; agent?: unknown };
  const mock = input.mock && typeof input.mock === "object" ? input.mock as MockStateSnapshot : null;
  const agent = input.agent && typeof input.agent === "object" ? input.agent as AgentSession : null;
  return { mock, agent };
}

export function restoreMedicalState(state: MedicalClientState, sessionId: string, patientId: string) {
  importMockState(state.mock);
  importAgentSession(sessionId, patientId, state.agent);
}

export function captureMedicalState(sessionId: string, patientId: string): MedicalClientState {
  return { mock: exportMockState(), agent: exportAgentSession(sessionId, patientId) };
}

export function clearMedicalRuntime(sessionId: string, patientId: string) {
  importAgentSession(sessionId, patientId, null);
  resetMockState();
}
