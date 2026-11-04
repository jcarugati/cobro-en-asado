import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { ASADO_LIST, decodePlanSegments, perPersonText, planAsado, planCardLines, planCardPath, planShareTarget, planSharedLine } from "../src/domain/planner.ts";
import { formatPesos } from "../src/domain/format.ts";
import type { Snapshot } from "../src/domain/snapshot.ts";
const snapshot: Snapshot = JSON.parse(await readFile(new URL("./fixtures/snapshot-202609.json", import.meta.url), "utf8"));
const input = { people: 6, thenMonth: "201901", month: "202609" };
const plan = (people: number) => Result.getOrThrow(planAsado(snapshot, { ...input, people }));

it.each([[6, "$83.806", "$1.122"], [1, "$21.429", "$314"], [100, "$1.312.904", "$17.221"]])("prices an asado for %s", (people, now, then) => {
  const result = plan(people);
  expect(formatPesos(result.totalNow)).toBe(now);
  expect(formatPesos(result.totalThen)).toBe(then);
  expect(result.multiple).toBe(result.totalNow / result.totalThen);
});
it("formats shopping quantities without floating point noise", () => {
  expect(plan(6).lines.map((line) => line.amountText)).toEqual(["2,4 kg", "200 g", "200 g", "900 g", "600 g", "300 g", "900 g", "2 litros", "3 litros", "2 botellas de 1,5 litros"]);
  expect(plan(1).lines.slice(-3).map((line) => line.amountText)).toEqual(["1 litro", "1 litro", "1 botella de 1,5 litros"]);
  expect(plan(20).lines[3]!.amountText).toBe("3 kg");
  expect(plan(24).lines[4]!.amountText).toBe("2,4 kg");
});
it.each([
  [{ people: 0 }, "people"], [{ people: 101 }, "people"], [{ people: 1.5 }, "people"], [{ people: NaN }, "people"],
  [{ month: "209912" }, "month"], [{ month: "202613" }, "month"], [{ thenMonth: "201613" }, "month"],
  [{ thenMonth: "201611" }, "tooEarly"], [{ thenMonth: "202609" }, "tooLate"], [{ thenMonth: "202610" }, "tooLate"],
  [{ month: "202001", thenMonth: "202002" }, "tooLate"],
] as const)("rejects %o", (override, error) => expect(planAsado(snapshot, { ...input, ...override })).toEqual(Result.fail(error)));
it.each(["0/201901/202609", "101/201901/202609", "06/201901/202609", "6/202609/202609", "6/201901/202609/extra", "6/201913/202609", "6/201901/209913", "1e1/201901/202609"])("refuses plan URL %s", (path) => expect(Option.isNone(decodePlanSegments(path.split("/")))).toBe(true));
it("pins the share contract", () => {
  const result = plan(6);
  expect(Option.getOrThrow(decodePlanSegments(["6", "201901", "202609"]))).toEqual(input);
  expect(planCardLines(result)).toEqual({ headline: "Un asado para 6 sale $83.806. En enero 2019, $1.122.", lead: "Un asado para 6 sale", amount: "$83.806", tail: "Mismo asado en enero 2019: $1.122.", detail: "x74,7", footer: "Promedio GBA · septiembre 2026 · INDEC", icons: ASADO_LIST.map((item) => item.unit) });
  expect(planShareTarget(result)).toEqual({ path: "/c/a/6/201901/202609", card: planCardPath(result), text: planCardLines(result).headline });
  expect(planSharedLine(result)).toBe("Un asado para 6 sale $83.806. ¿Y el tuyo?");
});
it("says what each person gets, in units anyone can picture", () => {
  expect(ASADO_LIST.map((item) => perPersonText(item))).toEqual([
    "Asado: 400 g por persona", "Salame: 30 g por persona", "Queso cremoso: 30 g por persona", "Pan francés: 150 g por persona", "Tomate: 100 g por persona",
    "Cebolla: 50 g por persona", "Papa: 150 g por persona", "Vino común: 250 ml por persona", "Cerveza: 500 ml por persona", "Gaseosa: 300 ml por persona",
  ]);
});
