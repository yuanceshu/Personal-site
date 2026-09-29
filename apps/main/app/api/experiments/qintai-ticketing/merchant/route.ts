import { qintaiAgentPost } from "@/lib/works/qintai-ticketing/proxy";

export const runtime = "nodejs";
export const maxDuration = 65;

export async function POST(request: Request) {
  return qintaiAgentPost(request, {
    upstreamPath: "/works/qintai-ticketing/merchant",
    scope: "merchant",
    role: "merchant",
  });
}
