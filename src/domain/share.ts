import * as Option from "effect/Option";
import { altUnitOf, unitsFor } from "./calc.ts";
import { countPhrase, formatCount, monthLabel, unitLabel } from "./format.ts";
import { MONTH_PATTERN, type Month, type Snapshot } from "./snapshot.ts";
import { UNITS, type UnitSlug } from "./units.ts";

export type ShareResult =
  | { kind: "p" | "o"; unit: UnitSlug; count: number; altCount: number; month: Month }
  | { kind: "t"; unit: UnitSlug; thenCount: number; nowCount: number; thenMonth: Month; month: Month };

const validMonth = (month: string): boolean => MONTH_PATTERN.test(month) && month >= "201612" && month <= "209912";
const validCount = (count: string): boolean => /^(0|[1-9]\d{0,6})$/.test(count) && Number(count) <= 1000000;

export function decodeShareSegments(segments: readonly string[]): Option.Option<ShareResult> {
  const [kind, slug, first, second, firstMonth, lastMonth] = segments;
  const unit = UNITS.find((item) => item.slug === slug)?.slug;
  if (!unit || first === undefined || second === undefined || firstMonth === undefined
    || !validCount(first) || !validCount(second) || !validMonth(firstMonth)) return Option.none();
  if ((kind === "p" || kind === "o") && segments.length === 5) {
    return Option.some({ kind, unit, count: Number(first), altCount: Number(second), month: firstMonth });
  }
  if (kind === "t" && segments.length === 6 && lastMonth !== undefined && validMonth(lastMonth) && firstMonth < lastMonth) {
    return Option.some({ kind, unit, thenCount: Number(first), nowCount: Number(second), thenMonth: firstMonth, month: lastMonth });
  }
  return Option.none();
}

export function encodeSharePath(result: ShareResult): Option.Option<string> {
  const segments = result.kind === "t"
    ? [result.kind, result.unit, String(result.thenCount), String(result.nowCount), result.thenMonth, result.month]
    : [result.kind, result.unit, String(result.count), String(result.altCount), result.month];
  return Option.map(decodeShareSegments(segments), () => `/c/${segments.join("/")}`);
}

export function sharedLine(result: ShareResult): string {
  if (result.kind === "t") return `Alguien cobraba ${countPhrase(result.unit, result.thenCount)} en ${result.thenMonth.slice(0, 4)}. Hoy, ${formatCount(result.nowCount)}. ¿Y vos?`;
  return `Alguien cobra ${countPhrase(result.unit, result.count)}${result.kind === "o" ? " a precio de su carnicería" : ""}. ¿Y vos?`;
}

export type CardLines = {
  kind: ShareResult["kind"];
  headline: string; // The whole sentence: what the share sheet sends as text.
  lead: string;
  count: number;
  tail: string;
  detail: string | null;
  footer: string;
};

export function cardLines(result: ShareResult): CardLines {
  const footer = `Promedio GBA · ${monthLabel(result.month)} · INDEC`;
  if (result.kind === "t") {
    const lead = `En ${result.thenMonth.slice(0, 4)} cobraba`;
    const tail = `${unitLabel(result.unit, result.thenCount)}.`;
    const detail = `Hoy, ${formatCount(result.nowCount)}.`;
    return { kind: result.kind, headline: `${lead} ${formatCount(result.thenCount)} ${tail} ${detail}`, lead, count: result.thenCount, tail, detail, footer };
  }
  const tail = `${unitLabel(result.unit, result.count)} por mes${result.kind === "o" ? ", a precio de mi carnicería" : ""}.`;
  return {
    kind: result.kind,
    headline: `Cobro ${formatCount(result.count)} ${tail}`,
    lead: "Cobro",
    count: result.count,
    tail,
    detail: `(o ${countPhrase(altUnitOf(result.unit), result.altCount)})`,
    footer,
  };
}

export function cardPath(result: ShareResult): Option.Option<string> {
  return Option.map(encodeSharePath(result), (path) => path.replace("/c/", "/card/"));
}

// Counts are rounded here because encodeSharePath refuses fractions. Precedence: a showing comparison, then an override, then INDEC.
export function shareResultFor(snapshot: Snapshot, input: {
  unit: UnitSlug;
  pay: number;
  overridePrice: number | null;
  past: { month: Month; unitsThen: number; unitsNow: number } | null;
}): ShareResult {
  const { unit, pay, overridePrice, past } = input;
  const month = snapshot.lastMonth;
  if (past) return { kind: "t", unit, thenCount: Math.round(past.unitsThen), nowCount: Math.round(past.unitsNow), thenMonth: past.month, month };
  const latest = (slug: UnitSlug) => snapshot.prices[slug].at(-1)!;
  return {
    kind: overridePrice === null ? "p" : "o",
    unit,
    count: Math.round(unitsFor(pay, overridePrice ?? latest(unit))),
    altCount: Math.round(unitsFor(pay, latest(altUnitOf(unit)))),
    month,
  };
}

export type ShareTarget = { path: string; card: string; text: string };

// Null when a count is out of range, which is what hides the button.
export function shareTarget(result: ShareResult): ShareTarget | null {
  return Option.getOrNull(Option.map(encodeSharePath(result), (path) => ({
    path,
    card: path.replace("/c/", "/card/"),
    text: cardLines(result).headline,
  })));
}

// After navigator.share rejects. Only a first NotAllowedError earns a second tap: the fetch may have used up the activation window.
export function afterShareError(errorName: string, secondTap: boolean): "idle" | "retry" | "fallback" {
  if (errorName === "AbortError") return "idle";
  return errorName === "NotAllowedError" && !secondTap ? "retry" : "fallback";
}
