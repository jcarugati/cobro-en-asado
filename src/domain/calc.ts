import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { MONTH_PATTERN, type Month, type Snapshot } from "./snapshot.ts";
import { UNITS, type UnitSlug } from "./units.ts";

export const altUnitOf = (unit: UnitSlug): UnitSlug => unit === "asado" ? "yerba" : "asado";

export function monthIndex(snapshot: Snapshot, month: Month): Option.Option<number> {
  if (!MONTH_PATTERN.test(month) || month < snapshot.firstMonth || month > snapshot.lastMonth) return Option.none();
  const index = (Number(month.slice(0, 4)) - Number(snapshot.firstMonth.slice(0, 4))) * 12
    + Number(month.slice(4)) - Number(snapshot.firstMonth.slice(4));
  return Option.some(index);
}

export function priceAt(snapshot: Snapshot, unit: UnitSlug, month: Month): Option.Option<number> {
  return Option.flatMap(monthIndex(snapshot, month), (index) => Option.fromNullishOr(snapshot.prices[unit][index]));
}

export const unitsFor = (pay: number, price: number): number => pay / price;
export const canastaShare = (snapshot: Snapshot, pay: number): number => pay / snapshot.presets.cbtHogar2.value;

type PastMonthError = "invalid" | "tooEarly" | "tooLate";

export function checkPastMonth(snapshot: Snapshot, month: Month): Result.Result<Month, PastMonthError> {
  if (!MONTH_PATTERN.test(month)) return Result.fail("invalid");
  if (month < snapshot.firstMonth) return Result.fail("tooEarly");
  if (month >= snapshot.lastMonth) return Result.fail("tooLate");
  return Result.succeed(month);
}

type UnitChange = { unit: UnitSlug; priceChange: number };
export type PastComparison = {
  unitsThen: number;
  unitsNow: number;
  unitChange: number;
  breakEven: number;
  realChange: number;
  worst: UnitChange;
  best: UnitChange;
};

export function comparePast(snapshot: Snapshot, input: {
  unit: UnitSlug; pay: number; oldPay: number; month: Month;
}): Result.Result<PastComparison, PastMonthError> {
  return Result.map(checkPastMonth(snapshot, input.month), (month) => {
    const thenIndex = Option.getOrThrow(monthIndex(snapshot, month));
    const nowIndex = Option.getOrThrow(monthIndex(snapshot, snapshot.lastMonth));
    const unitsThen = unitsFor(input.oldPay, snapshot.prices[input.unit][thenIndex]!);
    const unitsNow = unitsFor(input.pay, snapshot.prices[input.unit][nowIndex]!);
    const breakEven = input.oldPay * snapshot.ipc[nowIndex]! / snapshot.ipc[thenIndex]!;
    const changes = UNITS.filter((unit) => !unit.seasonal).map((unit) => ({
      unit: unit.slug,
      priceChange: snapshot.prices[unit.slug][nowIndex]! / snapshot.prices[unit.slug][thenIndex]! - 1,
    }));
    const worst = changes.reduce((a, b) => b.priceChange > a.priceChange ? b : a);
    const best = changes.reduce((a, b) => b.priceChange < a.priceChange ? b : a);
    return { unitsThen, unitsNow, unitChange: unitsNow / unitsThen - 1,
      breakEven, realChange: input.pay / breakEven - 1, worst, best };
  });
}

const MAX_ICONS = 100;

// How many icons draw a count and how much each is worth. Steps of 1, 2, 5, 10... keep the legend easy to read. Columns fill a tray about 1.9 times wider than tall; six is the fewest so one icon never goes giant.
export function iconGrid(count: number): { icons: number; each: number; columns: number } {
  const rounded = Math.max(0, Math.round(count));
  for (let scale = 1; ; scale *= 10) {
    for (const step of [1, 2, 5]) {
      const each = step * scale;
      if (rounded > MAX_ICONS * each) continue;
      const icons = Math.ceil(rounded / each);
      return { icons, each, columns: Math.max(6, Math.ceil(Math.sqrt(icons * 1.9))) };
    }
  }
}
