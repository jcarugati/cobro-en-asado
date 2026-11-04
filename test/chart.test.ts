import { readFile } from "node:fs/promises";
import * as Option from "effect/Option";
import { describe, expect, it } from "vitest";
import { monthIndex } from "../src/domain/calc.ts";
import { chartData, freeSpanStart, monthAt, monthTicks, multipleTicks, rangeStart, rebase, spreadLabels, type ChartData } from "../src/domain/chart.ts";
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

describe("month ticks", () => {
  const months = (first: number, length: number) => Array.from({ length }, (_, index) => monthAt(snapshot, first + index));
  it("names odd years on a long range", () => {
    const { step, indexes } = monthTicks(months(0, 118));
    expect(step).toBe(24);
    expect(indexes.map((index) => monthAt(snapshot, index))).toEqual(["201701", "201901", "202101", "202301", "202501"]);
  });
  it("names each January on a middle range", () => {
    const list = months(83, 35);
    expect(monthTicks(list).step).toBe(12);
    expect(monthTicks(list).indexes.map((index) => list[index])).toEqual(["202401", "202501", "202601"]);
  });
  it("names quarters on a year and every month on a few", () => {
    const year = months(105, 13);
    expect(monthTicks(year).step).toBe(3);
    expect(monthTicks(year).indexes.map((index) => year[index])).toEqual(["202510", "202601", "202604", "202607"]);
    expect(monthTicks(months(115, 3))).toEqual({ step: 1, indexes: [0, 1, 2] });
  });
});

describe("end label spreading", () => {
  it("leaves labels that already fit alone", () => {
    expect(spreadLabels([10, 50, 90], 6)).toEqual([10, 50, 90]);
  });
  it("opens a gap and keeps the input order", () => {
    expect(spreadLabels([12, 10, 30], 6)).toEqual([16, 10, 30]);
  });
  it("stays inside the plot at both ends", () => {
    expect(spreadLabels([99, 100, 100], 6)).toEqual([88, 94, 100]);
    expect(spreadLabels([-3, 0], 6)).toEqual([0, 6]);
  });
});

describe("free span", () => {
  it("finds the largest empty stretch wherever it is", () => {
    expect(freeSpanStart([5, 13, 21])).toBe(21);
    expect(freeSpanStart([5, 13, 95])).toBe(13);
    expect(freeSpanStart([60, 70, 80])).toBe(0);
    expect(freeSpanStart([40, 5])).toBe(40);
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
    ["yerba", "privado", "201901", "Desde enero 2019: la yerba x43,3, los precios en general x66,2 y los salarios privados registrados x57,4 (hasta agosto 2026)."],
    ["fideos", "publico", "201901", "Desde enero 2019: los fideos x41,5, los precios en general x66,2 y los salarios públicos x48,6 (hasta agosto 2026)."],
    ["panales", "noRegistrado", "201901", "Desde enero 2019: los pañales x55,4, los precios en general x66,2 y los salarios no registrados x67,8 (hasta agosto 2026)."],
    ["vino", "general", "202607", "Desde julio 2026: el vino x0,99, los precios en general x1,04 y los salarios x1,03 (hasta agosto 2026)."],
  ] as const)("summarizes %s with %s since %s", (unit, wage, start, expected) => {
    const chart = Option.getOrThrow(chartData(snapshot, { unit, wage, start }));
    expect(chartSummary(snapshot, chart, unit, wage)).toBe(expected);
  });
});

describe("chart verdict", () => {
  it.each([
    ["asado", "general", "¿Los salarios le ganaron al asado?", "No"],
    ["yerba", "privado", "¿Los salarios privados registrados le ganaron a la yerba?", "Sí"],
    ["fideos", "publico", "¿Los salarios públicos les ganaron a los fideos?", "Sí"],
    ["panales", "noRegistrado", "¿Los salarios no registrados les ganaron a los pañales?", "Sí"],
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
    [[1, 2, 4], [1, 3, null], "Empate"],
    [[1, 4, 2], [1, 3, null], "Empate"],
    [[1, 2.01, 4], [1, 2.04, null], "Empate"],
    [[1, 4, 2.01], [1, 2.04, null], "Empate"],
    [[1, 3, 1], [1, 3, null], "Empate"],
    [[1, 2, 2.5], [1, 3, null], "Sí"],
    [[1, 4, 3.5], [1, 3, null], "No"],
  ] as const)("compares common and shown products %j with wages %j", (product, wages, answer) => {
    const chart: ChartData = {
      months: ["202607", "202608", "202609"],
      product: [...product], wages: [...wages], ipc: [1, 2, 3], own: null,
    };
    expect(chartVerdict(chart, "asado", "general").answer).toBe(answer);
  });
  it("leaves leche since January 2019 undecided while wages lag its shown price", () => {
    const chart = Option.getOrThrow(chartData(snapshot, { ...input, unit: "leche" }));
    expect(chartVerdict(chart, "leche", "general").answer).toBe("Empate");
  });
});
