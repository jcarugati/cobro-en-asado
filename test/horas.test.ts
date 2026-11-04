import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it } from "vitest";
import { Calculator } from "../src/components/Calculator.tsx";
import { rememberHours, rememberPay, typedHours } from "../src/components/memory.ts";
import { RaceChart } from "../src/components/RaceChart.tsx";
import type { Snapshot } from "../src/domain/snapshot.ts";
import { formatHoursPerDay, HOURS_PER_MONTH } from "../src/domain/worktime.ts";

const snapshot: Snapshot = JSON.parse(await readFile(new URL("./fixtures/snapshot-202609.json", import.meta.url), "utf8"));
const toggle = (html: string) => html.slice(html.indexOf('aria-label="Ver el resultado"') - 60, html.indexOf("En kilos"));

afterEach(() => {
  rememberPay("");
  rememberHours(HOURS_PER_MONTH);
});

it.each([[176, "8"], [160, "7,3"], [165, "7,5"], [744, "33,8"], [1, "0,1"]])("%s hours a month is %s a day", (hours, text) => {
  expect(formatHoursPerDay(hours)).toBe(text);
});

it("the toggle is hidden and gives up its phone row until there is a typed pay", () => {
  const empty = toggle(renderToStaticMarkup(createElement(Calculator, { snapshot })));
  expect(empty).toContain("visibility:hidden");
  expect(empty).toContain("view-none");
  rememberPay("1.200.000");
  const typed = toggle(renderToStaticMarkup(createElement(Calculator, { snapshot })));
  expect(typed).not.toContain("visibility:hidden");
  expect(typed).not.toContain("view-none");
});

it("the server sends the chart's plate and not the chart", () => {
  const html = renderToStaticMarkup(createElement(Calculator, { snapshot }));
  expect(html).toContain("chart-wait");
  expect(html).not.toContain("plot-frame");
});

it("the view starts in kilos and the product list waits for its first open", () => {
  rememberPay("1.200.000");
  const html = renderToStaticMarkup(createElement(Calculator, { snapshot }));
  expect(html).toContain("Cobrás 71 kilos de asado.");
  expect(html).not.toContain("Calculamos con");
  expect(html).not.toContain('class="times"');
});

it("the hours start at the default and are remembered like the pay", () => {
  expect(typedHours()).toBe(HOURS_PER_MONTH);
  rememberHours(160);
  expect(typedHours()).toBe(160);
});

it("a chart that mounts with a month already chosen starts on that month", () => {
  const past = { month: "201901", oldPay: 30000, pay: 1200000, unitsThen: 273, unitsNow: 71 };
  const html = renderToStaticMarkup(createElement(RaceChart, { snapshot, unit: "asado", past, overridden: false }));
  expect(html).toMatch(/aria-pressed="true"[^>]*>Desde enero 2019/);
});
