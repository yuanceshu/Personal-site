import { z } from "zod"; import { executeTool, toolNames } from "../tools"; import type { ToolName } from "../types";
const input=z.object({name:z.enum(toolNames as [ToolName,...ToolName[]]),input:z.unknown()});
export const agentToolDefinitions=toolNames;
export function executeAgentTool(name:ToolName,value:unknown){return executeTool(name,value);}
export function parseToolRequest(value:unknown){return input.parse(value);}
