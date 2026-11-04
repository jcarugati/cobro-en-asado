import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import * as Option from "effect/Option";
import { dailySeed, decodeGameSegments, friendLine, gameCardLines, gameCardPath, gameRounds, gameSharedLine, gameShareTarget, roundOutcome, roundQuestionParts, GAME_ROUNDS, MAX_SEED, roundReveal, roundSeries, roundVerdict, scoreAnswers, scoreLine, type Round } from "../src/domain/game.ts";
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
      expect(Math.abs((1 + round.productChange) / (1 + round.ipcChange) - 1)).toBeGreaterThanOrEqual(0.12);
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
  const rest = "más o menos que la inflación (IPC GBA)?";
  expect(roundQuestionParts(round)).toEqual({ since: "Desde enero de 2019,", product: "el asado", rest: `subió ${rest}` });
  expect(roundQuestionParts({ ...round, unit: "yerba" })).toEqual({ since: "Desde enero de 2019,", product: "la yerba", rest: `subió ${rest}` });
  expect(roundQuestionParts({ ...round, unit: "huevos" })).toEqual({ since: "Desde enero de 2019,", product: "los huevos", rest: `subieron ${rest}` });
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
  expect(gameCardLines(result)).toEqual({ kind: "j", headline: "Acerté 8 de 10 en Cobro en Asado", lead: "Acerté", count: 8, tail: "de 10 en Cobro en Asado", detail: "Se nota que mirás el cartelito antes de meterlo al changuito.", footer: "Promedio GBA · septiembre 2026 · INDEC" });
  expect(gameSharedLine(result)).toBe("Alguien acertó 8 de 10. ¿Y vos?");
  expect(gameShareTarget(result)).toEqual({ path: "/c/j/8/10/42/202609", card: gameCardPath(result), text: gameCardLines(result).headline });
});

it("reserves enough products for both answer quotas for seed 145 in January 2024", () => {
  const game = rounds(145, "202401");
  expect(game.filter((round) => round.answer === "mas")).toHaveLength(5);
  expect(game.filter((round) => round.answer === "menos")).toHaveLength(5);
  expect(game.every((round) => Math.abs((1 + round.productChange) / (1 + round.ipcChange) - 1) >= 0.12)).toBe(true);
});

it("falls back to five percent for seed 0 in June 2018", () => {
  const game = rounds(0, "201806");
  expect(game).toEqual(rounds(0, "201806"));
  expect(game).toHaveLength(10);
  expect(new Set(game.map((round) => round.unit)).size).toBe(10);
  expect(game.filter((round) => round.answer === "mas")).toHaveLength(5);
  expect(game.filter((round) => round.answer === "menos")).toHaveLength(5);
  expect(game.some((round) => Math.abs((1 + round.productChange) / (1 + round.ipcChange) - 1) < 0.12)).toBe(true);
  for (const round of game) {
    expect(Math.abs(round.productChange - round.ipcChange)).toBeGreaterThanOrEqual(0.05);
    expect(Math.abs((1 + round.productChange) / (1 + round.ipcChange) - 1)).toBeGreaterThanOrEqual(0.05);
  }
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

it.each([1, 1.06])("keeps games balanced after 12 months of prices ×%s and IPC ×1.02", (growth) => {
  const future = structuredClone(snapshot);
  for (let month = 0; month < 12; month++) {
    future.ipc.push(future.ipc.at(-1)! * 1.02);
    for (const prices of Object.values(future.prices)) prices.push(prices.at(-1)! * growth);
  }
  future.lastMonth = "202709";
  for (let seed = 0; seed < 20; seed++) {
    const game = rounds(seed, "202709", future);
    expect(game).toEqual(rounds(seed, "202709", future));
    expect(game).toHaveLength(10);
    expect(new Set(game.map((round) => round.unit)).size).toBe(10);
    expect(game.filter((round) => round.answer === "mas")).toHaveLength(5);
    expect(game.filter((round) => round.answer === "menos")).toHaveLength(5);
    for (const round of game) {
      expect(Math.abs(round.productChange - round.ipcChange)).toBeGreaterThanOrEqual(0.05);
      expect(Math.abs((1 + round.productChange) / (1 + round.ipcChange) - 1)).toBeGreaterThanOrEqual(0.05);
    }
  }
});
it("has a game for every seed, since Otra partida walks them all", () => {
  for (let seed = 0; seed <= MAX_SEED; seed++) expect(Option.isSome(gameRounds(snapshot, { seed, month: snapshot.lastMonth })), String(seed)).toBe(true);
});
it("gives each score band its line, and the 4 to 5 band teases the always-same-button score", () => {
  const bands = [[10, "Diez de diez"], [9, "cartelito"], [8, "cartelito"], [7, "raspando"], [6, "raspando"], [5, "sacabas 5"], [4, "sacabas 5"], [3, "rueda"], [0, "rueda"]] as const;
  for (const [score, text] of bands) expect(scoreLine(score)).toContain(text);
});
it("compares with the friend's score", () => {
  expect(friendLine(8, 9)).toBe("Alguien sacó 8. Le ganaste.");
  expect(friendLine(8, 8)).toBe("Alguien sacó 8. Empataron.");
  expect(friendLine(8, 7)).toBe("Alguien sacó 8. Te ganó.");
});
it("picks the verdict from right or wrong and the margin", () => {
  const months = Array.from({ length: 96 }, (_, index) => monthAt(snapshot, index));
  const lines = (pick: "mas" | "menos", productChange: number) => new Set(months.map((start) => roundVerdict([{ ...round, start, productChange, ipcChange: 1 }], [pick], 0)));
  const sets = (["menos", "mas"] as const).flatMap((pick) => [1.1, 1.5, 3].map((margin) => lines(pick, margin)));
  // Six separate lists, so a rout lost never reads like anything else.
  const every = sets.flatMap((set) => [...set]);
  expect(new Set(every).size).toBe(every.length);
  for (const set of sets) expect(set.size).toBeGreaterThanOrEqual(3);
  for (const line of every) expect(line.length).toBeLessThanOrEqual(14);
});
it("never repeats a verdict back to back across every seed, and the same answers read the same", () => {
  for (let seed = 0; seed <= MAX_SEED; seed++) {
    const game = rounds(seed);
    const right = game.map((item) => item.answer);
    const wrong = game.map((item) => item.answer === "mas" ? "menos" as const : "mas" as const);
    // Mixed answers vary by seed, so neighbours from different lists and from the same list both come up.
    const mixed = game.map((item, index) => (seed >> (index % 10)) & 1 ? item.answer : wrong[index]!);
    for (const picks of [right, wrong, mixed, ["mas", "mas", "mas", "mas", "mas", "mas", "mas", "mas", "mas", "mas"] as const]) {
      const lines = game.map((_, index) => roundVerdict(game, picks, index));
      lines.forEach((line, index) => { if (index > 0) expect(line, `seed ${seed} round ${index}`).not.toBe(lines[index - 1]); });
      expect(lines).toEqual(game.map((_, index) => roundVerdict(game, picks, index)));
      // Later answers can't rewrite a verdict already on screen.
      lines.forEach((line, index) => expect(roundVerdict(game, picks.slice(0, index + 1), index)).toBe(line));
    }
  }
});
it("reads as the wrong list until a round is answered, so the hidden face holds a real line", () => {
  const game = rounds(0);
  const wrong = game[0]!.answer === "mas" ? "menos" as const : "mas" as const;
  expect(roundVerdict(game, [], 0)).toBe(roundVerdict(game, [wrong], 0));
});
it("says how far apart the two ended, from the ratio of the rises the reveal prints", () => {
  const cases = [[1.06, "Era más, por poco."], [1.24, "Era más, por poco."], [1.25, "Era más, por bastante."], [1.99, "Era más, por bastante."], [2, "Era más, por goleada."]] as const;
  for (const [ratio, text] of cases) expect(roundOutcome({ ...round, productChange: ratio, ipcChange: 1, answer: "mas" })).toBe(text);
  expect(roundOutcome({ ...round, productChange: 0.2, ipcChange: 0.5, answer: "menos" })).toBe("Era menos, por goleada.");
  expect(roundOutcome({ ...round, productChange: 60, ipcChange: 70, answer: "menos" })).toBe("Era menos, por poco.");
});
it("calls a price that fell or stood still against one that rose a rout", () => {
  expect(roundOutcome({ ...round, productChange: -0.023, ipcChange: 0.415, answer: "menos" })).toBe("Era menos, por goleada.");
  expect(roundOutcome({ ...round, productChange: 0, ipcChange: 0.3, answer: "menos" })).toBe("Era menos, por goleada.");
});
it("keeps the stylesheet's braces balanced, which a merge of two blocks at its end can break with every other gate green", async () => {
  const css = (await readFile(new URL("../app/globals.css", import.meta.url), "utf8")).replace(/\/\*[\s\S]*?\*\//g, "");
  expect(css.split("{").length).toBe(css.split("}").length);
});
