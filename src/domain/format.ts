import type { PastComparison } from "./calc.ts";
import type { Month } from "./snapshot.ts";
import { UNITS, type UnitSlug } from "./units.ts";

export const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function monthLabel(month: Month): string {
  return `${MONTH_NAMES[Number(month.slice(4)) - 1]} ${month.slice(0, 4)}`;
}

export function formatCount(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export const formatPesos = (n: number): string => `$${formatCount(n)}`;

export function formatPercent(ratio: number): string {
  const [whole, decimal] = (Math.abs(ratio) * 100).toFixed(1).split(".");
  return `${formatCount(Number(whole))},${decimal}\u00a0%`;
}

export const monthWithDe = (month: Month): string => monthLabel(month).replace(" ", " de ");

// A preset can lag the price data, and then it must print its own month.
export const ownMonthNote = (month: Month, lastMonth: Month): string => month === lastMonth ? "" : ` (${monthWithDe(month)})`;

const unitOf = (unit: UnitSlug) => UNITS.find((item) => item.slug === unit)!;

export function unitLabel(unit: UnitSlug, count: number): string {
  const definition = unitOf(unit);
  return Math.round(count) === 1 ? definition.singular : definition.plural;
}

export const countPhrase = (unit: UnitSlug, count: number): string => `${formatCount(count)} ${unitLabel(unit, count)}`;

export function pastLines(unit: UnitSlug, month: Month, comparison: PastComparison): [string, string, string] {
  const { unitsThen, unitsNow, breakEven, realChange, worst, best } = comparison;
  const gap = formatPercent(realChange);
  const position = gap === "0,0\u00a0%" ? "Estás igual: ni arriba ni abajo." : `Estás un ${gap} ${realChange > 0 ? "arriba" : "abajo"}.`;
  const name = (slug: UnitSlug) => unitOf(slug).tile.toLowerCase();
  return [
    `En ${monthWithDe(month)} ${Math.round(unitsThen) === 1 ? "era" : "eran"} ${countPhrase(unit, unitsThen)}. Hoy, ${formatCount(unitsNow)}.`,
    `Para empatar con los precios en general, hoy tendrías que cobrar ${formatPesos(breakEven)}. ${position}`,
    `Lo que más subió: ${name(worst.unit)}. Lo que menos subió: ${name(best.unit)}.`,
  ];
}
