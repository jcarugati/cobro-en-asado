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

// Which months the X axis names, and how many months apart. Short spans name months, longer ones name years, so labels never crowd at 360 px.
export function monthTicks(months: Month[]): { step: number; indexes: number[] } {
  const span = months.length - 1;
  const step = span <= 6 ? 1 : span <= 18 ? 3 : span <= 48 ? 12 : 24;
  const indexes = months.flatMap((month, index) => {
    const calendar = Number(month.slice(4)) - 1;
    // Odd years, so 2019 is named and the same years stay named when the range changes.
    const onStep = step === 24 ? calendar === 0 && Number(month.slice(0, 4)) % 2 === 1 : calendar % step === 0;
    return onStep ? [index] : [];
  });
  return { step, indexes };
}

// Moves end labels apart by the smallest shifts that leave `gap` between neighbours, within 0..100. Keeps the input order.
export function spreadLabels(positions: number[], gap: number): number[] {
  const order = positions.map((_, index) => index).sort((a, b) => positions[a]! - positions[b]!);
  const spread = [...positions];
  order.forEach((at, rank) => {
    spread[at] = rank === 0 ? Math.max(0, spread[at]!) : Math.max(spread[at]!, spread[order[rank - 1]!]! + gap);
  });
  for (let rank = order.length - 1; rank >= 0; rank--) {
    const at = order[rank]!;
    spread[at] = rank === order.length - 1 ? Math.min(100, spread[at]!) : Math.min(spread[at]!, spread[order[rank + 1]!]! - gap);
  }
  return spread;
}

// Where the largest empty stretch of 0..100 starts, given the positions already taken.
export function freeSpanStart(positions: number[]): number {
  const edges = [0, ...[...positions].sort((a, b) => a - b), 100];
  let start = 0;
  let size = 0;
  edges.slice(1).forEach((edge, index) => {
    if (edge - edges[index]! > size) {
      size = edge - edges[index]!;
      start = edges[index]!;
    }
  });
  return start;
}
