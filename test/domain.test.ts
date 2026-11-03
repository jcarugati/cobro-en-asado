import { readFile, readdir } from "node:fs/promises";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { describe, expect, it } from "vitest";
import { altUnitOf, canastaShare, checkPastMonth, comparePast, monthIndex, priceAt, tally, unitsFor } from "../src/domain/calc.ts";
import { countPhrase, formatCount, formatPercent, formatPesos, monthLabel, monthWithDe, ownMonthNote, pastLines, priceMoveLine, unitLabel } from "../src/domain/format.ts";
import { parsePay, withDots } from "../src/domain/pay.ts";
import { decodeShareSegments, encodeSharePath, type ShareResult } from "../src/domain/share.ts";
import type { Snapshot } from "../src/domain/snapshot.ts";
import { UNITS, type UnitSlug } from "../src/domain/units.ts";

const snapshot: Snapshot = JSON.parse(await readFile(new URL("./fixtures/snapshot-202609.json", import.meta.url), "utf8"));
const price = (unit: UnitSlug, month = snapshot.lastMonth) => Option.getOrThrow(priceAt(snapshot, unit, month));
const comparison = () => Result.getOrThrow(comparePast(snapshot, { unit: "asado", pay: 1200000, oldPay: 30000, month: "201901" }));

describe("pay parser", () => {
  it.each([
    ["1200000", "1.200.000"], ["1.200.000", "1.200.000"], ["$ 1200000", "1.200.000"], ["800", "800"], ["1000000000000", "1.000.000.000.000"],
    ["1200000,50", "1200000,50"], ["1200,00", "1200,00"], ["800 mil", "800 mil"], ["1.2", "1.2"], ["0", "0"], ["", ""],
  ])("on blur shows %j as %j", (input, shown) => expect(withDots(input)).toBe(shown));
  it.each([
    ["1.200.000", 1200000], ["1200000", 1200000], ["$ 1.200.000", 1200000],
    ["1.200.000,50", 1200000.5], ["1200000,5", 1200000.5], ["1.200", 1200],
    [" \u00a0$\u00a01.200.000 \n", 1200000], ["0,01", 0.01], ["1000000000000", 1e12],
  ])("parses %s", (input, value) => expect(parsePay(input)).toEqual(Result.succeed(value)));
  it.each(["", " \u00a0", "$", " $ \t"])("refuses empty %j", (input) => expect(parsePay(input)).toEqual(Result.fail("empty")));
  it.each(["1,200,000", "1.2", "12.34", "1.2000", "abc", "-5", "0", "0,00", "1000000000000,01", "1,234", "1e3", "+1", "$$1", "1$", "1.000,", "Infinity",
    "1 2", "1\n200", "1, 20", "120000 80000", "1 200 000", "0.500", "0.001", "007",
  ])("refuses invalid %s", (input) => expect(parsePay(input)).toEqual(Result.fail("invalid")));
});

describe("fixture acceptance values", () => {
  it("converts current pay and presets without rounding", () => {
    expect(unitsFor(1200000, price("asado"))).toBeCloseTo(71.3, 1);
    expect(unitsFor(1200000, price("yerba"))).toBeCloseTo(452.4, 1);
    expect(canastaShare(snapshot, 1200000) * 100).toBeCloseTo(73.5, 1);
    expect(unitsFor(snapshot.presets.cbtHogar2.value, price("asado"))).toBeCloseTo(97.0, 1);
    expect(unitsFor(snapshot.presets.crianzaMenor1.value, price("asado"))).toBeCloseTo(33.9, 1);
    expect(unitsFor(10, 3)).toBe(10 / 3);
  });
  it("compares historical pay using GBA IPC", () => {
    const result = comparison();
    const then = Option.getOrThrow(monthIndex(snapshot, "201901"));
    expect(result.unitsThen).toBeCloseTo(160.5, 1);
    expect(result.unitsNow).toBe(1200000 / price("asado"));
    expect(result.unitChange).toBe(result.unitsNow / result.unitsThen - 1);
    expect(snapshot.ipc[then]).toBe(189.1236);
    expect(snapshot.ipc.at(-1)).toBe(12523.1733);
    expect(snapshot.ipc.at(-1)! / snapshot.ipc[then]!).toBeCloseTo(66.217, 3);
    expect(Math.round(result.breakEven)).toBe(1986506);
    expect(result.realChange * 100).toBeCloseTo(-39.59, 2);
    expect(result.worst.unit).toBe("carne-picada");
    expect(result.worst.priceChange).toBeCloseTo(93.369, 3);
    expect(result.best.unit).toBe("fideos");
    expect(result.best.priceChange).toBeCloseTo(40.544, 3);
  });
  it("ranks the same at extreme amounts, where the change in units is -1 to within rounding", () => {
    const result = Result.getOrThrow(comparePast(snapshot, { unit: "asado", pay: 0.01, oldPay: 1e12, month: "201901" }));
    expect(result.worst).toEqual(comparison().worst);
    expect(result.best).toEqual(comparison().best);
    expect(result.worst.unit).toBe("carne-picada");
    expect(result.best.unit).toBe("fideos");
  });
  it("excludes seasonal units even when they are extreme", () => {
    const modified = structuredClone(snapshot);
    modified.prices.papa[25] = 1e12;
    modified.prices.cebolla[25] = 0.0001;
    const result = Result.getOrThrow(comparePast(modified, { unit: "asado", pay: 1200000, oldPay: 30000, month: "201901" }));
    expect(result.worst).toEqual(comparison().worst);
    expect(result.best).toEqual(comparison().best);
  });
});

describe("months and alternate units", () => {
  it.each([
    ["201612", "ok"], ["201611", "tooEarly"], ["202608", "ok"], ["202609", "tooLate"],
    ["202610", "tooLate"], ["201913", "invalid"], ["abc", "invalid"], ["201900", "invalid"],
  ])("checks %s", (month, expected) => {
    const result = checkPastMonth(snapshot, month);
    expect(result).toEqual(expected === "ok" ? Result.succeed(month) : Result.fail(expected));
    if (expected !== "ok") expect(comparePast(snapshot, { unit: "asado", pay: 1200000, oldPay: 30000, month })).toEqual(Result.fail(expected));
  });
  it("finds exact indices and refuses missing or malformed months", () => {
    expect(monthIndex(snapshot, "201612")).toEqual(Option.some(0));
    expect(monthIndex(snapshot, "201901")).toEqual(Option.some(25));
    expect(monthIndex(snapshot, "202609")).toEqual(Option.some(117));
    for (const month of ["201611", "202610", "201913", "202600", "2026-09", "abc", "202609\n"]) {
      expect(monthIndex(snapshot, month)).toEqual(Option.none());
      expect(priceAt(snapshot, "asado", month)).toEqual(Option.none());
    }
  });
  it("selects yerba for asado and asado for every other unit", () => {
    for (const unit of UNITS) expect(altUnitOf(unit.slug)).toBe(unit.slug === "asado" ? "yerba" : "asado");
  });
});

it.each<[number, number[], number]>([
  [0, [], 0], [1, [1], 0], [5, [5], 0], [71, [...Array<number>(14).fill(5), 1], 0],
  [100, Array<number>(20).fill(5), 0], [101, Array<number>(20).fill(5), 1], [123, Array<number>(20).fill(5), 23],
  [0.49, [], 0], [0.5, [1], 0], [71.5, [...Array<number>(14).fill(5), 2], 0],
  [100.5, Array<number>(20).fill(5), 1], [-3, [], 0],
])("tallies %s", (count, groups, overflow) => {
  expect(tally(count)).toEqual({ groups, overflow });
});

it("formats deterministic Argentine text with rounding and NBSP", () => {
  expect(monthLabel("202609")).toBe("septiembre 2026");
  expect(monthLabel("201901")).toBe("enero 2019");
  expect(monthLabel("201612")).toBe("diciembre 2016");
  expect(formatCount(1234.4)).toBe("1.234");
  expect(formatCount(1234.5)).toBe("1.235");
  expect(formatPesos(comparison().breakEven)).toBe("$1.986.506");
  expect(formatPercent(0.735)).toBe("73,5\u00a0%");
  expect(formatPercent(-0.3959)).toBe("39,6\u00a0%");
  expect(formatPercent(12.2511)).toBe("1.225,1\u00a0%");
  expect(countPhrase("asado", 71.3)).toBe("71 kilos de asado");
  expect(countPhrase("asado", 1.4)).toBe("1 kilo de asado");
  expect(countPhrase("asado", 0)).toBe("0 kilos de asado");
  expect(countPhrase("asado", 0.5)).toBe("1 kilo de asado");
  expect(countPhrase("asado", 1.5)).toBe("2 kilos de asado");
  expect(countPhrase("lavandina", 869)).toBe("869 lavandinas");
  expect(countPhrase("asado", 1234)).toBe("1.234 kilos de asado");
});

it("builds the small copy helpers", () => {
  expect(monthWithDe("201901")).toBe("enero de 2019");
  expect(ownMonthNote("202609", "202609")).toBe("");
  expect(ownMonthNote("202608", "202609")).toBe(" (agosto de 2026)");
  expect(unitLabel("asado", 1.4)).toBe("kilo de asado");
  expect(unitLabel("asado", 71)).toBe("kilos de asado");
});

describe("past comparison copy", () => {
  const worst = { unit: "carne-picada", priceChange: 1 } as const;
  const best = { unit: "fideos", priceChange: 0.1 } as const;
  const base = { unitsThen: 161, unitsNow: 71, unitChange: 0, breakEven: 1986506, realChange: -0.396, worst, best };
  it("matches the agreed lines on the acceptance case", () => {
    const result = comparePast(snapshot, { unit: "asado", pay: 1200000, oldPay: 30000, month: "201901" });
    expect(pastLines("asado", "201901", Result.getOrThrow(result))).toEqual([
      "En enero de 2019 eran 161 kilos de asado. Hoy, 71.",
      "Para empatar con los precios en general, hoy tendrías que cobrar $1.986.506. Estás un 39,6\u00a0% abajo.",
      "Sin contar verduras, lo que más subió: carne picada. Lo que menos subió: fideos.",
    ]);
  });
  it("says arriba when real change is positive", () => {
    expect(pastLines("asado", "201901", { ...base, realChange: 0.12 })[1]).toContain("Estás un 12,0\u00a0% arriba.");
  });
  it.each([0, 0.0004, -0.0004])("says so plainly when %s rounds to zero", (realChange) => {
    expect(pastLines("asado", "201901", { ...base, realChange })[1]).toContain("Estás igual: ni arriba ni abajo.");
  });
  it("agrees in the singular", () => {
    expect(pastLines("asado", "201901", { ...base, unitsThen: 1.2 })[0]).toBe("En enero de 2019 era 1 kilo de asado. Hoy, 71.");
  });
});

describe("price move sentence", () => {
  const lineFor = (from: Snapshot, month: string) => {
    const { worst, best } = Result.getOrThrow(comparePast(from, { unit: "asado", pay: 1200000, oldPay: 30000, month }));
    return { worst, best, line: priceMoveLine(worst, best) };
  };
  it("names a price that fell as falling", () => {
    expect(lineFor(snapshot, "202603").line).toBe("Sin contar verduras, lo que más subió: queso. Lo que más bajó: asado.");
    expect(lineFor(snapshot, "202603").best.priceChange * 100).toBeCloseTo(-5.3, 1);
  });
  it("uses both falling verbs when every price fell", () => {
    // The fixture has no such month, so the last month drops every price from the one before, each by a different amount.
    const prices = Object.fromEntries(UNITS.map((unit, index) => {
      const series = snapshot.prices[unit.slug];
      return [unit.slug, [...series.slice(0, -1), series.at(-2)! * (0.7 + index / 100)]];
    })) as Snapshot["prices"];
    expect(lineFor({ ...snapshot, prices }, "202608").line).toBe("Sin contar verduras, lo que menos bajó: desodorante. Lo que más bajó: asado.");
  });
  it.each([
    [0, -0.1, "Sin contar verduras, lo que no cambió: queso. Lo que más bajó: asado."],
    [0.1, 0, "Sin contar verduras, lo que más subió: queso. Lo que no cambió: asado."],
    [0, 0, "Sin contar verduras, ningún precio cambió."],
  ])("does not claim a move for a flat price (%s, %s)", (top, bottom, line) => {
    expect(priceMoveLine({ unit: "queso", priceChange: top }, { unit: "asado", priceChange: bottom })).toBe(line);
  });
  it("is true to the raw prices in every month of the fixture", () => {
    const months = snapshot.ipc.slice(0, -1).map((_, index) => {
      const total = 2016 * 12 + 11 + index;
      return `${Math.floor(total / 12)}${String(total % 12 + 1).padStart(2, "0")}`;
    });
    expect(months).toHaveLength(117);
    for (const month of months) {
      const { worst, best, line } = lineFor(snapshot, month);
      const moved = (slug: UnitSlug) => price(slug) / price(slug, month) - 1;
      expect(worst.priceChange, month).toBeCloseTo(moved(worst.unit), 10);
      expect(best.priceChange, month).toBeCloseTo(moved(best.unit), 10);
      for (const unit of UNITS.filter((item) => !item.seasonal)) {
        expect(moved(unit.slug), `${month} ${unit.slug}`).toBeLessThanOrEqual(worst.priceChange + 1e-12);
        expect(moved(unit.slug), `${month} ${unit.slug}`).toBeGreaterThanOrEqual(best.priceChange - 1e-12);
      }
      expect(line, month).toContain(moved(worst.unit) > 0 ? "lo que más subió:" : "lo que menos bajó:");
      expect(line, month).toContain(moved(best.unit) < 0 ? "Lo que más bajó:" : "Lo que menos subió:");
    }
  });
});

describe("share paths", () => {
  const pay: ShareResult = { kind: "p", unit: "asado", count: 71, altCount: 452, month: "202609" };
  it.each<ShareResult>([pay, { ...pay, kind: "o" }, { kind: "t", unit: "asado", thenCount: 161, nowCount: 71, thenMonth: "201901", month: "202609" }])("round trips $kind", (result) => {
    const path = Option.getOrThrow(encodeSharePath(result));
    expect(path).toBe(result.kind === "t" ? "/c/t/asado/161/71/201901/202609" : `/c/${result.kind}/asado/71/452/202609`);
    expect(decodeShareSegments(path.split("/").slice(2))).toEqual(Option.some(result));
  });
  it.each(["071", "1e3", "+1", "1.0", "1000001", "-1", "1.5", "", "1\n"])("rejects count %j in either position", (count) => {
    expect(decodeShareSegments(["p", "asado", count, "452", "202609"])).toEqual(Option.none());
    expect(decodeShareSegments(["o", "asado", "71", count, "202609"])).toEqual(Option.none());
    expect(decodeShareSegments(["t", "asado", count, "71", "201901", "202609"])).toEqual(Option.none());
  });
  it.each([
    [], ["x", "asado", "71", "452", "202609"], ["p", "unknown", "71", "452", "202609"],
    ["p", "asado", "71", "452"], ["p", "asado", "71", "452", "202609", "extra"],
    ...["201611", "210001", "201913", "202600", "abc", "2026-09", "202609\n"].map((month) => ["p", "asado", "71", "452", month]),
    ["t", "asado", "161", "71", "202609", "202609"], ["t", "asado", "161", "71", "202610", "202609"],
    ["t", "asado", "161", "71", "201611", "202609"], ["t", "asado", "161", "71", "201901", "210001"],
    ["t", "asado", "161", "71", "201901"], ["t", "asado", "161", "71", "201901", "202609", "extra"],
  ])("rejects malformed segments %j", (...segments) => expect(decodeShareSegments(segments)).toEqual(Option.none()));
  it.each([1000001, 1.5, -1, NaN, Infinity])("refuses encoding count %s", (count) => {
    expect(encodeSharePath({ ...pay, count })).toEqual(Option.none());
    expect(encodeSharePath({ ...pay, altCount: count })).toEqual(Option.none());
  });
  it("validates encoder unit and dates and accepts inclusive boundaries", () => {
    expect(encodeSharePath({ ...pay, unit: "unknown" as UnitSlug })).toEqual(Option.none());
    expect(encodeSharePath({ ...pay, month: "201913" })).toEqual(Option.none());
    expect(encodeSharePath({ kind: "t", unit: "asado", thenCount: 1, nowCount: 2, thenMonth: "202609", month: "202609" })).toEqual(Option.none());
    for (const month of ["201612", "209912"]) {
      expect(decodeShareSegments(["p", "asado", "0", "1000000", month])).toEqual(Option.some({ ...pay, count: 0, altCount: 1000000, month }));
    }
  });
});

it("allows only sibling, Option and Result imports in every domain file", async () => {
  const root = new URL("../src/domain/", import.meta.url);
  const files = await readdir(root, { recursive: true, withFileTypes: true });
  for (const file of files) {
    if (!file.isFile()) continue;
    const source = await readFile(`${file.parentPath}/${file.name}`, "utf8");
    const imports = source.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)["']([^"']+)["']/g);
    for (const [, specifier] of imports) {
      expect(specifier!.startsWith("./") || ["effect/Option", "effect/Result"].includes(specifier!), `${file.name}: ${specifier}`).toBe(true);
    }
    expect(source, file.name).not.toMatch(/\bflow\b/);
  }
});
