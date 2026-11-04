import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it } from "vitest";
import { Calculator, punchLines } from "../src/components/Calculator.tsx";
import { rememberPay } from "../src/components/memory.ts";
import { activeTab } from "../src/components/Nav.tsx";
import { Share } from "../src/components/Share.tsx";
import type { Snapshot } from "../src/domain/snapshot.ts";

const snapshot: Snapshot = JSON.parse(await readFile(new URL("./fixtures/snapshot-202609.json", import.meta.url), "utf8"));
const target = { path: "/c/p/asado/71/452/202609", card: "/card/p/asado/71/452/202609", text: "" };

it.each([
  ["/", "/"],
  ["/c/p/asado/71/452/202609", "/"],
  ["/asado", "/asado"],
  ["/c/a/x", "/asado"],
  ["/juego", "/juego"],
  ["/c/j/x", "/juego"],
  ["/no-existe", "/"],
])("%s activates the tab %s", (pathname, tab) => {
  expect(activeTab(pathname)).toBe(tab);
});

it.each([
  ["a price within the workday gets the clock", 2 + 28 / 60, ["Entrás a\u00a0las\u00a09.", "A las 11:28 ya pagaste 1\u00a0kilo de asado."]],
  ["a price past the workday gets its length", 90, ["Eso es 11\u00a0días y 2\u00a0h de laburo."]],
  ["a price under a minute gets no line", 0.001, []],
])("%s", (_, hours, lines) => {
  expect(punchLines("asado", hours, 176)).toEqual(lines);
});

it("Share keeps today's output by default", () => {
  const html = renderToStaticMarkup(createElement(Share, { target, comparing: true }));
  expect(html).toContain("Con una calculadora");
  expect(html).toContain('aria-describedby="share-warning"');
  expect(html).toContain("Compartir la comparación");
});

it("Share takes a label, and drops the warning for a result that implies no pay", () => {
  const html = renderToStaticMarkup(createElement(Share, { target, comparing: false, label: "Compartir la lista", warning: false }));
  expect(html).not.toContain("Con una calculadora");
  expect(html).not.toContain("aria-describedby");
  expect(html).toContain("Compartir la lista");
});

// The memory is module state, shared across this file.
afterEach(() => rememberPay(""));

it("Calculator starts from the remembered pay, parsed as if typed", () => {
  rememberPay("1.200.000");
  const html = renderToStaticMarkup(createElement(Calculator, { snapshot }));
  expect(html).toContain('value="1.200.000"');
  // The big number counts up from 0 in the browser, so the server output has the count in the sentence for screen readers.
  expect(html).toContain("Cobrás 71 kilos de asado.");
});

it("Calculator starts empty with nothing remembered", () => {
  const html = renderToStaticMarkup(createElement(Calculator, { snapshot }));
  expect(html).not.toContain('value="1.200.000"');
  expect(html).not.toContain("Cobrás 71");
});

it.each(["memory.ts", "Calculator.tsx"])("%s never touches browser storage", async (name) => {
  expect(await readFile(new URL(`../src/components/${name}`, import.meta.url), "utf8")).not.toMatch(/Storage|cookie/);
});

it("Calculator writes the typed pay to the memory", async () => {
  expect(await readFile(new URL("../src/components/Calculator.tsx", import.meta.url), "utf8")).toContain("rememberPay(text)");
});
