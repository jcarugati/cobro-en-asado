import * as Result from "effect/Result";
import { formatCount } from "./format.ts";

export function parsePay(input: string): Result.Result<number, "empty" | "invalid"> {
  const text = input.trim().replace(/^\$\s*/, "");
  if (text === "") return Result.fail("empty");
  if (!/^(?:[1-9]\d{0,2}(?:\.\d{3})+|0|[1-9]\d*)(?:,\d{1,2})?$/.test(text)) return Result.fail("invalid");
  const value = Number(text.replace(/\./g, "").replace(",", "."));
  return value > 0 && value <= 1e12 ? Result.succeed(value) : Result.fail("invalid");
}

// For when a money field loses focus: only a comma can mark cents, and those stay as typed, as does invalid text.
export function withDots(text: string): string {
  const parsed = parsePay(text);
  return Result.isSuccess(parsed) && !text.includes(",") ? formatCount(parsed.success) : text;
}
