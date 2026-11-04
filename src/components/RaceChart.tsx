"use client";

import { type CSSProperties, type PointerEvent, useEffect, useRef, useState } from "react";
import * as Option from "effect/Option";
import { type ChartData, chartData, freeSpanStart, monthTicks, multipleTicks, rangeStart, RANGES, spreadLabels } from "../domain/chart.ts";
import { chartSummary, chartVerdict, formatCount, formatMultiple, MONTH_NAMES, monthLabel, unitLabel } from "../domain/format.ts";
import type { Month, Snapshot } from "../domain/snapshot.ts";
import { UNITS, type UnitSlug } from "../domain/units.ts";
import { WAGES, type WageKey } from "../domain/wages.ts";
import { UnitIcon } from "./UnitIcon.tsx";

type RangeKey = (typeof RANGES)[number] | "own";
type Past = { month: Month; oldPay: number; pay: number; unitsThen: number; unitsNow: number };
type Line = { key: string; name: string; value: number | null };

const RANGE_LABELS: Record<(typeof RANGES)[number], string> = { year: "1 año", since2019: "Desde 2019", all: "Todo" };
const PRICES = "Precios en general";
const OWN = "Tu sueldo";

// The visitor types both amounts. Past these limits the axis would crush the real series and its labels would not fit, so the line stops at the limit and its label says so.
const OWN_MIN = 0.01;
const OWN_MAX = 1_000;
const ownOnAxis = (own: number) => Math.min(OWN_MAX, Math.max(OWN_MIN, own));
const ownLabel = (own: number) => own > OWN_MAX ? `>${formatMultiple(OWN_MAX)}` : own < OWN_MIN ? `<${formatMultiple(OWN_MIN)}` : formatMultiple(own);

const tickLabel = (tick: number) => formatMultiple(tick).replace(/,0+$/, "");

const shortName = (month: Month) => MONTH_NAMES[Number(month.slice(4)) - 1]!.slice(0, 3);

function monthTickLabel(month: Month, step: number) {
  if (step >= 12) return month.slice(0, 4);
  return month.endsWith("01") ? `${shortName(month)} ${month.slice(2, 4)}` : shortName(month);
}

function linesAt(data: ChartData, index: number, unitName: string, wageName: string): Line[] {
  const last = data.months.length - 1;
  return [
    { key: "product", name: unitName, value: data.product[index]! },
    { key: "prices", name: PRICES, value: data.ipc[index]! },
    { key: "wages", name: wageName, value: data.wages[index] ?? null },
    // Two known points only: the months between them have no value to show.
    ...data.own !== null && (index === 0 || index === last) ? [{ key: "own", name: OWN, value: index === 0 ? 1 : data.own }] : [],
  ];
}

function Plot({ data, unit, unitName, wageName, past }: {
  data: ChartData;
  unit: UnitSlug;
  unitName: string;
  wageName: string;
  past: Past | null;
}) {
  const [active, setActive] = useState<number | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const plot = useRef<HTMLDivElement>(null);
  const scrub = useRef<HTMLInputElement>(null);
  const { months, product, ipc, wages, own } = data;
  const last = months.length - 1;
  const lastWage = wages.findLastIndex((value) => value !== null);
  const known = wages.filter((value) => value !== null);
  const ownEnd = own === null ? null : ownOnAxis(own);
  const shown = [...product, ...ipc, ...known, ...ownEnd === null ? [] : [ownEnd]];
  const smallest = Math.min(...shown);
  const largest = Math.max(...shown);
  // The scale follows the data so the lines fill the plot, with a span that keeps a flat stretch looking flat.
  const low = smallest / 1.03;
  const high = Math.max(largest * 1.06, smallest * 1.25);
  // A dip just under x1 is no reason to give up the x2 and x5 steps.
  const ticks = multipleTicks(smallest >= 0.9 ? 1 : smallest, largest).filter((tick) => tick >= low && tick <= high);
  const yAt = (value: number) => 100 * (1 - Math.log(value / low) / Math.log(high / low));
  const xAt = (index: number) => 100 * index / Math.max(1, last);
  const points = (values: (number | null)[]) => values.flatMap((value, index) =>
    value === null ? [] : [`${(xAt(index) * 10).toFixed(1)},${(yAt(value) * 10).toFixed(1)}`]).join(" ");

  const { step, indexes } = monthTicks(months);

  const ends = [
    { key: "product", name: unitName, value: product[last]!, text: formatMultiple(product[last]!) },
    { key: "prices", name: PRICES, value: ipc[last]!, text: formatMultiple(ipc[last]!) },
    { key: "wages", name: wageName, value: wages[lastWage]!, text: formatMultiple(wages[lastWage]!) },
    ...own === null ? [] : [{ key: "own", name: OWN, value: ownEnd!, text: ownLabel(own) }],
  ];
  // Wide enough that the sticker in the product's row clears the rows beside it.
  const endRows = spreadLabels(ends.map((end) => yAt(end.value)), 8);

  // The gap between the two line ends is exactly the change in kilos, so the marker sits there. A dotted leader joins it to its label, which stays off the lines: in the gutter's free stretch, or under the plot on a phone.
  const bracketTop = ownEnd === null ? 0 : Math.min(yAt(ownEnd), yAt(product[last]!));
  const bracketBottom = ownEnd === null ? 0 : Math.max(yAt(ownEnd), yAt(product[last]!));
  const kilosTop = freeSpanStart(endRows) + 5;
  const stemTop = Math.min(kilosTop, bracketBottom);

  // A mouse passing over must not take the month away from someone scrubbing by keyboard.
  const scrubbing = () => document.activeElement === scrub.current;
  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const box = plot.current!.getBoundingClientRect();
    setActive(Math.round(Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) * last));
  };

  // A tap leaves the tooltip up, so a tap anywhere else takes it away.
  useEffect(() => {
    if (active === null) return;
    const away = (event: globalThis.PointerEvent) => {
      if (!frame.current?.contains(event.target as Node)) setActive(null);
    };
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [active !== null]);

  const scrubbed = active ?? last;
  const rows = linesAt(data, scrubbed, unitName, wageName).filter((line) => line.value !== null);
  const value = (line: Line) => line.key === "own" && own !== null && scrubbed === last ? ownLabel(own) : formatMultiple(line.value!);
  const reading = `${monthLabel(months[scrubbed]!)}: ${rows.map((line) => `${line.name} ${value(line)}`).join(", ")}`;
  const activeX = active === null ? 0 : xAt(active);

  return (
    <div
      ref={frame}
      className="plot-frame"
      onPointerMove={(event) => { if (!scrubbing()) pick(event); }}
      onClick={pick}
      onPointerCancel={() => setActive(null)}
      onPointerLeave={(event) => { if (event.pointerType === "mouse" && !scrubbing()) setActive(null); }}
    >
      <div ref={plot} className="plot">
        <div aria-hidden="true">
          {ticks.map((tick) => (
            <div key={tick} className={tick === 1 ? "grid grid-start" : "grid"} style={{ top: `${yAt(tick)}%` }}>
              <span>{tickLabel(tick)}</span>
            </div>
          ))}
          {indexes.map((index) => (
            <span key={index} className="month-tick" style={{ left: `${xAt(index)}%` }}>{monthTickLabel(months[index]!, step)}</span>
          ))}
        </div>

        {/* The series only: a stretched viewBox would distort a dash pattern, so the own line draws in its own svg. */}
        <svg className="lines" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
          <polyline className="line-prices" points={points(ipc)} />
          <polyline className="line-wages" points={points(wages)} />
          <polyline className="line-product" points={points(product)} />
        </svg>
        {ownEnd !== null && (
          <svg className="lines chart-own" aria-hidden="true">
            <line className="line-own" x1="0" y1={`${yAt(1)}%`} x2="100%" y2={`${yAt(ownEnd)}%`} />
          </svg>
        )}

        <div aria-hidden="true">
          {/* First, so a close finish leaves the other lines' dots on top. */}
          <i className="end-dot dot-product" style={{ left: "100%", top: `${yAt(product[last]!)}%` }} />
          <i className="end-dot dot-wages" style={{ left: `${xAt(lastWage)}%`, top: `${yAt(wages[lastWage]!)}%` }} />
          <i className="end-dot dot-prices" style={{ left: "100%", top: `${yAt(ipc[last]!)}%` }} />
          {ownEnd !== null && (
            <span className="chart-own">
              <i className="end-dot dot-own" style={{ left: 0, top: `${yAt(1)}%` }} />
              <i className="end-dot dot-own" style={{ left: "100%", top: `${yAt(ownEnd)}%` }} />
              <i className="bracket" style={{ top: `${bracketTop}%`, height: `${bracketBottom - bracketTop}%` }} />
              <i
                className="kilos-stem"
                style={{ "--stem-top": `${stemTop}%`, "--stem-height": `${Math.max(kilosTop, bracketTop) - stemTop}%`, "--bracket-bottom": `${bracketBottom}%` } as CSSProperties}
              />
            </span>
          )}
          {ends.map((end, index) => (
            <span key={end.key} className={`end-label end-${end.key}`} style={{ top: `${endRows[index]}%` }}>
              {/* The racer finishes beside its line, so the end of every line stays in view. */}
              {end.key === "product" ? <UnitIcon unit={unit} /> : <i className={`swatch swatch-${end.key}`} />}
              <span className="end-name">{end.name}</span>
              <b>{end.text}</b>
            </span>
          ))}
        </div>

        {active !== null && (
          <div aria-hidden="true">
            <i className="crosshair" style={{ left: `${activeX}%` }} />
            {rows.map((line) => (
              <i
                key={line.key}
                className={`end-dot dot-${line.key}`}
                style={{ left: `${activeX}%`, top: `${yAt(line.key === "own" ? ownOnAxis(line.value!) : line.value!)}%` }}
              />
            ))}
            {/* Rising lines leave the top left and the bottom right free, so the tooltip goes there. A finish in the lower part of the plot takes the bottom right away on a phone. */}
            <div className={`tip ${activeX < 50 ? "tip-top" : "tip-bottom"}${Math.max(...endRows) > 60 ? " tip-flip" : ""}`} style={{ "--x": `${activeX}%` } as CSSProperties}>
              <strong>{monthLabel(months[active]!)}</strong>
              {rows.map((line) => (
                <span key={line.key}>
                  <i className={`swatch swatch-${line.key}`} />
                  <span>{line.name}</span>
                  <b>{value(line)}</b>
                </span>
              ))}
            </div>
          </div>
        )}

        <input
          ref={scrub}
          className="sr-only plot-scrub"
          type="range"
          min={0}
          max={last}
          value={scrubbed}
          aria-label="Mes del gráfico"
          aria-valuetext={reading}
          onFocus={() => setActive(scrubbed)}
          onBlur={() => setActive(null)}
          onChange={(event) => setActive(Number(event.currentTarget.value))}
        />
      </div>
      {past !== null && ownEnd !== null && (
        <p className="kilos chart-own" style={{ "--kilos-at": kilosTop / 100 } as CSSProperties}>
          <span>{`De ${formatCount(past.unitsThen)} a ${formatCount(past.unitsNow)}`}</span>{" "}
          <span>{unitLabel(unit, past.unitsNow)}</span>
        </p>
      )}
    </div>
  );
}

function ChipRow<K extends string>({ id, label, options, value, onPick }: {
  id: string;
  label: string;
  options: { key: K; label: string }[];
  value: K;
  onPick: (key: K) => void;
}) {
  return (
    <div className="chart-chips">
      <p id={id} className="caption">{label}</p>
      <div className="chips" role="group" aria-labelledby={id}>
        {options.map((option) => (
          <button key={option.key} type="button" className="chip" aria-pressed={value === option.key} onClick={() => onPick(option.key)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RaceChart({ snapshot, unit, past, overridden }: {
  snapshot: Snapshot;
  unit: UnitSlug;
  past: Past | null;
  overridden: boolean;
}) {
  const [wage, setWage] = useState<WageKey>("general");
  const [range, setRange] = useState<RangeKey>("all");
  const [tableOpened, setTableOpened] = useState(false);

  // ¿Y antes? allows the wage index's last month, which has nothing to chart.
  const ownMonth = past && Option.isSome(chartData(snapshot, { unit, wage, start: past.month })) ? past.month : null;
  // Starts empty: the chart loads late, so it can mount with a month already chosen.
  const [seenMonth, setSeenMonth] = useState<typeof ownMonth>(null);
  if (ownMonth !== seenMonth) {
    setSeenMonth(ownMonth);
    if (ownMonth !== null) setRange("own");
    else if (range === "own") setRange("all");
  }

  const ownRange = range === "own" && ownMonth !== null;
  const start = ownRange ? ownMonth : rangeStart(snapshot, range === "own" ? "all" : range);
  const chart = chartData(snapshot, { unit, wage, start, ...ownRange && past ? { own: past } : {} });
  // Only a wage index that lags a whole year could refuse a fixed range.
  if (Option.isNone(chart)) return null;
  const data = chart.value;

  const unitName = UNITS.find((item) => item.slug === unit)!.tile;
  const wageName = WAGES.find((item) => item.key === wage)!.label;
  const { question, answer } = chartVerdict(data, unit, wage);
  const last = data.months.length - 1;
  // A tie the printed numbers don't show comes from the wage lag, so it needs saying.
  const unsettled = answer === "Empate" && formatMultiple(data.wages.findLast((value) => value !== null)!) !== formatMultiple(data.product[last]!);
  const ranges: { key: RangeKey; label: string }[] = [
    ...ownMonth === null ? [] : [{ key: "own" as const, label: `Desde ${monthLabel(ownMonth)}` }],
    // The visitor's chip already covers a fixed range that starts in the same month.
    ...RANGES.filter((key) => rangeStart(snapshot, key) !== ownMonth).map((key) => ({ key, label: RANGE_LABELS[key] })),
  ];

  return (
    <figure className="chart">
      {/* The verdict can flip on any chip, so the whole heading is read as one. */}
      <figcaption className="chart-head" aria-live="polite" aria-atomic="true">
        {/* A screenshot of the chart travels without the page, so it carries the name, as the result card does. */}
        <p className="chart-stamp" aria-hidden="true"><UnitIcon unit="asado" />Cobro en Asado</p>
        <h2>
          <span className="chart-question">{question}</span>{" "}
          <span className="chart-answer" style={{ "--chars": answer.length + 1 } as CSSProperties}>{`${answer}.`}</span>
        </h2>
        <div className="chart-reason">
          {unsettled && <p className="chart-unsettled">Los salarios llegan más tarde: todavía no se sabe quién ganó.</p>}
          <p>{chartSummary(snapshot, data, unit, wage)}</p>
        </div>
      </figcaption>

      <div className="chart-main">
        <p className="note">Todos arrancan en x1. El que termina más arriba es el que más subió.</p>
        {/* Names fit beside the line ends only on a wide screen; on a phone this key says them. */}
        <ul className="chart-key" aria-hidden="true">
          <li><i className="swatch swatch-product" />{unitName}</li>
          <li><i className="swatch swatch-prices" />{PRICES}</li>
          <li><i className="swatch swatch-wages" />{wageName}</li>
          {data.own !== null && <li className="chart-own"><i className="swatch swatch-own" />{OWN}</li>}
        </ul>
        {/* A new key redraws the lines and clears the tooltip. */}
        <Plot key={`${unit} ${wage} ${start}`} data={data} unit={unit} unitName={unitName} wageName={wageName} past={ownRange ? past : null} />
        <div className="chart-notes">
          {data.own !== null && <p className="note">Tu línea une dos puntos: lo que cobrabas y lo que cobrás.</p>}
          {overridden && <p className="note">Este gráfico usa precios INDEC, no el de tu carnicería.</p>}
          <p className="note">{`Precios de GBA hasta ${monthLabel(snapshot.lastMonth)}, salarios de todo el país hasta ${monthLabel(snapshot.wages.lastMonth)}. Fuente: INDEC.`}</p>
        </div>
      </div>

      <div className="chart-controls">
        <ChipRow id="chart-range" label="Desde cuándo" options={ranges} value={range} onPick={setRange} />
        <ChipRow id="chart-wage" label="Qué salarios" options={WAGES.map(({ key, label }) => ({ key, label }))} value={wage} onPick={setWage} />
      </div>

      <details className="chart-table" onToggle={(event) => { if (event.currentTarget.open) setTableOpened(true); }}>
        <summary>Ver los números</summary>
        {/* Up to 118 rows that few visitors open, so they wait for the first open. */}
        {tableOpened && (
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Los números del gráfico">
            <table>
              <thead>
                <tr>
                  <th scope="col">Mes</th>
                  <th scope="col">{unitName}</th>
                  <th scope="col">{PRICES}</th>
                  <th scope="col">{wageName}</th>
                  {data.own !== null && <th scope="col">{OWN}</th>}
                </tr>
              </thead>
              <tbody>
                {data.months.map((month, index) => (
                  <tr key={month}>
                    <th scope="row">{`${shortName(month)} ${month.slice(0, 4)}`}</th>
                    <td>{formatMultiple(data.product[index]!)}</td>
                    <td>{formatMultiple(data.ipc[index]!)}</td>
                    <td>{data.wages[index] == null ? "—" : formatMultiple(data.wages[index]!)}</td>
                    {data.own !== null && <td>{index === 0 ? formatMultiple(1) : index === last ? ownLabel(data.own) : "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </figure>
  );
}
