import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import * as Option from "effect/Option";
import { formatCount } from "../src/domain/format.ts";
import { afterShareError, cardLines, cardPath, encodeSharePath, sharedLine, shareResultFor, shareTarget, type ShareResult } from "../src/domain/share.ts";
import { comparePast } from "../src/domain/calc.ts";
import * as Result from "effect/Result";
import type { Snapshot } from "../src/domain/snapshot.ts";

const pay: ShareResult = { kind: "p", unit: "asado", count: 71, altCount: 452, month: "202609" };
const footer = "Promedio GBA · septiembre 2026 · INDEC";

describe("share copy", () => {
  it.each([
    [pay, "Alguien cobra 71 kilos de asado. ¿Y vos?", "Cobro 71 kilos de asado por mes.", "(o 452 paquetes de yerba)", "/card/p/asado/71/452/202609"],
    [{ ...pay, kind: "o", count: 60 }, "Alguien cobra 60 kilos de asado a precio de su carnicería. ¿Y vos?", "Cobro 60 kilos de asado por mes, a precio de mi carnicería.", "(o 452 paquetes de yerba)", "/card/o/asado/60/452/202609"],
    [{ kind: "t", unit: "asado", thenCount: 161, nowCount: 71, thenMonth: "201901", month: "202609" }, "Alguien cobra 71 kilos de asado. ¿Y vos?", "En 2019 cobraba 161 kilos de asado. Hoy, 71.", null, "/card/t/asado/161/71/201901/202609"],
  ] as const)("formats $0.kind exactly", (result, line, headline, detail, path) => {
    expect(sharedLine(result)).toBe(line);
    expect(cardLines(result)).toMatchObject({ headline, footer });
    const lines = cardLines(result);
    // The words must read exactly, however the card splits them around the number. A t card's detail is the end of its headline.
    expect(`${lines.lead} ${formatCount(lines.count)} ${lines.tail}${detail === null ? ` ${lines.detail}` : ""}`).toBe(headline);
    if (detail !== null) expect(lines.detail).toBe(detail);
    expect(Option.getOrThrow(cardPath(result))).toBe(path);
  });
  it("uses singular units in every kind", () => {
    expect(sharedLine({ ...pay, count: 1 })).toBe("Alguien cobra 1 kilo de asado. ¿Y vos?");
    expect(cardLines({ ...pay, count: 1, altCount: 1 })).toMatchObject({ headline: "Cobro 1 kilo de asado por mes.", detail: "(o 1 paquete de yerba)", footer });
    expect(sharedLine({ ...pay, kind: "o", count: 1 })).toBe("Alguien cobra 1 kilo de asado a precio de su carnicería. ¿Y vos?");
    expect(cardLines({ ...pay, kind: "o", count: 1 }).headline).toBe("Cobro 1 kilo de asado por mes, a precio de mi carnicería.");
    const then: ShareResult = { kind: "t", unit: "asado", thenCount: 1, nowCount: 1, thenMonth: "202001", month: "202609" };
    expect(sharedLine(then)).toBe("Alguien cobra 1 kilo de asado. ¿Y vos?");
    expect(cardLines(then).headline).toBe("En 2020 cobraba 1 kilo de asado. Hoy, 1.");
  });
  it("uses the alternate asado unit and groups large counts", () => {
    expect(cardLines({ ...pay, unit: "panales", count: 1000000, altCount: 1 })).toMatchObject({ headline: "Cobro 1.000.000 paquetes de 10 pañales por mes.", detail: "(o 1 kilo de asado)", footer });
    expect(cardPath({ ...pay, count: 1000001 })).toEqual(Option.none());
  });
});

const snapshot: Snapshot = JSON.parse(await readFile(new URL("./fixtures/snapshot-202609.json", import.meta.url), "utf8"));

describe("what the share button builds", () => {
  const path = (input: Parameters<typeof shareResultFor>[1]) => Option.getOrThrow(encodeSharePath(shareResultFor(snapshot, input)));
  const typed = { unit: "asado", pay: 1200000, overridePrice: null, past: null } as const;

  it("builds p from INDEC prices", () => {
    expect(path(typed)).toBe("/c/p/asado/71/452/202609");
  });
  it("builds o with the override price and an INDEC alternate", () => {
    expect(path({ ...typed, overridePrice: 20000 })).toBe("/c/o/asado/60/452/202609");
  });
  it("builds t when a comparison shows, even with an override", () => {
    const comparison = comparePast(snapshot, { unit: "asado", pay: 1200000, oldPay: 30000, month: "201901" });
    if (!Result.isSuccess(comparison)) throw new Error("comparison refused");
    const { unitsThen, unitsNow } = comparison.success;
    expect(path({ ...typed, overridePrice: 20000, past: { month: "201901", unitsThen, unitsNow } })).toBe("/c/t/asado/161/71/201901/202609");
  });
  it("uses asado as the alternate of any other unit", () => {
    expect(path({ ...typed, unit: "lavandina" })).toBe("/c/p/lavandina/869/71/202609");
  });
  it("gives no target for an out-of-range count, so the button hides", () => {
    expect(shareTarget(shareResultFor(snapshot, { ...typed, overridePrice: 1 }))).toBeNull();
  });
  it("gives the page, the card and the headline for an in-range count", () => {
    expect(shareTarget(shareResultFor(snapshot, typed))).toEqual({
      path: "/c/p/asado/71/452/202609",
      card: "/card/p/asado/71/452/202609",
      text: "Cobro 71 kilos de asado por mes.",
    });
  });
});

describe("after navigator.share rejects", () => {
  it.each([
    ["AbortError", false, "idle"],
    ["AbortError", true, "idle"],
    ["NotAllowedError", false, "retry"],
    ["NotAllowedError", true, "fallback"],
    ["TypeError", false, "fallback"],
    ["DataError", true, "fallback"],
  ] as const)("%s on second tap %s goes to %s", (name, secondTap, next) => {
    expect(afterShareError(name, secondTap)).toBe(next);
  });
});
