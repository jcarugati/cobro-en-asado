import { describe, expect, it } from "vitest";
import * as Option from "effect/Option";
import { cardLines, cardPath, sharedLine, type ShareResult } from "../src/domain/share.ts";

const pay: ShareResult = { kind: "p", unit: "asado", count: 71, altCount: 452, month: "202609" };
const footer = "Promedio GBA · septiembre 2026 · INDEC";

describe("share copy", () => {
  it.each([
    [pay, "Alguien cobra 71 kilos de asado. ¿Y vos?", "Cobro 71 kilos de asado por mes.", "(o 452 paquetes de yerba)", "/card/p/asado/71/452/202609"],
    [{ ...pay, kind: "o", count: 60 }, "Alguien cobra 60 kilos de asado a precio de su carnicería. ¿Y vos?", "Cobro 60 kilos de asado por mes, a precio de mi carnicería.", "(o 452 paquetes de yerba)", "/card/o/asado/60/452/202609"],
    [{ kind: "t", unit: "asado", thenCount: 161, nowCount: 71, thenMonth: "201901", month: "202609" }, "Alguien cobra 71 kilos de asado. ¿Y vos?", "En 2019 cobraba 161 kilos de asado. Hoy, 71.", null, "/card/t/asado/161/71/201901/202609"],
  ] as const)("formats $0.kind exactly", (result, line, headline, detail, path) => {
    expect(sharedLine(result)).toBe(line);
    expect(cardLines(result)).toEqual({ headline, detail, footer });
    expect(Option.getOrThrow(cardPath(result))).toBe(path);
  });
  it("uses singular units in every kind", () => {
    expect(sharedLine({ ...pay, count: 1 })).toBe("Alguien cobra 1 kilo de asado. ¿Y vos?");
    expect(cardLines({ ...pay, count: 1, altCount: 1 })).toEqual({ headline: "Cobro 1 kilo de asado por mes.", detail: "(o 1 paquete de yerba)", footer });
    expect(sharedLine({ ...pay, kind: "o", count: 1 })).toBe("Alguien cobra 1 kilo de asado a precio de su carnicería. ¿Y vos?");
    expect(cardLines({ ...pay, kind: "o", count: 1 }).headline).toBe("Cobro 1 kilo de asado por mes, a precio de mi carnicería.");
    const then: ShareResult = { kind: "t", unit: "asado", thenCount: 1, nowCount: 1, thenMonth: "202001", month: "202609" };
    expect(sharedLine(then)).toBe("Alguien cobra 1 kilo de asado. ¿Y vos?");
    expect(cardLines(then).headline).toBe("En 2020 cobraba 1 kilo de asado. Hoy, 1.");
  });
  it("uses the alternate asado unit and groups large counts", () => {
    expect(cardLines({ ...pay, unit: "panales", count: 1000000, altCount: 1 })).toEqual({ headline: "Cobro 1.000.000 paquetes de 10 pañales por mes.", detail: "(o 1 kilo de asado)", footer });
    expect(cardPath({ ...pay, count: 1000001 })).toEqual(Option.none());
  });
});
