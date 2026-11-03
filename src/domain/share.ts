import * as Option from "effect/Option";
import { MONTH_PATTERN, type Month } from "./snapshot.ts";
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
