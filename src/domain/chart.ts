import * as Option from "effect/Option";
import { monthIndex } from "./calc.ts";
import type { Month, Snapshot } from "./snapshot.ts";
import type { UnitSlug } from "./units.ts";
import type { WageKey } from "./wages.ts";

export function monthAt(snapshot: Snapshot, index: number): Month {
  const date = new Date(Date.UTC(Number(snapshot.firstMonth.slice(0, 4)), Number(snapshot.firstMonth.slice(4)) - 1 + index));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const rebase = (values: number[], start: number): number[] => values.slice(start).map((value) => value / values[start]!);

export const RANGES = ["year", "since2019", "all"] as const;
export function rangeStart(snapshot: Snapshot, key: (typeof RANGES)[number]): Month {
  if (key === "all") return snapshot.firstMonth;
  if (key === "since2019") return "201901";
  return monthAt(snapshot, Option.getOrThrow(monthIndex(snapshot, snapshot.lastMonth)) - 12);
}

export type ChartData = {
  months: Month[];
  product: number[];
  ipc: number[];
  wages: (number | null)[];
  own: number | null;
};

export function chartData(snapshot: Snapshot, input: {
  unit: UnitSlug; wage: WageKey; start: Month;
  own?: { month: Month; oldPay: number; pay: number };
}): Option.Option<ChartData> {
  const start = monthIndex(snapshot, input.start);
  if (Option.isNone(start) || input.start >= snapshot.wages.lastMonth) return Option.none();
  const ipc = rebase(snapshot.ipc, start.value);
  const wages = rebase(snapshot.wages.series[input.wage], start.value);
  return Option.some({
    months: ipc.map((_, index) => monthAt(snapshot, start.value + index)),
    product: rebase(snapshot.prices[input.unit], start.value), ipc,
    wages: ipc.map((_, index) => wages[index] ?? null),
    own: input.own?.month === input.start ? input.own.pay / input.own.oldPay : null,
  });
}

export function multipleTicks(min: number, max: number): number[] {
  const low = Math.min(min, 1);
  const high = Math.max(max, 1);
  let ticks: number[] = [];
  if (max < 5) {
    const step = max < 2 ? 0.25 : 1;
    for (let tick = Math.floor(low / step) * step; tick <= Math.ceil(high / step) * step; tick += step) {
      if (tick > 0) ticks.push(tick);
    }
    if (ticks[0]! > low) ticks.unshift(low);
  } else {
    // Bound exponents rather than multiplying until overflow or underflow.
    for (let exponent = -324; exponent <= 309; exponent++) {
      for (const factor of [1, 2, 5]) {
        const tick = Number(`${factor}e${exponent}`);
        if (tick > 0 && Number.isFinite(tick)) ticks.push(tick);
      }
    }
    ticks = [...new Set(ticks)].sort((a, b) => a - b);
    const first = Math.max(0, ticks.findIndex((tick) => tick >= low) - (ticks.includes(low) ? 0 : 1));
    const last = ticks.findIndex((tick) => tick >= high);
    ticks = ticks.slice(first, last < 0 ? undefined : last + 1);
    if (ticks.at(-1)! < high) ticks.push(high);
    if (ticks.length > 8) {
      ticks = [];
      for (let exponent = Math.floor(Math.log10(low)); exponent <= Math.ceil(Math.log10(high)); exponent++) {
        const tick = Number(`1e${exponent}`);
        if (tick > 0 && Number.isFinite(tick)) ticks.push(tick);
      }
      if (ticks[0]! > low || ticks.length === 0) ticks.unshift(low);
      if (ticks.at(-1)! < high) ticks.push(high);
    }
  }
  ticks = [...new Set([...ticks, 1])].sort((a, b) => a - b);
  if (ticks.length <= 8) return ticks;
  return [...new Set([...Array.from({ length: 7 }, (_, i) => ticks[Math.round(i * (ticks.length - 1) / 6)]!), 1])].sort((a, b) => a - b);
}
