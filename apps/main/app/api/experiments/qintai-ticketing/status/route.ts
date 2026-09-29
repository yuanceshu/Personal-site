import { qintaiAgentStatus } from "@/lib/works/qintai-ticketing/proxy";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET() {
  return qintaiAgentStatus();
}
