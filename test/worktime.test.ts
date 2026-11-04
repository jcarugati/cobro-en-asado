import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import * as Option from "effect/Option";
import type { Snapshot } from "../src/domain/snapshot.ts";
import { clockAfter, formatWorkDays, formatWorkTime, HOURS_PER_MONTH, hoursAssumption, parseHoursPerMonth, workHours } from "../src/domain/worktime.ts";

it.each([
  [0, "menos de 1 min"], [0.75, "45 min"], [3, "3 h"], [2 + 14 / 60, "2 h 14 min"],
  [1234 + 5 / 60, "1.234 h 5 min"], [59.6 / 60, "1 h"], [1 + 59.7 / 60, "2 h"],
])("formats %s hours", (hours, text) => expect(formatWorkTime(hours)).toBe(text));
it("calculates the fixture's asado work time", () => {
  expect(formatWorkTime(workHours(16836.34, 1200000, HOURS_PER_MONTH))).toBe("2 h 28 min");
});
it.each([[7.6, "7 h 36 min"], [8, "1 día"], [16, "2 días"], [11, "1 día y 3 h"], [101, "12 días y 5 h"], [15.6, "2 días"]])("formats %s as days", (hours, text) => expect(formatWorkDays(hours, 176)).toBe(text));
it.each(["0", "745", "08", "1,5", "", "-1", "1.0", "Infinity"])("refuses %s hours", (text) => expect(Option.isNone(parseHoursPerMonth(text))).toBe(true));
it.each(["1", "744", " 176 "])("parses %s hours", (text) => expect(Option.getOrThrow(parseHoursPerMonth(text))).toBe(Number(text)));

it("preserves exact workdays with edited monthly hours", () => {
  expect(formatWorkDays(workHours(5, 22, 111), 111)).toBe("5 días");
  expect(formatWorkDays(workHours(1, 22, 111), 111)).toBe("1 día");
});

it("calculates clock times from the September 2026 fixture", async () => {
  const snapshot: Snapshot = JSON.parse(await readFile(new URL("./fixtures/snapshot-202609.json", import.meta.url), "utf8"));
  for (const [unit, clock] of [["asado", "11:28"], ["lavandina", "9:12"]] as const) {
    expect(clockAfter(workHours(snapshot.prices[unit].at(-1)!, 1200000, HOURS_PER_MONTH), HOURS_PER_MONTH)).toEqual(Option.some(clock));
  }
});

it.each([
  [8, 176, Option.some("17:00")],
  [481 / 60, 176, Option.none()],
  [0, 176, Option.none()],
  [0.4 / 60, 176, Option.none()],
  [59.6 / 60, 176, Option.some("10:00")],
  [15, 744, Option.none()],
  [14 + 59 / 60, 744, Option.some("23:59")],
])("clocks %s hours at %s monthly hours", (hours, monthly, clock) => {
  expect(clockAfter(hours, monthly)).toEqual(clock);
});

it.each([111, 160, 176])("keeps the last whole workday minute at %s monthly hours", (monthly) => {
  const minutes = Math.floor(monthly * 60 / 22);
  const hours = workHours(minutes, monthly * 60, monthly);
  const clock = `${9 + Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
  expect(clockAfter(hours, monthly)).toEqual(Option.some(clock));
  expect(clockAfter((minutes + 1) / 60, monthly)).toEqual(Option.none());
});
it.each([[176, "Con 176 horas por mes (8 h × 22 días)."], [160, "Con 160 horas por mes (7,3 h × 22 días)."], [1, "Con 1 hora por mes (0,1 h × 22 días)."]])("states the assumption for %s hours", (hours, text) => expect(hoursAssumption(hours)).toBe(text));
