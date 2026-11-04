import { readFile } from "node:fs/promises";
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
it.each([
  [PlanPage, planMetadata, "6/201901/202609", "/card/a/6/201901/202609", "Un asado para 6 sale $83.806. ¿Y el tuyo?"],
  [GamePage, gameMetadata, "8/10/42/202609", "/card/j/8/10/42/202609", "Alguien acertó 8 de 10. ¿Y vos?"],
] as const)("renders a bare shared page with metadata", async (page, metadata, path, image, title) => {
  const result = await page(params(path));
  expect(result.type).toBe("main");
  expect(result.props.children.props.children).toBe(title);
  expect(await metadata(params(path))).toMatchObject({ title, robots: { index: false, follow: true }, openGraph: { images: [{ url: image, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image", images: [{ url: image, width: 1200, height: 630 }] } });
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
