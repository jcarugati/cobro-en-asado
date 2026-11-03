import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { GET } from "../app/card/[...share]/route.tsx";

afterEach(() => vi.unstubAllGlobals());

// next/og bootstraps its local WASM through fetch before falling back to fs in Node.
beforeAll(async () => {
  const response = await GET(new Request("https://example.org/card/p/asado/71/452/202609"), { params: Promise.resolve({ share: ["p", "asado", "71", "452", "202609"] }) });
  await response.arrayBuffer();
});

it("renders a real PNG with immutable caching without fetching", async () => {
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Card must never fetch"); }));
  const response = await GET(new Request("https://example.org/card/p/asado/71/452/202609"), { params: Promise.resolve({ share: ["p", "asado", "71", "452", "202609"] }) });
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("image/png");
  expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, s-maxage=31536000, immutable");
  expect([...new Uint8Array(await response.arrayBuffer()).slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(fetch).not.toHaveBeenCalled();
});

it.each([
  ["x/y", ""], ["p/asado/071/452/202609", ""], ["p/unknown/71/452/202609", ""],
  ["p/asado/71/452/202609", "?x=1"],
])("rejects %s%s without fetching", async (path, query) => {
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Card must never fetch"); }));
  const response = await GET(new Request(`https://example.org/card/${path}${query}`), { params: Promise.resolve({ share: path.split("/") }) });
  expect(response.status).toBe(404);
  expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=86400");
  expect(fetch).not.toHaveBeenCalled();
});
