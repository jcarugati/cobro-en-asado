import * as Result from "effect/Result";

export function parsePay(input: string): Result.Result<number, "empty" | "invalid"> {
  const text = input.trim().replace(/^\$/, "").replace(/\s/g, "");
  if (text === "") return Result.fail("empty");
  if (!/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(text)) return Result.fail("invalid");
  const value = Number(text.replace(/\./g, "").replace(",", "."));
  return value > 0 && value <= 1e12 ? Result.succeed(value) : Result.fail("invalid");
}
