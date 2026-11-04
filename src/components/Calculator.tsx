"use client";

import { type ChangeEvent, type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import * as Result from "effect/Result";
import { altUnitOf, canastaShare, checkPastMonth, comparePast, iconGrid, unitsFor } from "../domain/calc.ts";
import { countPhrase, formatCount, formatPercent, formatPesos, MONTH_NAMES, monthLabel, monthWithDe, ownMonthNote, pastLines, unitLabel } from "../domain/format.ts";
import { caretAfterGrouping, groupWhileTyping, parsePay, withDots } from "../domain/pay.ts";
import type { Snapshot } from "../domain/snapshot.ts";
import { cardLines, shareResultFor, sharedLine, sharedParts, shareTarget, type ShareResult } from "../domain/share.ts";
import { UNITS, type UnitSlug } from "../domain/units.ts";
import { RaceChart } from "./RaceChart.tsx";
import { Share } from "./Share.tsx";
import { UnitIcon } from "./UnitIcon.tsx";

type Preset = "cbtHogar2" | "crianzaMenor1";

const PRESET_BUTTONS: { key: Preset; label: string }[] = [
  { key: "cbtHogar2", label: "Una familia tipo" },
  { key: "crianzaMenor1", label: "Criar un bebé" },
];

const FEATURED: readonly UnitSlug[] = ["asado", "yerba", "cerveza", "vino", "dulce-de-leche", "panales"];
const tileOf = (slug: UnitSlug) => UNITS.find((item) => item.slug === slug)!.tile;

function amountOf(text: string): number | null {
  const parsed = parsePay(text);
  return Result.isSuccess(parsed) ? parsed.success : null;
}

function BigNumber({ value, from }: { value: number; from: number }) {
  const target = Math.round(value);
  const [shown, setShown] = useState(from);

  useLayoutEffect(() => {
    const start = shown;
    if (start === target) return;
    // The size is fitted to the target, so counting down through longer numbers would overflow.
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || formatCount(start).length > formatCount(target).length) {
      setShown(target);
      return;
    }
    const began = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min(1, Math.max(0, (now - began) / 650));
      setShown(Math.round(start + (target - start) * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return <span className="big">{formatCount(shown)}</span>;
}

function Tray({ unit, count }: { unit: UnitSlug; count: number }) {
  const { icons, columns } = iconGrid(count);
  return (
    <div className="tray" aria-hidden="true" style={{ "--columns": columns, "--rows": Math.max(1, Math.ceil(icons / columns)) } as CSSProperties}>
      {Array.from({ length: icons }, (_, index) => (
        <span key={index} style={{ "--index": index } as CSSProperties}><UnitIcon unit={unit} /></span>
      ))}
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

  // Typing 1.200.000 with its dots passes through invalid text like 1.2, so the hint waits for a pause in typing.
  useEffect(() => {
    const timer = setTimeout(() => setHint(invalid ? `Escribilo así: ${example}` : ""), invalid ? 700 : 0);
    return () => clearTimeout(timer);
  }, [invalid, example, value]);

  function regroup(event: ChangeEvent<HTMLInputElement>) {
    const field = event.currentTarget;
    const typed = field.value;
    const { inputType } = event.nativeEvent as InputEvent;
    // A paste may carry a decimal point, so it only gets dots if it already parses.
    if (inputType === "insertFromPaste" || inputType === "insertFromDrop") return onChange(withDots(typed));
    // Deleting from a valid amount only leaves its own group dots. Anything else may hold a dot meant as a decimal point.
    const grouped = groupWhileTyping(typed, invalid || !inputType?.startsWith("delete"));
    if (grouped !== typed) {
      const kept = typed.slice(0, field.selectionStart ?? typed.length).replace(/\./g, "").length;
      const caret = caretAfterGrouping(grouped, kept);
      // Delete steps over a dot, or it would stop there forever.
      const at = inputType === "deleteContentForward" && grouped[caret] === "." ? caret + 1 : caret;
      // Written here so React finds it already done and leaves the caret alone.
      field.value = grouped;
      field.setSelectionRange(at, at);
    }
    onChange(grouped);
  }

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
          autoFocus={large}
          spellCheck={false}
          placeholder={large ? example : undefined}
          value={value}
          onChange={regroup}
          aria-invalid={invalid}
          aria-describedby={`${id}-hint${note ? ` ${id}-note` : ""}`}
        />
      </div>
      {note && <p id={`${id}-note`} className="note">{note}</p>}
      <p id={`${id}-hint`} className="hint" aria-live="polite">{hint}</p>
    </div>
  );
}

function UnitPicker({ unit, onPick }: { unit: UnitSlug; onPick: (slug: UnitSlug) => void }) {
  const sheet = useRef<HTMLDialogElement>(null);
  const row = useRef<HTMLDivElement>(null);
  // Its 22 icons wait for the first open: in the page's HTML they cost a round trip on every visit, and few visitors open it.
  const [sheetOpened, setSheetOpened] = useState(false);
  // A unit picked from the sheet takes the first place.
  const shown = FEATURED.includes(unit) ? FEATURED : [unit, ...FEATURED.slice(0, -1)];

  // A shared link or the sheet can pick a pill the row has scrolled away. Not scrollIntoView, which can also scroll the page. Más covers the row's right end, so a pill under it counts as hidden.
  useEffect(() => {
    const pill = row.current?.querySelector("[aria-pressed=true]");
    const more = row.current?.lastElementChild;
    if (!row.current || !pill || !more) return;
    const { left, right } = pill.getBoundingClientRect();
    const start = row.current.getBoundingClientRect().left + 16;
    if (left < start || right > more.getBoundingClientRect().left) row.current.scrollLeft += left - start;
  }, [unit]);

  return (
    <div className="picker">
      <p id="units-label" className="caption">Contalo en:</p>
      <div className="units" role="group" aria-labelledby="units-label" ref={row}>
        {shown.map((slug) => (
          <button
            key={slug}
            type="button"
            className="pill"
            aria-pressed={unit === slug}
            onClick={() => onPick(slug)}
            onFocus={(event) => {
              // Browsers leave a partly visible pill cut off. Keyboard only: moving it under a pressed pointer would lose the click.
              if (event.currentTarget.matches(":focus-visible")) event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
            }}
          >
            <UnitIcon unit={slug} />
            {tileOf(slug)}
          </button>
        ))}
        <div className="more-slot">
          <button
            type="button"
            className="pill pill-more"
            aria-haspopup="dialog"
            onClick={() => {
              setSheetOpened(true);
              sheet.current?.showModal();
            }}
          >
            Más
          </button>
        </div>
      </div>
      {/* The body is inside the dialog's edge, so a click that lands on the dialog itself is a click on the backdrop. */}
      <dialog ref={sheet} className="sheet" aria-labelledby="sheet-title" onClick={(event) => { if (event.target === sheet.current) sheet.current?.close(); }}>
        <div className="sheet-body">
          <div className="sheet-top">
            <h2 id="sheet-title">Contalo en</h2>
            <button type="button" className="sheet-close" aria-label="Cerrar" onClick={() => sheet.current?.close()}>×</button>
          </div>
          {sheetOpened && (
            <div className="sheet-units">
              {UNITS.map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  aria-pressed={unit === item.slug}
                  onClick={() => {
                    onPick(item.slug);
                    sheet.current?.close();
                  }}
                >
                  <UnitIcon unit={item.slug} />
                  {item.tile}
                </button>
              ))}
            </div>
          )}
        </div>
      </dialog>
    </div>
  );
}

type PastResult = ReturnType<typeof comparePast> | null;
type PastForm = { monthNumber: string; year: string; oldPayText: string };

function Past({ snapshot, unit, overridden, printed, hidden, form, onForm, month, comparison, onOpen }: {
  snapshot: Snapshot;
  unit: UnitSlug;
  overridden: boolean;
  printed: string;
  hidden: boolean;
  form: PastForm;
  onForm: (change: Partial<PastForm>) => void;
  month: string | null;
  comparison: PastResult;
  onOpen: (open: boolean) => void;
}) {
  const { monthNumber, year, oldPayText } = form;

  // Years before the data start stay on the list, so they get the refusal instead of a silent limit.
  const lastYear = Number(snapshot.lastMonth.slice(0, 4));
  const years = Array.from({ length: lastYear - 2009 }, (_, index) => lastYear - index);

  const check = month ? checkPastMonth(snapshot, month) : null;

  return (
    <details hidden={hidden} onToggle={(event) => onOpen(event.currentTarget.open)}>
      <summary>¿Y antes?</summary>
      <div className="panel">
        <div className="when">
          <div>
            <label htmlFor="past-month">Mes</label>
            <select id="past-month" value={monthNumber} onChange={(event) => onForm({ monthNumber: event.target.value })}>
              <option value="">Elegí</option>
              {MONTH_NAMES.map((name, index) => <option key={name} value={String(index + 1).padStart(2, "0")}>{name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="past-year">Año</label>
            <select id="past-year" value={year} onChange={(event) => onForm({ year: event.target.value })}>
              <option value="">Elegí</option>
              {years.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>
        <Money id="past-pay" label="Lo que cobrabas ese mes" value={oldPayText} onChange={(text) => onForm({ oldPayText: text })} example="30.000" />
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
              <p className="note">{printed}</p>
            </>
          )}
        </div>
      </div>
    </details>
  );
}

export function Calculator({ snapshot, shared }: { snapshot: Snapshot; shared?: ShareResult }) {
  const [payText, setPayText] = useState("");
  // Last valid pay: half-typed text like 1.2 keeps the result on screen instead of flashing the opening state.
  const [pay, setPay] = useState<number | null>(null);
  const [preset, setPreset] = useState<Preset | null>(null);
  const beforePreset = useRef<{ text: string; pay: number | null }>({ text: "", pay: null });
  const [unit, setUnit] = useState<UnitSlug>(shared?.unit ?? "asado");
  const [overrideText, setOverrideText] = useState("");
  const [pastForm, setPastForm] = useState<PastForm>({ monthNumber: "", year: "", oldPayText: "" });
  const [pastOpen, setPastOpen] = useState(false);

  // Dims the old result only after a pause, so correct typing passing through invalid text never flashes.
  const [settledText, setSettledText] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSettledText(payText), 700);
    return () => clearTimeout(timer);
  }, [payText]);

  const priceOf = (slug: UnitSlug) => snapshot.prices[slug].at(-1)!;
  const definition = UNITS.find((item) => item.slug === unit)!;
  const printed = `Promedio GBA · ${monthLabel(snapshot.lastMonth)} · INDEC`;

  const parsedPay = parsePay(payText);
  const stale = settledText === payText && Result.isFailure(parsedPay) && parsedPay.failure === "invalid" && pay !== null;
  const amount = preset ? snapshot.presets[preset].value : pay;
  const overridePrice = amountOf(overrideText);
  const count = amount === null ? 0 : unitsFor(amount, overridePrice ?? priceOf(unit));

  const pastMonth = pastForm.monthNumber && pastForm.year ? pastForm.year + pastForm.monthNumber : null;
  const oldPay = amountOf(pastForm.oldPayText);
  const comparison = pay !== null && pastMonth && oldPay !== null ? comparePast(snapshot, { unit, pay, oldPay, month: pastMonth }) : null;
  // Only what the visitor can see goes out: a comparison folded away is not shared.
  const pastShown = pastOpen && pastMonth && comparison && Result.isSuccess(comparison) ? { month: pastMonth, ...comparison.success } : null;
  const target = pay !== null && preset === null && !stale ? shareTarget(shareResultFor(snapshot, { unit, pay, overridePrice, past: pastShown })) : null;

  const lead = preset === "cbtHogar2" ? "Por mes, la canasta de una familia tipo son"
    : preset === "crianzaMenor1" ? "Por mes, criar un bebé menor de 1 año son"
    : "Cobrás";
  const tail = `${unitLabel(unit, count)}${overridePrice !== null ? " a precio de tu carnicería" : ""}.`;

  // Until the visitor has a number, the card holds the shared result, or the shape of the result to come.
  const friend = amount === null && shared?.unit === unit ? { ...sharedParts(shared), footer: cardLines(shared).footer } : null;
  const shownCount = friend ? friend.count : count;
  const each = amount === null && !friend ? 1 : iconGrid(shownCount).each;

  return (
    <main className={stale ? "app stale" : "app"}>
      <div className="controls">
        <h1 className="brand"><UnitIcon unit="asado" />Cobro en Asado</h1>
        {shared && <p className="shared">{sharedLine(shared)}</p>}
        <Money
          id="pay"
          large
          label="¿Cuánto te cae en la cuenta por mes?"
          note="Sin aguinaldo. El número no se manda a ningún lado."
          example="1.200.000"
          value={payText}
          onChange={(text) => {
            setPayText(text);
            setPreset(null);
            const parsed = parsePay(text);
            if (Result.isSuccess(parsed)) setPay(parsed.success);
            else if (parsed.failure === "empty" || pay === null) {
              setPay(null);
              setOverrideText("");
            }
          }}
        />
        <UnitPicker
          unit={unit}
          onPick={(slug) => {
            setUnit(slug);
            if (slug !== unit) setOverrideText("");
          }}
        />
      </div>

      {/* The stretched slot is what stops the sticky card above the chart: browsers bound a sticky grid item by the whole grid. */}
      <div className="result-slot">
        <section className="result">
          {/* Its own live region, so screen readers reach the result in one sentence. The animated number stays outside it, so only the final sentence is announced. */}
          <p className="sr-only" aria-live="polite">{amount === null ? "" : `${lead} ${formatCount(count)} ${tail}`}</p>
          <article className="card" style={{ "--chars": amount === null && !friend ? 2 : formatCount(shownCount).length } as CSSProperties}>
            <div aria-hidden="true" className="card-top">
              <span className="lead">{friend ? friend.lead : lead}</span>
              <span className="stamp"><UnitIcon unit="asado" />Cobro en Asado</span>
            </div>
            <p aria-hidden="true" className="headline">
              {amount === null && !friend
                ? <span className="big big-unknown">¿?</span>
                : <BigNumber value={shownCount} from={friend ? friend.count : 0} />}
              <span className="unit">{friend ? friend.tail : amount === null ? `${definition.plural}.` : tail}</span>
            </p>
            {each > 1 && <p aria-hidden="true" className="legend">{`Cada ícono: ${countPhrase(unit, each)}.`}</p>}
            {/* One tray per unit, so changing unit drops a new pile while typing only adds to it. */}
            {amount === null && !friend
              ? <div className="ghost"><Tray key={unit} unit={unit} count={18} /></div>
              : <Tray key={unit} unit={unit} count={shownCount} />}
            <div className="card-foot">
              {/* A shared count comes from its own month's price, which may not be today's, and may be a butcher's. */}
              {!friend && <p>{`Precio promedio: ${formatPesos(priceOf(unit))} por ${definition.priceUnit}.`}</p>}
              <p>{friend ? friend.footer : printed}</p>
            </div>
          </article>
          {/* The key resets it on any change to the pay, unit or override: kept file, status and fallback. Values, not text: a regrouped text must not remount the button being tapped, or the tap is lost. */}
          {amount !== null && <Share key={`${target?.path} ${pay} ${overridePrice}`} target={target} comparing={pastShown !== null} />}
          <div className="facts" aria-live="polite">
            {amount === null ? (
              <p className="tagline">Tu sueldo, en la unidad que entendemos todos: kilos de asado.</p>
            ) : (
              <>
                <p className="alternate">{`O ${countPhrase(altUnitOf(unit), unitsFor(amount, priceOf(altUnitOf(unit))))}.`}</p>
                {preset === null && (
                  <p>{`Equivale al ${formatPercent(canastaShare(snapshot, amount))} de la canasta básica total de un hogar de 4 en GBA${ownMonthNote(snapshot.presets.cbtHogar2.month, snapshot.lastMonth)}.`}</p>
                )}
                {preset === "cbtHogar2" && (
                  <p>Es la canasta básica total de un hogar de 4 en GBA{ownMonthNote(snapshot.presets.cbtHogar2.month, snapshot.lastMonth)}.</p>
                )}
                {preset === "crianzaMenor1" && (
                  <p>Canasta de crianza{ownMonthNote(snapshot.presets.crianzaMenor1.month, snapshot.lastMonth)}: incluye el valor del tiempo de cuidado.</p>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      <section className="extras">
      <div className="presets">
        <p id="presets-label" className="caption">¿Preferís no escribirlo? Probá con:</p>
        <div className="chips" role="group" aria-labelledby="presets-label">
          {PRESET_BUTTONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className="chip"
              aria-pressed={preset === key}
              onClick={() => {
                if (preset === key) {
                  setPreset(null);
                  setPayText(beforePreset.current.text);
                  setPay(beforePreset.current.pay);
                  // Only the opening state hides the override field, so only then does the override go.
                  if (beforePreset.current.pay === null) setOverrideText("");
                  return;
                }
                if (preset === null) beforePreset.current = { text: payText, pay };
                setPreset(key);
                setPayText("");
                setPay(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
        {/* Stays mounted so correcting the pay keeps its three fields. */}
        <Past
          snapshot={snapshot}
          unit={unit}
          overridden={overridePrice !== null}
          printed={printed}
          hidden={pay === null || preset !== null}
          form={pastForm}
          onForm={(change) => setPastForm({ ...pastForm, ...change })}
          month={pastMonth}
          comparison={comparison}
          onOpen={setPastOpen}
        />
        {amount !== null && (
          <details>
            <summary>¿En tu carnicería está a otro precio?</summary>
            <div className="panel">
              <Money
                id="override"
                label={`Precio por ${definition.priceUnit}`}
                note={`Precio promedio INDEC: ${formatPesos(priceOf(unit))}. Cambia solo el número grande y los íconos.`}
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
            <p>Dividimos lo que escribís por el precio promedio de cada producto. La cuenta se hace en tu dispositivo.</p>
            <p>Las fuentes son del INDEC: precios promedio e IPC de GBA, canasta básica total y canasta de crianza. Los datos son de {monthWithDe(snapshot.lastMonth)}.</p>
            <p>Vale solo para GBA. Son promedios publicados, no el precio de una carnicería ni de una marca, y salen con demora: el INDEC los publica el mes siguiente.</p>
            <p>¿Y antes? compara con los precios en general (IPC GBA). No es una medida de tu inflación personal.</p>
            <p>En el gráfico, todas las líneas arrancan en x1 en el mes que elegís. El índice de salarios es del INDEC y cubre todo el país; los precios son de GBA. Los salarios llegan más tarde. Cada escalón del eje multiplica, no suma.</p>
          </div>
        </details>
      </section>

      <RaceChart
        snapshot={snapshot}
        unit={unit}
        past={pastShown && { ...pastShown, oldPay: oldPay!, pay: pay! }}
        overridden={overridePrice !== null}
      />

      <footer>
        Fuente: <a href="https://www.indec.gob.ar" target="_blank" rel="noopener noreferrer">INDEC</a>
      </footer>
    </main>
  );
}
