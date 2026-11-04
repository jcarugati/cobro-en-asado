import * as Option from "effect/Option";
import { monthIndex } from "./calc.ts";
import { monthAt, rebase } from "./chart.ts";
import { formatChange, monthLabel, monthWithDe, unitOf } from "./format.ts";
import { validMonth, type CardLines, type ShareTarget } from "./share.ts";
import type { Month, Snapshot } from "./snapshot.ts";
import { UNITS, type UnitSlug } from "./units.ts";

export const GAME_ROUNDS = 10;
export const MAX_SEED = 999;
export type Answer = "mas" | "menos";
export type Round = { unit: UnitSlug; start: Month; month: Month; productChange: number; ipcChange: number; answer: Answer };
// Five percentage points keep short-span differences visible.
const MIN_POINT_GAP = 0.05;
// Twelve percent keeps reveals meaningful without fixing most products to one answer.
const PREFERRED_RELATIVE_GAP = 0.12;
// Five percent keeps balanced games available when a release leaves too few products.
const FALLBACK_RELATIVE_GAP = 0.05;

function mulberry32(seed: number): () => number {
  return () => {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export function gameRounds(snapshot: Snapshot, input: { seed: number; month: Month }): Option.Option<readonly Round[]> {
  const end = monthIndex(snapshot, input.month);
  if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > MAX_SEED || Option.isNone(end) || end.value < 12) return Option.none();
  for (const relativeGap of [PREFERRED_RELATIVE_GAP, FALLBACK_RELATIVE_GAP]) {
    const candidates = UNITS.map((unit) => {
      const rounds: Round[] = [];
      for (let index = 0; index <= end.value - 12; index++) {
        const productChange = snapshot.prices[unit.slug][end.value]! / snapshot.prices[unit.slug][index]! - 1;
        const ipcChange = snapshot.ipc[end.value]! / snapshot.ipc[index]! - 1;
        if (Math.abs(productChange - ipcChange) < MIN_POINT_GAP || Math.abs((1 + productChange) / (1 + ipcChange) - 1) < relativeGap) continue;
        rounds.push({ unit: unit.slug, start: monthAt(snapshot, index), month: input.month, productChange, ipcChange, answer: productChange > ipcChange ? "mas" : "menos" });
      }
      return rounds;
    });
    const random = mulberry32(input.seed);
    const targets = shuffled<Answer>(["mas", "mas", "mas", "mas", "mas", "menos", "menos", "menos", "menos", "menos"], random);
    const used = new Set<UnitSlug>();
    const rounds: Round[] = [];
    for (const target of targets) {
      const available = shuffled(candidates.filter((items) => items.length > 0 && !used.has(items[0]!.unit)), random);
      const remainingTargets = targets.slice(rounds.length + 1);
      const unit = available.find((items) => {
        if (!items.some((round) => round.answer === target)) return false;
        const remaining = available.filter((other) => other !== items);
        return remaining.length >= remainingTargets.length && (["mas", "menos"] as const).every((answer) =>
          remaining.filter((other) => other.some((round) => round.answer === answer)).length >= remainingTargets.filter((next) => next === answer).length);
      });
      if (!unit) break;
      const choices = unit.filter((round) => round.answer === target);
      const round = choices[Math.floor(random() * choices.length)]!;
      used.add(round.unit);
      rounds.push(round);
    }
    if (rounds.length === GAME_ROUNDS) return Option.some(rounds);
  }
  return Option.none();
}

export function roundSeries(snapshot: Snapshot, round: Round): { product: number[]; ipc: number[] } {
  const start = Option.getOrThrow(monthIndex(snapshot, round.start));
  const end = Option.getOrThrow(monthIndex(snapshot, round.month));
  return { product: rebase(snapshot.prices[round.unit].slice(0, end + 1), start), ipc: rebase(snapshot.ipc.slice(0, end + 1), start) };
}

export function roundQuestion(round: Round): string {
  const unit = unitOf(round.unit);
  return `Desde ${monthWithDe(round.start)}, ¿${unit.article} ${unit.tile.toLowerCase()} ${unit.article === "los" ? "subieron" : "subió"} más o menos que la inflación (IPC GBA)?`;
}

export function roundReveal(round: Round): { product: string; ipc: string } {
  const unit = unitOf(round.unit);
  const subject = `${unit.article[0]!.toUpperCase()}${unit.article.slice(1)} ${unit.tile.toLowerCase()}`;
  const move = (change: number, plural: boolean): string => change === 0 ? (plural ? "no cambiaron" : "no cambió")
    : `${change > 0 ? (plural ? "subieron" : "subió") : (plural ? "bajaron" : "bajó")} ${formatChange(change)}`;
  return { product: `${subject} ${move(round.productChange, unit.article === "los")}`, ipc: `La inflación ${move(round.ipcChange, false)}` };
}

export function scoreAnswers(rounds: readonly Round[], picks: readonly Answer[]): { score: number; streak: number; bestStreak: number } {
  let score = 0;
  let streak = 0;
  let bestStreak = 0;
  picks.slice(0, rounds.length).forEach((pick, index) => {
    if (pick === rounds[index]!.answer) { score++; streak++; bestStreak = Math.max(bestStreak, streak); }
    else streak = 0;
  });
  return { score, streak, bestStreak };
}
export const dailySeed = (now: number): number => Math.floor(now / 86_400_000) % (MAX_SEED + 1);

export type GameResult = { score: number; total: number; seed: number; month: Month };
export function decodeGameSegments(segments: readonly string[]): Option.Option<GameResult> {
  const [score, total, seed, month] = segments;
  if (segments.length !== 4 || !score || !total || !seed || !month
    || ![score, total, seed].every((part) => /^(0|[1-9]\d*)$/.test(part))
    || Number(total) !== GAME_ROUNDS || Number(score) > Number(total) || Number(seed) > MAX_SEED || !validMonth(month)) return Option.none();
  return Option.some({ score: Number(score), total: Number(total), seed: Number(seed), month });
}
export const gameCardPath = (result: GameResult): string => `/card/j/${result.score}/${result.total}/${result.seed}/${result.month}`;
export function gameCardLines(result: GameResult): CardLines {
  const tail = `de ${result.total} en Cobro en Asado`;
  return { kind: "j", headline: `Acerté ${result.score} ${tail}`, lead: "Acerté", count: result.score, tail,
    detail: "¿Subió más o menos que la inflación?", footer: `Promedio GBA · ${monthLabel(result.month)} · INDEC` };
}
export const gameShareTarget = (result: GameResult): ShareTarget => ({ path: gameCardPath(result).replace("/card/", "/c/"), card: gameCardPath(result), text: gameCardLines(result).headline });
export const gameSharedLine = (result: GameResult): string => `Alguien acertó ${result.score} de ${result.total}. ¿Y vos?`;
