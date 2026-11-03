import { readdir, readFile } from "node:fs/promises";
import { expect, it } from "vitest";

// A count implies the pay, so nothing under src/components may ask for /c or /card before the tap on Compartir.
it("only the tap on Compartir can request anything", async () => {
  const root = new URL("../src/components/", import.meta.url);
  for (const name of await readdir(root, { recursive: true })) {
    const source = await readFile(new URL(name, root), "utf8").catch(() => "");
    expect(source, name).not.toMatch(/next\/link|<img|preload|prefetch/i);
    expect(source.match(/\bfetch\(/g)?.length ?? 0, name).toBe(name === "Share.tsx" ? 1 : 0);
    if (name !== "Share.tsx") continue;
    expect(source).not.toMatch(/useEffect\(\s*tap/);
    // The fetch lives in fetchThenSend, whose only caller is tap.
    expect(source.slice(source.indexOf("async function fetchThenSend"), source.indexOf("function tap()"))).toMatch(/\bfetch\(/);
    expect(source.match(/\bfetchThenSend\(/g)?.length).toBe(2);
    expect(source.match(/[ {]tap[(}]/g)).toEqual([" tap(", "{tap}"]);
    expect(source.slice(source.indexOf("function tap()"), source.indexOf("async function copyLink"))).toMatch(/\bfetchThenSend\(/);
  }
});
