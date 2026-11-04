"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import * as Option from "effect/Option";
import { formatChange, monthLabel, monthWithDe, unitOf } from "../domain/format.ts";
import { friendLine, GAME_ROUNDS, gameRounds, gameSharedLine, gameShareTarget, MAX_SEED, roundMargin, roundOutcome, roundQuestionParts, roundReveal, roundSeries, roundVerdict, scoreAnswers, scoreLine, type Answer, type GameResult, type Round } from "../domain/game.ts";
import type { Month, Snapshot } from "../domain/snapshot.ts";
import { BigNumber } from "./BigNumber.tsx";
import { Share } from "./Share.tsx";
import { Sparkline } from "./Sparkline.tsx";
import { UnitIcon } from "./UnitIcon.tsx";

const BEST_KEY = "cobro-en-asado:mejor-racha";
// Each tap here swaps the buttons under the finger, so the second tap of a double tap must not land on what appeared. Nobody reads a question or a reveal this fast.
const TAP_GUARD_MS = 500;
// Otra partida is the one button that destroys a result, and it can sit under a slow extra tap on Ver el resultado.
const AGAIN_GUARD_MS = 1500;
const RECORD_FROM = 3;
// Not 1: today's seed plus one is tomorrow's daily game. 137 is coprime with 1000, so every seed still comes round.
const OTHER_GAME_STEP = 137;

function readBest(): number {
  try {
    const stored = Number(localStorage.getItem(BEST_KEY));
    return Number.isInteger(stored) && stored >= 0 && stored <= GAME_ROUNDS ? stored : 0;
  } catch {
    return 0;
  }
}

function writeBest(best: number) {
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // Blocked storage only costs the record across visits.
  }
}

function Marks({ rounds, picks, step }: { rounds: readonly Round[]; picks: readonly Answer[]; step: number }) {
  const { score } = scoreAnswers(rounds, picks);
  return (
    <ol className="game-marks" role="img" aria-label={`${score} ${score === 1 ? "acierto" : "aciertos"} hasta ahora`}>
      {rounds.map((round, index) => {
        const pick = picks[index];
        if (!pick) return <li key={index} className={index === step ? "game-mark game-mark-now" : "game-mark"} />;
        if (pick === round.answer) return <li key={index} className="game-mark game-mark-hit"><UnitIcon unit={round.unit} /></li>;
        return <li key={index} className="game-mark game-mark-miss"><XMark /></li>;
      })}
    </ol>
  );
}

const XMark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>
);

const Arrow = ({ up }: { up: boolean }) => (
  <svg viewBox="0 0 28 28" width="30" height="30" aria-hidden="true">
    <path d={up ? "M14 24V5M5 13l9-9 9 9" : "M14 4v19M5 15l9 9 9-9"} fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// The big number gets its own size, so the reveal can be read from the end of the sentence.
function RevealLine({ line, change, product }: { line: string; change: number; product?: boolean }) {
  const number = formatChange(change);
  const text = line.endsWith(number) ? line.slice(0, -number.length) : line;
  return (
    <p className={product ? "game-line game-line-product" : "game-line"}>
      <span>{text}</span>
      {line.endsWith(number) && <b>{number}</b>}
    </p>
  );
}

export function Game({ snapshot, seed, month, shared }: { snapshot: Snapshot; seed: number; month: Month; shared?: GameResult }) {
  const [game, setGame] = useState({ seed, month });
  const [friend, setFriend] = useState(shared);
  const [picks, setPicks] = useState<readonly Answer[]>([]);
  const [step, setStep] = useState(0);
  const [best, setBest] = useState(0);
  // The round that last beat the stored best, from a streak worth calling a record.
  const [recordStep, setRecordStep] = useState(-1);
  const moved = useRef(false);
  const lastTap = useRef(-TAP_GUARD_MS);
  const focusTarget = useRef<HTMLButtonElement & HTMLHeadingElement>(null);

  // shortcut: a seed with no valid game lands on the error page; none exists in today's data (see test/game.test.ts), recheck if the units change.
  const rounds = useMemo(() => Option.getOrThrow(gameRounds(snapshot, game)), [snapshot, game]);
  const { score, streak, bestStreak } = scoreAnswers(rounds, picks);
  const finished = step === GAME_ROUNDS;
  const revealed = picks.length > step;
  const round = rounds[finished ? 0 : step]!;

  useEffect(() => setBest(readBest()), []);

  // Whatever replaced the control the visitor just used takes the focus, and the first paint takes none.
  useEffect(() => {
    if (moved.current) focusTarget.current?.focus();
  }, [revealed, step, game]);

  function answer(pick: Answer) {
    if (revealed || finished) return;
    const next = [...picks, pick];
    moved.current = true;
    setPicks(next);
    const after = scoreAnswers(rounds, next).streak;
    if (after > best) {
      setBest(after);
      if (after >= RECORD_FROM) setRecordStep(step);
      writeBest(after);
    }
  }

  function advance() {
    setStep(step + 1);
  }

  function playAgain() {
    setGame({ seed: (game.seed + OTHER_GAME_STEP) % (MAX_SEED + 1), month: snapshot.lastMonth });
    setFriend(undefined);
    setPicks([]);
    setStep(0);
    setRecordStep(-1);
  }

  const right = revealed && picks[step] === round.answer;
  const lost = revealed && !right ? scoreAnswers(rounds, picks.slice(0, step)).streak : 0;
  // Always a word, so the hidden face holds the same height as the shown one.
  const verdict = roundVerdict(rounds, picks, finished ? 0 : step);
  const outcome = roundOutcome(round);
  const streakNote = !revealed ? "" : recordStep === step ? `¡Racha récord: ${streak}!` : right && streak >= 2 ? `Racha de ${streak}. No la pierdas.` : lost >= 2 ? `Se cortó una racha de ${lost}.` : "";
  const reveal = roundReveal(round);
  const unit = unitOf(round.unit);
  const question = roundQuestionParts(round);

  return (
    <main
      className="app game"
      onClickCapture={(event) => {
        const control = (event.target as Element).closest("button, a, summary");
        // Copiar link and Descargar imagen are two choices side by side, and appear from no double tap worth stopping.
        if (!control || control.closest(".share-actions")) return;
        const wait = control.matches(".game-again") ? AGAIN_GUARD_MS : TAP_GUARD_MS;
        if (event.timeStamp - lastTap.current < wait) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        // Only a tap that counts restarts the wait, so steady tapping can never lock the buttons.
        lastTap.current = event.timeStamp;
      }}
    >
      <div className="controls game-board">
        <h1 className="brand game-title"><UnitIcon unit="asado" />¿Más o menos?</h1>
        {friend && <p className="shared">{finished ? friendLine(friend.score, score) : gameSharedLine(friend)}</p>}
        {!finished && (
          <p className="game-top">
            <span className="game-count">{step + 1} de {GAME_ROUNDS}</span>
            <span key={streak} className={[streak > 0 ? "game-streak game-streak-on" : "game-streak", right ? (streak >= RECORD_FROM ? "game-streak-blaze" : "game-streak-grew") : ""].join(" ")}>
              <svg viewBox="0 0 20 24" width="18" height="22" aria-hidden="true">
                <path fill="currentColor" d="M10.5 1c1 4.300 6.800 6.600 6.800 13.300A7.400 7.400 0 0 1 10 22a7.400 7.400 0 0 1-7.300-7.700c0-3.100 1.500-5.200 3-6.800.2 1.900 1 3.100 2.200 3.700C7.500 7.800 8 4 10.500 1Z" />
              </svg>
              Racha: {streak}
            </span>
          </p>
        )}
        <Marks rounds={rounds} picks={picks} step={step} />
      </div>

      <div
        className="result-slot game-stage"
        // A held Enter would otherwise click through the reveal it just opened. Only Enter: a held arrow still has to scroll.
        onKeyDown={(event) => { if (event.repeat && event.key === "Enter") event.preventDefault(); }}
      >
        {finished ? (
          <>
            <article className="card game-card game-end" style={{ "--chars": 2 } as CSSProperties}>
              <div className="card-top">
                <p className="lead">Acertaste</p>
                <p className="stamp" aria-hidden="true"><UnitIcon unit="asado" />Cobro en Asado</p>
              </div>
              <h2 ref={focusTarget} tabIndex={-1} className="game-score" aria-label={`Acertaste ${score} de ${GAME_ROUNDS}.${friend ? ` ${friendLine(friend.score, score)}` : ""}`}>
                <BigNumber value={score} from={0} />
                <span className="unit">de {GAME_ROUNDS}</span>
              </h2>
              <div className="tray game-tray" aria-hidden="true">
                {Array.from({ length: score }, (_, index) => (
                  <span key={index} style={{ "--index": index } as CSSProperties}><UnitIcon unit="asado" /></span>
                ))}
              </div>
              <p className="game-band">{scoreLine(score)}</p>
              <div className="game-streaks">
                <p>Mejor racha de esta partida: {bestStreak}{recordStep >= 0 && <b className="game-record"> ¡Récord!</b>}</p>
                <p>Tu mejor racha: {best}</p>
              </div>
              <p className="card-foot">Promedio GBA · {monthLabel(game.month)} · INDEC</p>
            </article>
            <div className="game-actions game-end-actions">
              <Share target={gameShareTarget({ score, total: GAME_ROUNDS, seed: game.seed, month: game.month })} comparing={false} warning={false} />
              <button type="button" className="cta cta-quiet game-again" onClick={playAgain}>Otra partida</button>
            </div>
          </>
        ) : (
          <>
            {/* Both faces always hold their place, so the card keeps its height through the reveal. */}
            <article key={`${game.seed}-${step}`} className={`card game-card${revealed ? " is-revealed" : ""}${revealed && !right ? " is-wrong" : ""}${revealed && roundMargin(round) === "goleada" ? " is-rout" : ""}`}>
              <div className="game-face game-question">
                <div className="game-sticker"><UnitIcon unit={round.unit} /></div>
                <h2 ref={revealed ? undefined : focusTarget} tabIndex={-1} className="game-q">
                  <span className="game-q-since">{question.since}</span>{" "}
                  {/* The article stays with its word: a lone ¿el reads as a broken line. */}
                  <span className="game-q-product">¿{question.product.replace(" ", "\u00a0")}</span>{" "}
                  <span className="game-q-rest">{question.rest}</span>
                </h2>
              </div>
              <div className="game-face game-reveal">
                <div className="game-verdict">
                  <span className={right ? "game-seal game-seal-right" : "game-seal game-seal-wrong"} aria-hidden="true">
                    {right ? <svg viewBox="0 0 24 24"><path d="M5 13l5 5 9-11" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg> : <XMark />}
                  </span>
                  <div>
                    <p className="game-verdict-word">{verdict}</p>
                    <p className="game-verdict-note">{outcome}</p>
                    <p className={recordStep === step ? "game-verdict-streak game-verdict-record" : "game-verdict-streak"}>{streakNote}</p>
                  </div>
                </div>
                <div className="game-ticket">
                  <RevealLine line={reveal.product} change={round.productChange} product />
                  <RevealLine line={reveal.ipc} change={round.ipcChange} />
                  <Sparkline series={roundSeries(snapshot, round)} productName={unit.tile} />
                </div>
                <p className="card-foot">Precio promedio GBA · {monthLabel(round.start)} a {monthLabel(round.month)} · INDEC</p>
              </div>
            </article>
            <div className="game-actions">
              {revealed ? (
                <button ref={focusTarget} type="button" className="cta game-next" onClick={advance}>
                  {step === GAME_ROUNDS - 1 ? "Ver el resultado" : "Siguiente"}
                </button>
              ) : (
                <div className="game-answers">
                  <button type="button" className="cta game-answer" onClick={() => answer("mas")}><Arrow up />Más</button>
                  <button type="button" className="cta game-answer game-answer-down" onClick={() => answer("menos")}><Arrow up={false} />Menos</button>
                </div>
              )}
            </div>
          </>
        )}
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {revealed && !finished ? `${verdict} ${outcome} ${streakNote} ${reveal.product}. ${reveal.ipc}.` : ""}
        </p>
      </div>

      <section className="extras">
        <details>
          <summary>Cómo se juega</summary>
          <div className="panel">
            <p>Comparamos el precio promedio del producto en GBA con el IPC de GBA entre esos dos meses. Si subió más que la inflación, es Más.</p>
            <p>Las preguntas salen de los datos del INDEC, con datos hasta {monthWithDe(game.month)}. Dejamos afuera los casi empates, y de las diez, cinco van para cada lado.</p>
          </div>
        </details>
      </section>

      <footer>
        Fuente: <a href="https://www.indec.gob.ar" target="_blank" rel="noopener noreferrer">INDEC</a>
      </footer>
    </main>
  );
}
