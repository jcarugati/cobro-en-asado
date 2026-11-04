import { readFile } from "node:fs/promises";
import * as Result from "effect/Result";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it } from "vitest";
import { AsadoPlanner } from "../src/components/AsadoPlanner.tsx";
import { rememberPay } from "../src/components/memory.ts";
import { planAsado, planCardLines, planShareTarget } from "../src/domain/planner.ts";
import type { Snapshot } from "../src/domain/snapshot.ts";

const snapshot: Snapshot = JSON.parse(await readFile(new URL("./fixtures/snapshot-202609.json", import.meta.url), "utf8"));
const render = () => renderToStaticMarkup(createElement(AsadoPlanner, { snapshot }));

afterEach(() => rememberPay(""));

it("opens on an asado for 6 against enero 2019, with no work line", () => {
  const html = render();
  expect(html).toContain("Un asado para 6 sale");
  expect(html).toContain(">83.806<");
  expect(html).toContain('Mismo asado en enero 2019: <span class="plan-then-price">$1.122</span>');
  expect(html).toContain("x74,7");
  expect(html).toContain("Promedio GBA · septiembre 2026 · INDEC");
  expect(html).toContain('aria-label="Una persona menos"');
  expect(html).not.toContain("de laburo.");
  expect(html).toContain("Así te decimos cuánto laburo te lleva.");
});

it("says what each person pays, in the live sentence too, and not with one person or in what gets shared", () => {
  const html = render();
  expect(html).toContain('class="plan-head">$13.968 por cabeza</p>');
  expect(html).toContain('aria-live="polite">Un asado para 6 sale $83.806. $13.968 por cabeza.</p>');
  const plan = Result.getOrThrow(planAsado(snapshot, { people: 1, thenMonth: "201901", month: "202609" }));
  const alone = renderToStaticMarkup(createElement(AsadoPlanner, { snapshot, shared: plan }));
  expect(alone).toContain('aria-live="polite">Un asado para 1 sale $21.429.</p>');
  expect(alone).not.toContain("por cabeza");
  const six = Result.getOrThrow(planAsado(snapshot, { people: 6, thenMonth: "201901", month: "202609" }));
  expect(JSON.stringify([planCardLines(six), planShareTarget(six)])).not.toContain("cabeza");
});

it("prices the work from the remembered pay, stating the assumption", () => {
  rememberPay("1.200.000");
  const html = render();
  expect(html).toContain("Te lleva 1 día y 4 h de laburo.");
  expect(html).toContain("Con 176 horas por mes (8 h × 22 días).");
  expect(html).not.toContain("Así te decimos");
});

it("generates the rations from the constants and prints the true total", () => {
  const html = render();
  expect(html).toContain("Gaseosa: 300 ml por persona");
  expect(html).toContain("<tfoot><tr><th scope=\"row\">Total</th><td>$83.806</td><td>$1.122</td></tr></tfoot>");
});
