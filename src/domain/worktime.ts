import * as Option from "effect/Option";
import { formatCount } from "./format.ts";

export const HOURS_PER_MONTH = 176;
export const WORK_DAYS_PER_MONTH = 22;

export function parseHoursPerMonth(text: string): Option.Option<number> {
  const trimmed = text.trim();
  const hours = Number(trimmed);
  return /^[1-9]\d*$/.test(trimmed) && hours <= 744 ? Option.some(hours) : Option.none();
}

export const workHours = (price: number, pay: number, hoursPerMonth: number): number => price / pay * hoursPerMonth;

export function formatWorkTime(hours: number): string {
  const minutes = Math.round(hours * 60);
  if (minutes < 1) return "menos de 1 min";
  const whole = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [whole ? `${formatCount(whole)} h` : "", rest ? `${rest} min` : ""].filter((part) => part !== "").join(" ");
}

export function formatWorkDays(hours: number, hoursPerMonth: number): string {
  const day = hoursPerMonth / WORK_DAYS_PER_MONTH;
  // Division can put an exact workday just below its integer, especially with edited monthly hours.
  const quotient = hours / day + 1e-9;
  if (quotient < 1) return formatWorkTime(hours);
  let days = Math.floor(quotient);
  let rest = Math.round(hours - days * day);
  if (rest >= day) { days++; rest = 0; }
  return `${formatCount(days)} ${days === 1 ? "día" : "días"}${rest ? ` y ${rest} h` : ""}`;
}
