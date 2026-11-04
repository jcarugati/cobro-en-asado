import * as Option from "effect/Option";
import { formatCount } from "./format.ts";

export const HOURS_PER_MONTH = 176;
export const WORK_DAYS_PER_MONTH = 22;
const CLOCK_IN_HOUR = 9;

export function parseHoursPerMonth(text: string): Option.Option<number> {
  const trimmed = text.trim();
  const hours = Number(trimmed);
  return /^[1-9]\d*$/.test(trimmed) && hours <= 744 ? Option.some(hours) : Option.none();
}

export const workHours = (price: number, pay: number, hoursPerMonth: number): number => price / pay * hoursPerMonth;

// Never a false 0 h: an hour a month still rounds up to a tenth of a day's work.
export function formatHoursPerDay(hoursPerMonth: number): string {
  return String(Math.max(0.1, Number((hoursPerMonth / WORK_DAYS_PER_MONTH).toFixed(1)))).replace(".", ",");
}

export function formatWorkTime(hours: number): string {
  const minutes = Math.round(hours * 60);
  if (minutes < 1) return "menos de 1 min";
  const whole = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [whole ? `${formatCount(whole)} h` : "", rest ? `${rest} min` : ""].filter((part) => part !== "").join(" ");
}

// The time of day a price is paid off, clocking in at 9.
export function clockAfter(hours: number, hoursPerMonth: number): Option.Option<string> {
  const minutes = Math.round(hours * 60);
  const dayMinutes = hoursPerMonth / WORK_DAYS_PER_MONTH * 60;
  const clockMinutes = CLOCK_IN_HOUR * 60 + minutes;
  if (minutes < 1 || minutes > dayMinutes || clockMinutes >= 24 * 60) return Option.none();
  return Option.some(`${Math.floor(clockMinutes / 60)}:${String(clockMinutes % 60).padStart(2, "0")}`);
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

export function hoursAssumption(hoursPerMonth: number): string {
  return `Con ${formatCount(hoursPerMonth)} ${hoursPerMonth === 1 ? "hora" : "horas"} por mes (${formatHoursPerDay(hoursPerMonth)} h × ${WORK_DAYS_PER_MONTH} días).`;
}
