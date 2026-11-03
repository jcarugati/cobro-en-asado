import type { PastComparison } from "./calc.ts";
import type { ChartData } from "./chart.ts";
import { WAGES, type WageKey } from "./wages.ts";
import type { Month, Snapshot } from "./snapshot.ts";
import { UNITS, type UnitSlug } from "./units.ts";

export const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function monthLabel(month: Month): string {
  return `${MONTH_NAMES[Number(month.slice(4)) - 1]} ${month.slice(0, 4)}`;
}

export const groupDigits = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export const formatCount = (n: number): string => groupDigits(String(Math.round(n)));

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

// Each verb follows that side's own sign, because over a short span even the top of the ranking can be a price that fell. Vegetables are outside the ranking but have tiles, so the sentence says so.
export function priceMoveLine(worst: PastComparison["worst"], best: PastComparison["best"]): string {
  const name = (slug: UnitSlug) => unitOf(slug).tile.toLowerCase();
  // Both zero means every price stayed put, and naming one twice would read as a mistake.
  if (worst.priceChange === 0 && best.priceChange === 0) return "Sin contar verduras, ningún precio cambió.";
  const top = worst.priceChange === 0 ? "lo que no cambió" : worst.priceChange > 0 ? "lo que más subió" : "lo que menos bajó";
  const bottom = best.priceChange === 0 ? "Lo que no cambió" : best.priceChange < 0 ? "Lo que más bajó" : "Lo que menos subió";
  return `Sin contar verduras, ${top}: ${name(worst.unit)}. ${bottom}: ${name(best.unit)}.`;
}

export function pastLines(unit: UnitSlug, month: Month, comparison: PastComparison): [string, string, string] {
  const { unitsThen, unitsNow, breakEven, realChange, worst, best } = comparison;
  const gap = formatPercent(realChange);
  const position = gap === "0,0\u00a0%" ? "Estás igual: ni arriba ni abajo." : `Estás un ${gap} ${realChange > 0 ? "arriba" : "abajo"}.`;
  return [
    `En ${monthWithDe(month)} ${Math.round(unitsThen) === 1 ? "era" : "eran"} ${countPhrase(unit, unitsThen)}. Hoy, ${formatCount(unitsNow)}.`,
    `Para empatar con los precios en general, hoy tendrías que cobrar ${formatPesos(breakEven)}. ${position}`,
    priceMoveLine(worst, best),
  ];
}

export function formatMultiple(value: number): string {
  const rounded = Number(value.toFixed(value < 2 ? 2 : 1));
  if (rounded >= 100) return `x${formatCount(value)}`;
  return `x${value.toFixed(rounded >= 2 ? 1 : 2).replace(".", ",")}`;
}

const wageLabel = (wage: WageKey): string => wage === "general" ? "salarios" : `salarios ${WAGES.find((item) => item.key === wage)!.label.toLowerCase()}`;

export function chartSummary(snapshot: Snapshot, data: ChartData, unit: UnitSlug, wage: WageKey): string {
  const definition = unitOf(unit);
  const label = wageLabel(wage);
  const wageMultiple = data.wages.findLast((value) => value !== null)!;
  const note = snapshot.wages.lastMonth < snapshot.lastMonth ? ` (hasta ${monthLabel(snapshot.wages.lastMonth)})` : "";
  return `Desde ${monthLabel(data.months[0]!)}: ${definition.article} ${definition.tile.toLowerCase()} ${formatMultiple(data.product.at(-1)!)}, los precios en general ${formatMultiple(data.ipc.at(-1)!)} y los ${label} ${formatMultiple(wageMultiple)}${note}.`;
}

export function chartVerdict(data: ChartData, unit: UnitSlug, wage: WageKey): {
  question: string; answer: "Sí" | "No" | "Empate";
} {
  const definition = unitOf(unit);
  const label = wageLabel(wage);
  const pronoun = ["los", "las"].includes(definition.article) ? "les" : "le";
  const article = definition.article === "el" ? "al" : `a ${definition.article}`;
  const index = data.wages.findLastIndex((value) => value !== null);
  const wages = data.wages[index]!;
  const product = data.product[index]!;
  const shown = data.product.at(-1)!;
  // Lagging wages leave the winner unknown when the common and shown prices disagree or print a tie.
  const tied = [product, shown].some((value) => formatMultiple(wages) === formatMultiple(value)) || (wages > product) !== (wages > shown);
  return {
    question: `¿Los ${label} ${pronoun} ganaron ${article} ${definition.tile.toLowerCase()}?`,
    answer: tied ? "Empate" : wages > product ? "Sí" : "No",
  };
}
