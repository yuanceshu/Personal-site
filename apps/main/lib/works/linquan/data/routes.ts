import type { RouteConnection } from "@/lib/works/linquan/types";
import { routeConnectionSchema } from "@/lib/works/linquan/schemas/domain";

const trails: RouteConnection[] = [
  { from: "dawn-gate", to: "cedar-boardwalk", walkMinutes: 8, stairs: "none" },
  { from: "dawn-gate", to: "visitor-hub", walkMinutes: 6, stairs: "none" },
  { from: "cedar-boardwalk", to: "moon-stream", walkMinutes: 10, stairs: "medium" },
  { from: "cedar-boardwalk", to: "pine-rest", walkMinutes: 12, stairs: "low" },
  { from: "moon-stream", to: "fern-observatory", walkMinutes: 8, stairs: "low" },
  { from: "moon-stream", to: "pine-rest", walkMinutes: 15, stairs: "medium" },
  { from: "pine-rest", to: "cloud-platform", walkMinutes: 12, stairs: "medium" },
  { from: "fern-observatory", to: "cloud-platform", walkMinutes: 10, stairs: "low" },
  { from: "cloud-platform", to: "sunridge-garden", walkMinutes: 14, stairs: "high" },
  { from: "cloud-platform", to: "visitor-hub", walkMinutes: 16, stairs: "medium" },
  { from: "sunridge-garden", to: "visitor-hub", walkMinutes: 18, stairs: "high" },
  { from: "visitor-hub", to: "dawn-gate", walkMinutes: 6, stairs: "none" },
  { from: "visitor-hub", to: "cedar-boardwalk", walkMinutes: 7, stairs: "none" },
];

export const routeConnections: RouteConnection[] = Array.from(new Map(
  trails
    .flatMap((edge) => [edge, { ...edge, from: edge.to, to: edge.from }])
    .map((edge) => [edge.from + "->" + edge.to, routeConnectionSchema.parse(edge)]),
).values());

export const routeConnectionMap = new Map(routeConnections.map((connection) => [connection.from + "->" + connection.to, routeConnectionSchema.parse(connection)]));
