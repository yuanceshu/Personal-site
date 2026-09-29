import { z } from "zod";
import { executeFinanceTool } from "@/lib/works/finance-assistant/agent/tools";

export const runtime = "nodejs";

const inputSchema = z.object({
  name: z.enum([
    "query_financial_data",
    "compare_financial_periods",
    "analyze_variance",
    "detect_financial_anomalies",
    "reconcile_transactions",
    "generate_financial_report",
  ]),
  input: z.unknown(),
});

export async function POST(request: Request) {
  const token = process.env.EXPERIMENT_AGENT_TOKEN;
  if (!token || request.headers.get("authorization") !== `Bearer ${token}`)
    return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const payload = inputSchema.parse(await request.json());
    return Response.json({ result: executeFinanceTool(payload.name, payload.input) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "invalid_request", issues: error.issues }, { status: 400 });
    return Response.json({ error: "tool_failed" }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}
