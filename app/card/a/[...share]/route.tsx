import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { decodePlanSegments, planCardLines, planAsado } from "../../../../src/domain/planner.ts";
import { renderPlanCard } from "../../../../src/server/card.tsx";
import { loadSnapshot } from "../../../../src/server/loadSnapshot.ts";

export async function GET(request: Request, { params }: { params: Promise<{ share: string[] }> }) {
  const input = decodePlanSegments((await params).share);
  if (request.url.includes("?") || Option.isNone(input)) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, s-maxage=86400" } });
  }
  const result = planAsado(await loadSnapshot(), input.value);
  if (Result.isFailure(result)) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, s-maxage=86400" } });
  return renderPlanCard(planCardLines(result.success), {
    headers: { "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable" },
  });
}
