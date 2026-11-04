import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import * as Option from "effect/Option";
import { dailySeed, decodeGameSegments, gameCardLines, gameCardPath, gameRounds, gameSharedLine, gameShareTarget, roundQuestion, roundReveal, roundSeries, scoreAnswers, type Round } from "../src/domain/game.ts";
import { monthAt } from "../src/domain/chart.ts";
import { monthIndex } from "../src/domain/calc.ts";
import { formatChange } from "../src/domain/format.ts";
import type { Snapshot } from "../src/domain/snapshot.ts";
const snapshot: Snapshot = JSON.parse(await readFile(new URL("./fixtures/snapshot-202609.json", import.meta.url), "utf8"));
const rounds = (seed: number, month = "202609", data = snapshot) => Option.getOrThrow(gameRounds(data, { seed, month }));

it("keeps 200 seeded games deterministic, balanced, distinct and unambiguous", () => {
  for (let seed = 0; seed < 200; seed++) {
    const game = rounds(seed);
    expect(game).toEqual(rounds(seed));
    expect(game).not.toEqual(rounds(seed + 1));
    expect(game).toHaveLength(10);
    expect(new Set(game.map((round) => round.unit)).size).toBe(10);
    expect(game.filter((round) => round.answer === "mas")).toHaveLength(5);
    expect(scoreAnswers(game, Array.from({ length: 10 }, () => "menos" as const)).score).toBe(5);
    for (const round of game) {
      expect(Math.abs(round.productChange - round.ipcChange)).toBeGreaterThanOrEqual(0.05);
      expect(Math.abs((1 + round.productChange) / (1 + round.ipcChange) - 1)).toBeGreaterThanOrEqual(0.05);
      expect(round.answer).toBe(round.productChange > round.ipcChange ? "mas" : "menos");
      expect(Option.getOrThrow(monthIndex(snapshot, round.month)) - Option.getOrThrow(monthIndex(snapshot, round.start))).toBeGreaterThanOrEqual(12);
    }
  }
});
it.each([{ seed: -1, month: "202609" }, { seed: 1000, month: "202609" }, { seed: 1.5, month: "202609" }, { seed: 0, month: "209912" }, { seed: 0, month: "201612" }, { seed: 0, month: "202613" }])("refuses %o", (input) => expect(Option.isNone(gameRounds(snapshot, input))).toBe(true));
it("ignores data appended after the pinned month, including in series", () => {
  const later = structuredClone(snapshot);
  later.lastMonth = "202610";
  later.ipc.push(later.ipc.at(-1)! * 2);
  for (const prices of Object.values(later.prices)) prices.push(prices.at(-1)! * 3);
  expect(rounds(42, "202609", later)).toEqual(rounds(42));
  const game = rounds(42, "202509");
  expect(game).toEqual(rounds(42, "202509", later));
  const round = game[0]!;
  const series = roundSeries(later, round);
  const length = Option.getOrThrow(monthIndex(snapshot, round.month)) - Option.getOrThrow(monthIndex(snapshot, round.start)) + 1;
  expect(series.product).toHaveLength(length);
  expect(series.ipc).toHaveLength(length);
  expect(series.product[0]).toBe(1);
  expect(series.ipc[0]).toBe(1);
  expect(series.product.at(-1)).toBeCloseTo(1 + round.productChange);
});
it("scores partial streaks", () => {
  const game = rounds(2);
  const wrong = game[2]!.answer === "mas" ? "menos" : "mas";
  expect(scoreAnswers(game, [])).toEqual({ score: 0, streak: 0, bestStreak: 0 });
  expect(scoreAnswers(game, [game[0]!.answer, game[1]!.answer, wrong, game[3]!.answer])).toEqual({ score: 3, streak: 1, bestStreak: 2 });
});
const round: Round = { unit: "asado", start: "201901", month: "202609", productChange: 65.2, ipcChange: 65.5, answer: "menos" };
it("pins questions, reveals and change formatting", () => {
  expect(roundQuestion(round)).toBe("Desde enero de 2019, ¿el asado subió más o menos que la inflación (IPC GBA)?");
  expect(roundQuestion({ ...round, unit: "yerba" })).toBe("Desde enero de 2019, ¿la yerba subió más o menos que la inflación (IPC GBA)?");
  expect(roundQuestion({ ...round, unit: "huevos" })).toBe("Desde enero de 2019, ¿los huevos subieron más o menos que la inflación (IPC GBA)?");
  expect(roundReveal(round)).toEqual({ product: "El asado subió 6.520\u00a0%", ipc: "La inflación subió 6.550\u00a0%" });
  expect(roundReveal({ ...round, unit: "yerba", productChange: -0.335, ipcChange: 0 })).toEqual({ product: "La yerba bajó 33,5\u00a0%", ipc: "La inflación no cambió" });
  expect(roundReveal({ ...round, unit: "huevos", productChange: 0 })).toMatchObject({ product: "Los huevos no cambiaron" });
  expect(roundReveal({ ...round, unit: "huevos", productChange: -0.1 })).toMatchObject({ product: "Los huevos bajaron 10,0\u00a0%" });
  expect(roundReveal({ ...round, unit: "huevos", productChange: 1 })).toMatchObject({ product: "Los huevos subieron 100\u00a0%" });
  expect(formatChange(0)).toBe("0,0\u00a0%");
  expect(dailySeed(86400000 * 1001)).toBe(1);
});
it.each(["11/10/0/202609", "8/9/0/202609", "8/10/1000/202609", "08/10/0/202609", "8/010/0/202609", "8/10/00/202609", "8/10/0/202613", "8/10/0/202609/x", "-1/10/0/202609"])("rejects game URL %s", (path) => expect(Option.isNone(decodeGameSegments(path.split("/")))).toBe(true));
it("pins game sharing", () => {
  const result = { score: 8, total: 10, seed: 42, month: "202609" };
  expect(Option.getOrThrow(decodeGameSegments(["8", "10", "42", "202609"]))).toEqual(result);
  expect(Option.isSome(decodeGameSegments(["0", "10", "0", "202609"]))).toBe(true);
  expect(gameCardLines(result)).toEqual({ kind: "j", headline: "Acerté 8 de 10 en Cobro en Asado", lead: "Acerté", count: 8, tail: "de 10 en Cobro en Asado", detail: "¿Subió más o menos que la inflación?", footer: "Promedio GBA · septiembre 2026 · INDEC" });
  expect(gameSharedLine(result)).toBe("Alguien acertó 8 de 10. ¿Y vos?");
  expect(gameShareTarget(result)).toEqual({ path: "/c/j/8/10/42/202609", card: gameCardPath(result), text: gameCardLines(result).headline });
});

it("preserves a balanced historical game for seed 145 in January 2024", () => {
  const game = rounds(145, "202401");
  expect(game.filter((round) => round.answer === "mas")).toHaveLength(5);
  expect(game.filter((round) => round.answer === "menos")).toHaveLength(5);
});

const historicalMonths = [...Array.from({ length: Math.ceil((snapshot.ipc.length - 1) / 12) }, (_, index) => monthAt(snapshot, index * 12)), "202401"];
it.each(historicalMonths)("keeps every generated game balanced in %s across 20 seeds", (month) => {
  for (let seed = 0; seed < 20; seed++) {
    const game = gameRounds(snapshot, { seed, month });
    if (Option.isNone(game)) continue;
    expect(game.value).toHaveLength(10);
    expect(new Set(game.value.map((round) => round.unit)).size).toBe(10);
    expect(game.value.filter((round) => round.answer === "mas")).toHaveLength(5);
    expect(game.value.filter((round) => round.answer === "menos")).toHaveLength(5);
  }
});

it("returns none when distinct products cannot fill both answer quotas", () => {
  const oneSided = structuredClone(snapshot);
  oneSided.ipc = oneSided.ipc.map(() => 1);
  for (const prices of Object.values(oneSided.prices)) prices.forEach((_, index) => { prices[index] = index + 1; });
  expect(Option.isNone(gameRounds(oneSided, { seed: 145, month: "202401" }))).toBe(true);
});
