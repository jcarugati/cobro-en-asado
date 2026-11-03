"use client";

import { type CSSProperties, useEffect, useLayoutEffect, useState } from "react";
import * as Result from "effect/Result";
import { altUnitOf, canastaShare, checkPastMonth, comparePast, tally, unitsFor } from "../domain/calc.ts";
import { countPhrase, formatCount, formatPercent, formatPesos, MONTH_NAMES, monthLabel, monthWithDe, ownMonthNote, pastLines, unitLabel } from "../domain/format.ts";
import { parsePay } from "../domain/pay.ts";
import type { Snapshot } from "../domain/snapshot.ts";
import { UNITS, type UnitSlug } from "../domain/units.ts";

type Preset = "cbtHogar2" | "crianzaMenor1";

const PRESET_BUTTONS: { key: Preset; label: string }[] = [
  { key: "cbtHogar2", label: "Una familia tipo" },
  { key: "crianzaMenor1", label: "Criar un bebé" },
];

// Marks are slightly off-square on purpose: printed ticket, tally added by hand.
const STROKES = ["M3 2 2 28", "M10 1 11 29", "M17 3 16 28", "M24 1 25 29"];
const STRIKE = "M-1 24 28 6";

function amountOf(text: string): number | null {
  const parsed = parsePay(text);
  return Result.isSuccess(parsed) ? parsed.success : null;
}

function BigNumber({ value }: { value: number }) {
  const target = Math.round(value);
  const [shown, setShown] = useState(0);

  useLayoutEffect(() => {
    const from = shown;
    // The size is fitted to the target, so counting down through longer numbers would overflow.
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || formatCount(from).length > formatCount(target).length) {
      setShown(target);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min(1, Math.max(0, (now - start) / 350));
      setShown(Math.round(from + (target - from) * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target]);

  const style = { "--chars": formatCount(target).length } as CSSProperties;
  return <span className="big" style={style}>{formatCount(shown)}</span>;
}

function Tally({ count }: { count: number }) {
  const { groups, overflow } = tally(count);
  return (
    <div className="tally" aria-hidden="true">
      {groups.map((marks, index) => (
        <svg key={index} viewBox="-3 0 34 30" width="34" height="30">
          <path d={marks === 5 ? `${STROKES.join(" ")} ${STRIKE}` : STROKES.slice(0, marks).join(" ")} />
        </svg>
      ))}
      {overflow > 0 && <span>+{formatCount(overflow)}</span>}
    </div>
  );
}

function Money({ id, label, value, onChange, example, note, large }: {
  id: string;
  label: string;
  value: string;
  onChange: (text: string) => void;
  example: string;
  note?: string;
  large?: boolean;
}) {
  const parsed = parsePay(value);
  const invalid = Result.isFailure(parsed) && parsed.failure === "invalid";
  const [hint, setHint] = useState("");

  // Typing 1.200.000 passes through invalid text like 1.2, so give it a moment before showing the hint.
  useEffect(() => {
    const timer = setTimeout(() => setHint(invalid ? `Escribilo así: ${example}` : ""), invalid ? 700 : 0);
    return () => clearTimeout(timer);
  }, [invalid, example]);

  return (
    <div className={large ? "money money-large" : "money"}>
      <label htmlFor={id}>{label}</label>
      <div className="field">
        <span aria-hidden="true">$</span>
        {/* numeric: iOS decimal pads show only the locale's comma, and pay is written with dots. */}
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid}
          aria-describedby={`${id}-hint${note ? ` ${id}-note` : ""}`}
        />
      </div>
      {note && <p id={`${id}-note`} className="note">{note}</p>}
      <p id={`${id}-hint`} className="hint" aria-live="polite">{hint}</p>
    </div>
  );
}

function Past({ snapshot, unit, pay, overridden, printed, hidden }: {
  snapshot: Snapshot;
  unit: UnitSlug;
  pay: number;
  overridden: boolean;
  printed: string;
  hidden: boolean;
}) {
  const [monthNumber, setMonthNumber] = useState("");
  const [year, setYear] = useState("");
  const [oldPayText, setOldPayText] = useState("");

  // Years before the data start stay on the list, so they get the refusal instead of a silent limit.
  const lastYear = Number(snapshot.lastMonth.slice(0, 4));
  const years = Array.from({ length: lastYear - 2009 }, (_, index) => lastYear - index);

  const month = monthNumber && year ? year + monthNumber : null;
  const check = month ? checkPastMonth(snapshot, month) : null;
  const oldPay = amountOf(oldPayText);
  const comparison = month && oldPay !== null ? comparePast(snapshot, { unit, pay, oldPay, month }) : null;

  return (
    <details hidden={hidden}>
      <summary>¿Y antes?</summary>
      <div className="panel">
        <div className="when">
          <div>
            <label htmlFor="past-month">Mes</label>
            <select id="past-month" value={monthNumber} onChange={(event) => setMonthNumber(event.target.value)}>
              <option value="">Elegí</option>
              {MONTH_NAMES.map((name, index) => <option key={name} value={String(index + 1).padStart(2, "0")}>{name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="past-year">Año</label>
            <select id="past-year" value={year} onChange={(event) => setYear(event.target.value)}>
              <option value="">Elegí</option>
              {years.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>
        <Money id="past-pay" label="Lo que cobrabas ese mes" value={oldPayText} onChange={setOldPayText} example="30.000" />
        <div className="past" aria-live="polite">
          {check && Result.isFailure(check) && (
            <p>
              {check.failure === "tooEarly"
                ? `Estos precios arrancan en ${monthWithDe(snapshot.firstMonth)}. Elegí un mes desde ahí en adelante.`
                : `Elegí un mes anterior a ${monthWithDe(snapshot.lastMonth)}.`}
            </p>
          )}
          {month && comparison && Result.isSuccess(comparison) && (
            <>
              {pastLines(unit, month, comparison.success).map((line) => <p key={line}>{line}</p>)}
              {overridden && <p>Esta comparación usa precios INDEC en los dos meses, no el de tu carnicería.</p>}
              <p className="printed">{printed}</p>
            </>
          )}
        </div>
      </div>
    </details>
  );
}

export function Calculator({ snapshot }: { snapshot: Snapshot }) {
  const [payText, setPayText] = useState("");
  // Last valid pay: half-typed text like 1.2 keeps the result on screen instead of flashing the opening state.
  const [pay, setPay] = useState<number | null>(null);
  const [preset, setPreset] = useState<Preset | null>(null);
  const [unit, setUnit] = useState<UnitSlug>("asado");
  const [overrideText, setOverrideText] = useState("");

  const priceOf = (slug: UnitSlug) => snapshot.prices[slug].at(-1)!;
  const definition = UNITS.find((item) => item.slug === unit)!;
  const printed = `Promedio GBA · ${monthLabel(snapshot.lastMonth)} · INDEC`;

  const parsedPay = parsePay(payText);
  const stale = Result.isFailure(parsedPay) && parsedPay.failure === "invalid" && pay !== null;
  const amount = preset ? snapshot.presets[preset].value : pay;
  const overridePrice = amountOf(overrideText);
  const count = amount === null ? 0 : unitsFor(amount, overridePrice ?? priceOf(unit));

  const lead = preset === "cbtHogar2" ? "La canasta de una familia tipo son"
    : preset === "crianzaMenor1" ? "Criar un bebé menor de 1 año son"
    : "Cobrás";
  const tail = `${unitLabel(unit, count)}${preset !== null ? " por mes" : ""}${overridePrice !== null ? " a precio de tu carnicería" : ""}.`;

  return (
    <main className={stale ? "ticket stale" : "ticket"}>
      <h1>Cobro en Asado</h1>

      <section>
        <Money
          id="pay"
          large
          label="¿Cuánto te cae en la cuenta por mes?"
          note="Sin aguinaldo. El número no sale de tu teléfono."
          example="1.200.000"
          value={payText}
          onChange={(text) => {
            setPayText(text);
            setPreset(null);
            const parsed = parsePay(text);
            if (Result.isSuccess(parsed)) setPay(parsed.success);
            else if (parsed.failure === "empty") {
              setPay(null);
              setOverrideText("");
            }
          }}
        />
      </section>

      <section className="figures">
        {amount !== null && (
          <>
            {/* The animated number stays outside the live region, so only the final sentence is announced. */}
            <p className="headline result" aria-hidden="true">
              <span>{lead}</span>
              <BigNumber value={count} />
              <span>{tail}</span>
            </p>
            {/* Outside the live region too, or the first announcement would read all 22 names. */}
            <p id="units-label">Contalo en:</p>
            <div className="tiles units" role="group" aria-labelledby="units-label">
              {UNITS.map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  aria-pressed={unit === item.slug}
                  onClick={() => {
                    setUnit(item.slug);
                    if (item.slug !== unit) setOverrideText("");
                  }}
                  onFocus={(event) => {
                    // Browsers leave a partly visible tile cut off. Keyboard only: moving it under a pressed pointer would lose the click.
                    if (event.currentTarget.matches(":focus-visible")) event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
                  }}
                >
                  {item.tile}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="lines result" aria-live="polite">
          {amount === null ? (
            <>
              <p className="tagline">Tu sueldo, en la unidad que entendemos todos: kilos de asado.</p>
              <p>Un kilo de asado, precio promedio: {formatPesos(priceOf("asado"))}.</p>
            </>
          ) : (
            <>
              {/* One string, so a changed count announces the sentence and not a bare number. */}
              <p className="sr-only">{`${lead} ${formatCount(count)} ${tail}`}</p>
              <p className="alternate">O {countPhrase(altUnitOf(unit), unitsFor(amount, priceOf(altUnitOf(unit))))}.</p>
              {preset === null && (
                <p>Equivale al {formatPercent(canastaShare(snapshot, amount))} de la canasta básica total de un hogar de 4 en GBA{ownMonthNote(snapshot.presets.cbtHogar2.month, snapshot.lastMonth)}.</p>
              )}
              {preset === "cbtHogar2" && (
                <p>Es la canasta básica total de un hogar de 4 en GBA{ownMonthNote(snapshot.presets.cbtHogar2.month, snapshot.lastMonth)}.</p>
              )}
              {preset === "crianzaMenor1" && (
                <p>Canasta de crianza{ownMonthNote(snapshot.presets.crianzaMenor1.month, snapshot.lastMonth)}: incluye el valor del tiempo de cuidado.</p>
              )}
              <Tally count={count} />
            </>
          )}
          <p className="printed">{printed}</p>
        </div>
      </section>

      <section>
        <p id="presets-label">¿Preferís no escribirlo? Probá con:</p>
        <div className="tiles" role="group" aria-labelledby="presets-label">
          {PRESET_BUTTONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={preset === key}
              onClick={() => {
                setPreset(preset === key ? null : key);
                setPayText("");
                setPay(null);
                // Turning a preset off also returns to the opening state, where the override field is gone.
                if (preset === key) setOverrideText("");
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="more">
        {/* Stays mounted so correcting the pay keeps its three fields. Hidden whenever pay is the placeholder 0. */}
        <Past
          snapshot={snapshot}
          unit={unit}
          pay={pay ?? 0}
          overridden={overridePrice !== null}
          printed={printed}
          hidden={pay === null || preset !== null}
        />
        {amount !== null && (
          <details>
            <summary>¿En tu carnicería está a otro precio?</summary>
            <div className="panel">
              <Money
                id="override"
                label={`Precio por ${definition.priceUnit}`}
                note={`Precio promedio INDEC: ${formatPesos(priceOf(unit))}. Cambia solo el número grande y las marcas.`}
                example={formatCount(priceOf(unit))}
                value={overrideText}
                onChange={setOverrideText}
              />
            </div>
          </details>
        )}
        <details>
          <summary>Cómo se calcula</summary>
          <div className="panel">
            <p>Dividimos lo que escribís por el precio promedio de cada producto. La cuenta se hace en tu teléfono.</p>
            <p>Las fuentes son del INDEC: precios promedio e IPC de GBA, canasta básica total y canasta de crianza. Los datos son de {monthLabel(snapshot.lastMonth)}.</p>
            <p>Vale solo para GBA. Son promedios publicados, no el precio de una carnicería ni de una marca, y salen con demora: el INDEC los publica el mes siguiente.</p>
            <p>¿Y antes? compara con los precios en general (IPC GBA). No es una medida de tu inflación personal.</p>
          </div>
        </details>
      </section>

      <footer>
        Fuente: <a href="https://www.indec.gob.ar" target="_blank" rel="noopener noreferrer">INDEC</a>
      </footer>
    </main>
  );
}
