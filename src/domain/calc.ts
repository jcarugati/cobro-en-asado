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

type UnitChange = { unit: UnitSlug; change: number };
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
      change: unitsFor(input.pay, snapshot.prices[unit.slug][nowIndex]!)
        / unitsFor(input.oldPay, snapshot.prices[unit.slug][thenIndex]!) - 1,
    }));
    const worst = changes.reduce((a, b) => b.change < a.change ? b : a);
    const best = changes.reduce((a, b) => b.change > a.change ? b : a);
    return { unitsThen, unitsNow, unitChange: unitsNow / unitsThen - 1,
      breakEven, realChange: input.pay / breakEven - 1, worst, best };
  });
}

// Slightly off-square on purpose: a printed ticket, tally added by hand. Shared by the page and the card.
export const TALLY_STROKES = ["M3 2 2 28", "M10 1 11 29", "M17 3 16 28", "M24 1 25 29"];
export const TALLY_STRIKE = "M-1 24 28 6";

export function tally(count: number): { groups: number[]; overflow: number } {
  const rounded = Math.max(0, Math.round(count));
  const marks = Math.min(100, rounded);
  const groups = Array<number>(Math.floor(marks / 5)).fill(5);
  if (marks % 5 !== 0) groups.push(marks % 5);
  return { groups, overflow: Math.max(0, rounded - 100) };
}
