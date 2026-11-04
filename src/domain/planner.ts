import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { checkPastMonth, monthIndex, priceAt } from "./calc.ts";
import { formatMultiple, formatPesos, monthLabel } from "./format.ts";
import { validMonth, type ShareTarget } from "./share.ts";
import type { Month, Snapshot } from "./snapshot.ts";
import type { UnitSlug } from "./units.ts";

export const MIN_PEOPLE = 1;
export const MAX_PEOPLE = 100;
export const DEFAULT_PEOPLE = 6;
export const DEFAULT_THEN_MONTH = "201901";
// Editable shopping assumptions, in the same units as INDEC prices.
export const ASADO_LIST: readonly { unit: UnitSlug; name: string; perPerson: number; step: number; measure: "kg" | "litro" | "botella" }[] = [
  { unit: "asado", name: "Asado", perPerson: 0.4, step: 0.1, measure: "kg" },
  { unit: "salame", name: "Salame", perPerson: 0.03, step: 0.05, measure: "kg" },
  { unit: "queso", name: "Queso cremoso", perPerson: 0.03, step: 0.05, measure: "kg" },
  { unit: "pan", name: "Pan francés", perPerson: 0.15, step: 0.1, measure: "kg" },
  { unit: "tomate", name: "Tomate", perPerson: 0.1, step: 0.1, measure: "kg" },
  { unit: "cebolla", name: "Cebolla", perPerson: 0.05, step: 0.1, measure: "kg" },
  { unit: "papa", name: "Papa", perPerson: 0.15, step: 0.1, measure: "kg" },
  { unit: "vino", name: "Vino común", perPerson: 0.25, step: 1, measure: "litro" },
  { unit: "cerveza", name: "Cerveza", perPerson: 0.5, step: 1, measure: "litro" },
  { unit: "gaseosa", name: "Gaseosa", perPerson: 0.2, step: 1, measure: "botella" },
];
export type PlanLine = { unit: UnitSlug; name: string; amountText: string; now: number; then: number };
export type Plan = { people: number; thenMonth: Month; month: Month; lines: readonly PlanLine[]; totalNow: number; totalThen: number; multiple: number };
export type PlanError = "people" | "month" | "tooEarly" | "tooLate";

export function planAsado(snapshot: Snapshot, input: { people: number; thenMonth: Month; month: Month }): Result.Result<Plan, PlanError> {
  if (!Number.isInteger(input.people) || input.people < MIN_PEOPLE || input.people > MAX_PEOPLE) return Result.fail("people");
  if (Option.isNone(monthIndex(snapshot, input.month))) return Result.fail("month");
  const past = checkPastMonth({ ...snapshot, lastMonth: input.month }, input.thenMonth);
  if (Result.isFailure(past)) return Result.fail(past.failure === "invalid" ? "month" : past.failure);
  const lines = ASADO_LIST.map((item) => {
    const amount = Math.ceil(input.people * item.perPerson / item.step - 1e-9) * item.step;
    const text = String(Number(amount.toFixed(2))).replace(".", ",");
    const amountText = item.measure === "kg" ? (amount < 1 ? `${Math.round(amount * 1000)} g` : `${text} kg`)
      : item.measure === "litro" ? `${text} ${amount === 1 ? "litro" : "litros"}`
      : `${text} ${amount === 1 ? "botella" : "botellas"} de 1,5 litros`;
    return { unit: item.unit, name: item.name, amountText,
      now: amount * Option.getOrThrow(priceAt(snapshot, item.unit, input.month)),
      then: amount * Option.getOrThrow(priceAt(snapshot, item.unit, input.thenMonth)) };
  });
  const totalNow = lines.reduce((sum, line) => sum + line.now, 0);
  const totalThen = lines.reduce((sum, line) => sum + line.then, 0);
  return Result.succeed({ ...input, lines, totalNow, totalThen, multiple: totalNow / totalThen });
}

export function decodePlanSegments(segments: readonly string[]): Option.Option<{ people: number; thenMonth: Month; month: Month }> {
  const [people, thenMonth, month] = segments;
  if (segments.length !== 3 || !people || !/^[1-9]\d*$/.test(people) || Number(people) > MAX_PEOPLE
    || !thenMonth || !month || !validMonth(thenMonth) || !validMonth(month) || thenMonth >= month) return Option.none();
  return Option.some({ people: Number(people), thenMonth, month });
}

export const planCardPath = (input: { people: number; thenMonth: Month; month: Month }): string => `/card/a/${input.people}/${input.thenMonth}/${input.month}`;
export function planCardLines(plan: Plan): { headline: string; lead: string; amount: string; tail: string; detail: string; footer: string; icons: readonly UnitSlug[] } {
  const lead = `Un asado para ${plan.people} sale`;
  const amount = formatPesos(plan.totalNow);
  return { headline: `${lead} ${amount}. En ${monthLabel(plan.thenMonth)}, ${formatPesos(plan.totalThen)}.`, lead, amount,
    tail: `Mismo asado en ${monthLabel(plan.thenMonth)}: ${formatPesos(plan.totalThen)}.`, detail: formatMultiple(plan.multiple),
    footer: `Promedio GBA · ${monthLabel(plan.month)} · INDEC`, icons: ASADO_LIST.map((item) => item.unit) };
}
export const planShareTarget = (plan: Plan): ShareTarget => ({ path: planCardPath(plan).replace("/card/", "/c/"), card: planCardPath(plan), text: planCardLines(plan).headline });
export const planSharedLine = (plan: Plan): string => `Un asado para ${plan.people} sale ${formatPesos(plan.totalNow)}. ¿Y el tuyo?`;
