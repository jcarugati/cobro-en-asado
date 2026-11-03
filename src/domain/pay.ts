import * as Result from "effect/Result";
import { formatCount, groupDigits } from "./format.ts";

export function parsePay(input: string): Result.Result<number, "empty" | "invalid"> {
  const text = input.trim().replace(/^\$\s*/, "");
  if (text === "") return Result.fail("empty");
  if (!/^(?:[1-9]\d{0,2}(?:\.\d{3})+|0|[1-9]\d*)(?:,\d{1,2})?$/.test(text)) return Result.fail("invalid");
  const value = Number(text.replace(/\./g, "").replace(",", "."));
  return value > 0 && value <= 1e12 ? Result.succeed(value) : Result.fail("invalid");
}

// For a paste: only a comma can mark cents, and those stay as typed, as does invalid text.
export function withDots(text: string): string {
  const parsed = parsePay(text);
  return Result.isSuccess(parsed) && !text.includes(",") ? formatCount(parsed.success) : text;
}

// For each keystroke: regroups a plain amount, so a deleted digit or dot never leaves a broken group. Anything else stays as typed, so the hint can explain it.
export function groupWhileTyping(text: string, dotMayBeDecimal: boolean): string {
  // Such a dot may open a group or be a decimal point, so it waits for its digits: three regroup, and 1200000.50 gets the hint instead of reading as 120 million.
  if (dotMayBeDecimal && /\.\d{0,2}$/.test(text)) return text;
  const plain = /^([\d.]*)(,\d*)?$/.exec(text);
  if (!plain) return text;
  const digits = plain[1]!.replace(/\./g, "").replace(/^0+(?=\d)/, "");
  return (digits === "" && plain[2] ? "0" : groupDigits(digits)) + (plain[2] ?? "");
}

// Where the caret belongs after regrouping: past the same number of characters, not counting dots.
export function caretAfterGrouping(text: string, kept: number): number {
  let position = 0;
  for (let seen = 0; seen < kept && position < text.length; position++) {
    if (text[position] !== ".") seen++;
  }
  return position;
}
