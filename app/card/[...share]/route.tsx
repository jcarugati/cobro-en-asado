import * as Option from "effect/Option";
import { cardLines, decodeShareSegments } from "../../../src/domain/share.ts";
import { renderCard } from "../../../src/server/card.tsx";

export async function GET(request: Request, { params }: { params: Promise<{ share: string[] }> }) {
  const result = decodeShareSegments((await params).share);
  if (request.url.includes("?") || Option.isNone(result)) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, s-maxage=86400" } });
  }
  return renderCard(cardLines(result.value), {
    headers: { "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable" },
  });
}
