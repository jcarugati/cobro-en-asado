import type { Month } from "./snapshot.ts";
import { UNITS, type UnitSlug } from "./units.ts";

const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function monthLabel(month: Month): string {
  return `${MONTH_NAMES[Number(month.slice(4)) - 1]} ${month.slice(0, 4)}`;
}

export function formatCount(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export const formatPesos = (n: number): string => `$${formatCount(n)}`;

export function formatPercent(ratio: number): string {
  return `${(Math.abs(ratio) * 100).toFixed(1).replace(".", ",")}\u00a0%`;
}

export function countPhrase(unit: UnitSlug, count: number): string {
  const definition = UNITS.find((item) => item.slug === unit)!;
  return `${formatCount(count)} ${Math.round(count) === 1 ? definition.singular : definition.plural}`;
}
