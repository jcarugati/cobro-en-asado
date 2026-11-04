import * as Option from "effect/Option";
import { decodeGameSegments, gameCardLines } from "../../../../src/domain/game.ts";
import { renderCard } from "../../../../src/server/card.tsx";

export async function GET(request: Request, { params }: { params: Promise<{ share: string[] }> }) {
  const input = decodeGameSegments((await params).share);
  if (request.url.includes("?") || Option.isNone(input)) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, s-maxage=86400" } });
  }
  return renderCard("asado", gameCardLines(input.value), {
    headers: { "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable" },
  });
}
