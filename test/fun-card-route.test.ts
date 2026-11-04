import { readFile } from "node:fs/promises";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { GET as planCard } from "../app/card/a/[...share]/route.tsx";
import { GET as gameCard } from "../app/card/j/[...share]/route.tsx";
import { loadSnapshot } from "../src/server/loadSnapshot.ts";
vi.mock("../src/server/loadSnapshot.ts", () => ({ loadSnapshot: vi.fn() }));
const snapshot = JSON.parse(await readFile(new URL("./fixtures/snapshot-202609.json", import.meta.url), "utf8"));
const params = (path: string) => ({ params: Promise.resolve({ share: path.split("/") }) });
afterEach(() => vi.unstubAllGlobals());
beforeAll(async () => {
  vi.mocked(loadSnapshot).mockResolvedValue(snapshot);
  const response = await gameCard(new Request("https://example.org/card/j/8/10/42/202609"), params("8/10/42/202609"));
  await response.arrayBuffer();
});
it.each([
  ["a", planCard, "6/201901/202609"], ["a", planCard, "100/201901/202609"], ["j", gameCard, "8/10/42/202609"],
] as const)("renders %s/%s/%s as a real PNG without fetching", async (kind, get, path) => {
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Card must never fetch"); }));
  const response = await get(new Request(`https://example.org/card/${kind}/${path}`), params(path));
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("image/png");
  expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, s-maxage=31536000, immutable");
  expect([...new Uint8Array(await response.arrayBuffer()).slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(fetch).not.toHaveBeenCalled();
});
it.each([
  [planCard, "0/201901/202609", ""], [planCard, "06/201901/202609", ""], [planCard, "6/201901/209912", ""],
  [planCard, "6/201901/202609", "?x=1"], [gameCard, "11/10/42/202609", ""], [gameCard, "8/10/42/202609", "?x=1"],
] as const)("rejects bad card %s/%s%s", async (get, path, query) => {
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Card must never fetch"); }));
  const response = await get(new Request(`https://example.org/card/${path}${query}`), params(path));
  expect(response.status).toBe(404);
  expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=86400");
  expect(fetch).not.toHaveBeenCalled();
});
