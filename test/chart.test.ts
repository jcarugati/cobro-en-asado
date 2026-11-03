import { readFile } from "node:fs/promises";
import * as Option from "effect/Option";
import { describe, expect, it } from "vitest";
import { monthIndex } from "../src/domain/calc.ts";
import { chartData, monthAt, multipleTicks, rangeStart, rebase } from "../src/domain/chart.ts";
import { chartSummary, chartVerdict, formatMultiple } from "../src/domain/format.ts";
import { UNITS } from "../src/domain/units.ts";
import type { Snapshot } from "../src/domain/snapshot.ts";

const snapshot: Snapshot = JSON.parse(await readFile(new URL("./fixtures/snapshot-202609.json", import.meta.url), "utf8"));
const input = { unit: "asado", wage: "general", start: "201901" } as const;
const data = Option.getOrThrow(chartData(snapshot, input));

describe("chart series", () => {
  it("inverts monthIndex throughout the snapshot", () => {
    for (let i = 0; i < snapshot.ipc.length; i++) expect(Option.getOrThrow(monthIndex(snapshot, monthAt(snapshot, i)))).toBe(i);
    expect(monthAt(snapshot, 1)).toBe("201701");
  });
  it("rebases from the selected month to multiples starting at one", () => {
    expect(rebase([2, 4, 12], 1)).toEqual([1, 3]);
    expect(data.months[0]).toBe("201901");
    expect(data.months.at(-1)).toBe("202609");
    expect(data.product[0]).toBe(1);
    expect(data.ipc[0]).toBe(1);
    expect(data.wages[0]).toBe(1);
    expect(data.product.at(-1)).toBeCloseTo(16836.34 / 186.91, 10);
    expect(data.ipc.at(-1)).toBeCloseTo(12523.1733 / 189.1236, 10);
    expect(data.wages.at(-2)).toBeCloseTo(9973.55 / 175.19, 10);
    expect(data.wages.at(-1)).toBeNull();
    expect(data.product).toHaveLength(data.months.length);
    expect(data.ipc).toHaveLength(data.months.length);
    expect(data.wages).toHaveLength(data.months.length);
  });
  it("keeps own pay as a single multiple only for the matching start", () => {
    expect(data.own).toBeNull();
    const own = { month: "201901", oldPay: 30000, pay: 1200000 };
    expect(Option.getOrThrow(chartData(snapshot, { ...input, own })).own).toBe(40);
    expect(Option.getOrThrow(chartData(snapshot, { ...input, own: { ...own, month: "201902" } })).own).toBeNull();
  });
  it.each(["201611", "202610", "202608", "202609", "202613", "bad"])("refuses start %s", (start) => {
    expect(Option.isNone(chartData(snapshot, { ...input, start }))).toBe(true);
  });
  it("uses all three specified ranges", () => {
    expect(rangeStart(snapshot, "year")).toBe("202509");
    expect(rangeStart(snapshot, "since2019")).toBe("201901");
    expect(rangeStart(snapshot, "all")).toBe("201612");
  });
});

describe("multiple ticks", () => {
  it.each([
    [1, 1.52], [0.8, 1.8], [1, 2], [1, 4.9], [1, 5], [1, 100],
    [0.1, 1000], [1, 1e9], [0.0001, 66], [0.0001, 1e9], [0.0001, 0.001],
    [2, 2], [5, 5], [Number.MIN_VALUE, Number.MAX_VALUE],
  ])("covers [%s, %s] with at most eight ordered positive ticks including one", (min, max) => {
    const ticks = multipleTicks(min, max);
    expect(ticks[0]).toBeLessThanOrEqual(min);
    expect(ticks.at(-1)).toBeGreaterThanOrEqual(max);
    expect(ticks).toContain(1);
    expect(ticks.length).toBeLessThanOrEqual(8);
    ticks.forEach((tick, index) => {
      expect(Number.isFinite(tick) && tick > 0).toBe(true);
      if (index > 0) expect(tick).toBeGreaterThan(ticks[index - 1]!);
    });
  });
  it("uses the requested steps and switches to powers of ten", () => {
    expect(multipleTicks(1, 1.52)).toEqual([1, 1.25, 1.5, 1.75]);
    expect(multipleTicks(1, 4.1)).toEqual([1, 2, 3, 4, 5]);
    expect(multipleTicks(1, 50)).toEqual([1, 2, 5, 10, 20, 50]);
    expect(multipleTicks(0.2, 100)).toEqual([0.1, 1, 10, 100]);
  });
});

describe("chart copy", () => {
  it.each([
    [1, "x1,00"], [1.52, "x1,52"], [1.994, "x1,99"], [1.996, "x2,0"],
    [2, "x2,0"], [66.217, "x66,2"], [99.94, "x99,9"], [99.96, "x100"],
    [100, "x100"], [148.4, "x148"], [1234, "x1.234"],
  ])("formats %s as %s", (value, expected) => expect(formatMultiple(value)).toBe(expected));
  it("summarizes the real fixture including the wage's own last month", () => {
    expect(chartSummary(snapshot, data, "asado", "general")).toBe("Desde enero 2019: el asado x90,1, los precios en general x66,2 y los salarios x56,9 (hasta agosto 2026).");
  });
  it("omits the note when wages reach the last month", () => {
    const current = { ...snapshot, lastMonth: "202608", ipc: snapshot.ipc.slice(0, -1), prices: { ...snapshot.prices, asado: snapshot.prices.asado.slice(0, -1) } };
    const chart = Option.getOrThrow(chartData(current, input));
    expect(chartSummary(current, chart, "asado", "general")).toBe(`Desde enero 2019: el asado ${formatMultiple(current.prices.asado.at(-1)! / 186.91)}, los precios en general ${formatMultiple(current.ipc.at(-1)! / 189.1236)} y los salarios x56,9.`);
  });
  it.each([
    ["yerba", "privado", "201901", "Desde enero 2019: la yerba x43,3, los precios en general x66,2 y los privados registrados x57,4 (hasta agosto 2026)."],
    ["fideos", "publico", "201901", "Desde enero 2019: los fideos x41,5, los precios en general x66,2 y los públicos x48,6 (hasta agosto 2026)."],
    ["panales", "noRegistrado", "201901", "Desde enero 2019: los pañales x55,4, los precios en general x66,2 y los no registrados x67,8 (hasta agosto 2026)."],
    ["vino", "general", "202607", "Desde julio 2026: el vino x0,99, los precios en general x1,04 y los salarios x1,03 (hasta agosto 2026)."],
  ] as const)("summarizes %s with %s since %s", (unit, wage, start, expected) => {
    const chart = Option.getOrThrow(chartData(snapshot, { unit, wage, start }));
    expect(chartSummary(snapshot, chart, unit, wage)).toBe(expected);
  });
});

describe("chart verdict", () => {
  it.each([
    ["asado", "general", "¿Los salarios le ganaron al asado?", "No"],
    ["yerba", "privado", "¿Los privados registrados le ganaron a la yerba?", "Sí"],
    ["fideos", "publico", "¿Los públicos les ganaron a los fideos?", "Sí"],
  ] as const)("asks about %s using %s", (unit, wage, question, answer) => {
    const chart = Option.getOrThrow(chartData(snapshot, { ...input, unit, wage }));
    expect(chartVerdict(chart, unit, wage)).toEqual({ question, answer });
  });
  it.each(UNITS)("contracts the article and agrees the pronoun for $slug", ({ slug }) => {
    const chart = Option.getOrThrow(chartData(snapshot, { ...input, unit: slug }));
    const { question } = chartVerdict(chart, slug, "general");
    expect(question).not.toContain("a el ");
    expect(question).toContain(["huevos", "fideos", "panales"].includes(slug) ? "les ganaron" : "le ganaron");
  });
  it.each([
    [[1, 2, 4], [1, 3, null], "Sí"],
    [[1, 4, 2], [1, 3, null], "No"],
    [[1, 2.01, 4], [1, 2.04, null], "Empate"],
  ] as const)("compares products %j and wages %j at their common month", (product, wages, answer) => {
    const chart = {
      months: ["202607", "202608", "202609"],
      product: [...product], wages: [...wages], ipc: [1, 2, 3], own: null,
    };
    expect(chartVerdict(chart, "asado", "general").answer).toBe(answer);
  });
});
