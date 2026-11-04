import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, expect, it, vi } from "vitest";
import PlanPage, { generateMetadata as planMetadata, generateStaticParams as planParams } from "../app/c/a/[...share]/page.tsx";
import GamePage, { generateMetadata as gameMetadata, generateStaticParams as gameParams } from "../app/c/j/[...share]/page.tsx";
import { loadSnapshot } from "../src/server/loadSnapshot.ts";
vi.mock("../src/server/loadSnapshot.ts", () => ({ loadSnapshot: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("404"); } }));
const params = (path: string) => ({ params: Promise.resolve({ share: path.split("/") }) });
beforeAll(async () => {
  vi.mocked(loadSnapshot).mockResolvedValue(JSON.parse(await readFile(new URL("./fixtures/snapshot-202609.json", import.meta.url), "utf8")));
});
it("starts a shared plan from an older link's people and month, and prices it today", async () => {
  const html = renderToStaticMarkup(await PlanPage(params("7/201812/202608")));
  expect(html).toContain('class="shared">Te pasaron un asado para\u00a07. Armá el tuyo:</p>');
  expect(html).toContain('<span>7</span>');
  expect(html).toContain("Un asado para 7 sale");
  expect(html).toMatch(/<option value="12" selected/);
  expect(html).toMatch(/<option value="2018" selected/);
  expect(html).toContain(">99.116<");
  expect(html).toContain("Promedio GBA · septiembre 2026 · INDEC");
  // The link's own month keeps its own price, and it only lives in the preview.
  expect(html).not.toContain("97.882");
});
it("keeps the link's own price in the preview, pinned with its card", async () => {
  const image = { url: "/card/a/7/201812/202608", width: 1200, height: 630 };
  expect(await planMetadata(params("7/201812/202608"))).toMatchObject({ title: "Un asado para 7 sale $97.882. ¿Y el tuyo?", robots: { index: false, follow: true }, openGraph: { images: [image] }, twitter: { card: "summary_large_image", images: [image] } });
});
it("plays the link's game and keeps the metadata", async () => {
  const title = "Alguien acertó 8 de 10. ¿Y vos?";
  const image = { url: "/card/j/8/10/42/202609", width: 1200, height: 630 };
  const result = await GamePage(params("8/10/42/202609"));
  expect(result.props).toMatchObject({ seed: 42, month: "202609", shared: { score: 8, total: 10, seed: 42, month: "202609" } });
  expect(await gameMetadata(params("8/10/42/202609"))).toMatchObject({ title, robots: { index: false, follow: true }, openGraph: { images: [image] }, twitter: { card: "summary_large_image", images: [image] } });
  expect(renderToStaticMarkup(result)).toContain(title);
});
it.each([
  [PlanPage, planMetadata, "06/201901/202609"], [PlanPage, planMetadata, "6/201901/209912"],
  [GamePage, gameMetadata, "11/10/42/202609"], [GamePage, gameMetadata, "8/10/42/201612"], [GamePage, gameMetadata, "8/10/42/209912"],
] as const)("rejects invalid shared pages and metadata", async (page, metadata, path) => {
  await expect(page(params(path))).rejects.toThrow("404");
  await expect(metadata(params(path))).rejects.toThrow("404");
});
it("leaves shared pages for ISR", async () => {
  expect(await planParams()).toEqual([]);
  expect(await gameParams()).toEqual([]);
});
