import { expect, it } from "vitest";
import * as Option from "effect/Option";
import { formatWorkDays, formatWorkTime, HOURS_PER_MONTH, parseHoursPerMonth, workHours } from "../src/domain/worktime.ts";

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
