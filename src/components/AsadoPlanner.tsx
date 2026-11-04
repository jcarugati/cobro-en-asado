"use client";

import { type CSSProperties, useEffect, useState } from "react";
import * as Result from "effect/Result";
import { checkPastMonth } from "../domain/calc.ts";
import { formatMultiple, formatCount, formatPesos, monthLabel, monthWithDe } from "../domain/format.ts";
import { parsePay } from "../domain/pay.ts";
import { ASADO_LIST, DEFAULT_PEOPLE, DEFAULT_THEN_MONTH, MAX_PEOPLE, MIN_PEOPLE, perPersonText, planAsado, planCardLines, planShareTarget, type Plan } from "../domain/planner.ts";
import type { Snapshot } from "../domain/snapshot.ts";
import { formatWorkDays, hoursAssumption, workHours } from "../domain/worktime.ts";
import { BigNumber } from "./BigNumber.tsx";
import { rememberPay, typedHours, typedPay } from "./memory.ts";
import { Money } from "./Money.tsx";
import { MonthPicker } from "./MonthPicker.tsx";
import { Share } from "./Share.tsx";
import { UnitIcon } from "./UnitIcon.tsx";

function amountOf(text: string): number | null {
  const parsed = parsePay(text);
  return Result.isSuccess(parsed) ? parsed.success : null;
}

export function AsadoPlanner({ snapshot, shared }: { snapshot: Snapshot; shared?: Plan }) {
  const [people, setPeople] = useState(shared?.people ?? DEFAULT_PEOPLE);
  const startMonth = shared?.thenMonth ?? DEFAULT_THEN_MONTH;
  const [picked, setPicked] = useState({ monthNumber: startMonth.slice(4), year: startMonth.slice(0, 4) });
  const [payText, setPayText] = useState(() => typedPay());
  // Last valid pay: typing 1.200.000 with its dots passes through invalid text, and the line must not blink on it.
  const [pay, setPay] = useState(() => amountOf(typedPay()));

  const thenMonth = picked.monthNumber && picked.year ? picked.year + picked.monthNumber : null;
  const check = thenMonth ? checkPastMonth(snapshot, thenMonth) : null;
  const comparing = check !== null && Result.isSuccess(check);
  // A refused month only drops the past values: today's prices don't depend on it, so any valid month prices them.
  const plan = Result.getOrThrow(planAsado(snapshot, { people, thenMonth: comparing ? check.success : snapshot.firstMonth, month: snapshot.lastMonth }));
  const lines = planCardLines(plan);
  const total = Math.round(plan.totalNow);
  // The past price is half of the surprise, so it gets a line of its own, without the sentence's final dot: with dots for thousands it would read as a mistake.
  const [tailLead, tailPrice] = lines.tail.split(": ");
  // With one person it would repeat the total.
  const perHead = people > 1 ? `${formatPesos(plan.totalNow / people)} por cabeza` : null;

  const hours = typedHours();
  const work = pay !== null ? `Te lleva ${formatWorkDays(workHours(plan.totalNow, pay, hours), hours)} de laburo.` : null;
  const target = comparing ? planShareTarget(plan) : null;

  // The same pause Money waits for: a screen reader hears the line once, and only text left invalid dims it.
  const [settled, setSettled] = useState({ text: payText, work });
  useEffect(() => {
    const timer = setTimeout(() => setSettled({ text: payText, work }), 700);
    return () => clearTimeout(timer);
  }, [payText, work]);
  const stale = settled.text === payText && amountOf(payText) === null && pay !== null;

  return (
    <main className="app">
      <div className="controls">
        <p className="brand"><UnitIcon unit="asado" />Cobro en Asado</p>
        {/* No price: the link's month ages, and the card below always prints today's. */}
        {shared && <p className="shared">{`Te pasaron un asado para\u00a0${shared.people}. Armá el tuyo:`}</p>}
        <h1 id="people-question" className="plan-question">¿Cuántos son?</h1>
        <div className="stepper" role="group" aria-labelledby="people-question">
          {/* aria-disabled, not disabled: a disabled button would drop the keyboard's focus at each end. */}
          <button type="button" className="cta stepper-button" aria-label="Una persona menos" aria-disabled={people === MIN_PEOPLE} onClick={() => setPeople(Math.max(MIN_PEOPLE, people - 1))}>−</button>
          <p className="stepper-count" aria-hidden="true"><span key={people}>{people}</span></p>
          <button type="button" className="cta stepper-button" aria-label="Una persona más" aria-disabled={people === MAX_PEOPLE} onClick={() => setPeople(Math.min(MAX_PEOPLE, people + 1))}>+</button>
        </div>
      </div>

      {/* The stretched slot is what lets the card stay in view through the whole left column. */}
      <div className="result-slot">
        <section className="result">
          {/* The animated number stays out of it, so only the final sentence is announced, with the new count in it. */}
          <p className="sr-only" aria-live="polite">{`${lines.lead} ${lines.amount}.${perHead ? ` ${perHead}.` : ""}`}</p>
          <p className="sr-only" aria-live="polite">{settled.work}</p>
          <article className="card plan-card" style={{ "--chars": formatCount(total).length } as CSSProperties}>
            <div aria-hidden="true" className="card-top">
              <span className="lead">{lines.lead}</span>
              <span className="stamp"><UnitIcon unit="asado" />Cobro en Asado</span>
            </div>
            <p aria-hidden="true" className="headline plan-total">
              <span className="plan-peso">$</span>
              <BigNumber value={total} from={total} />
            </p>
            {perHead && <p aria-hidden="true" className="plan-head">{perHead}</p>}
            {comparing && (
              <div className="plan-then">
                <p className="unit">{tailLead}: <span className="plan-then-price">{tailPrice!.replace(/\.$/, "")}</span></p>
                {/* Remounted per whole number: most taps only move it by rounding, and a stamp should mean something. */}
                <p key={Math.round(plan.multiple)} className="plan-multiple">{lines.detail}</p>
              </div>
            )}
            {work && (
              <div className={stale ? "plan-work plan-stale" : "plan-work"}>
                <p aria-hidden="true">{work}</p>
                <p className="plan-assumption">{hoursAssumption(hours)}</p>
              </div>
            )}
            <div className="tray plan-table" aria-hidden="true" style={{ "--columns": 5, "--rows": 2 } as CSSProperties}>
              {/* Keyed by the last count that landed on this place, so each tap re-drops one sticker, in either direction. */}
              {lines.icons.map((unit, index) => <span key={people - (people - index + 10) % 10} style={{ "--index": index } as CSSProperties}><UnitIcon unit={unit} /></span>)}
            </div>
            <div className="card-foot"><p>{lines.footer}</p></div>
          </article>
          {/* The key discards a kept card image when the result changes. */}
          <Share key={target?.path} target={target} comparing={false} warning={false} />
        </section>
      </div>

      <section className="extras plan-extras">
        <div className="ticket">
          <h2 className="plan-heading">Lista de compras</h2>
          <table>
            <thead>
              <tr>
                <th scope="col">Para {people}</th>
                <th scope="col">Hoy</th>
                {comparing && <th scope="col">{monthLabel(plan.thenMonth)}</th>}
              </tr>
            </thead>
            <tbody>
              {plan.lines.map((line) => (
                <tr key={line.unit}>
                  <th scope="row">
                    <UnitIcon unit={line.unit} />
                    <span>{line.name}<small>{line.amountText}</small></span>
                  </th>
                  <td>{formatPesos(line.now)}</td>
                  {comparing && <td>{formatPesos(line.then)}</td>}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td>{formatPesos(plan.totalNow)}</td>
                {comparing && <td>{formatPesos(plan.totalThen)}</td>}
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="plan-block">
          <h2 className="plan-heading">Comparar con</h2>
          <MonthPicker snapshot={snapshot} monthNumber={picked.monthNumber} year={picked.year} onChange={(change) => setPicked({ ...picked, ...change })} />
          <div className="past" aria-live="polite">
            {check && Result.isFailure(check) && (
              <p>
                {check.failure === "tooEarly"
                  ? `Estos precios arrancan en ${monthWithDe(snapshot.firstMonth)}. Elegí un mes desde ahí en adelante.`
                  : `Elegí un mes anterior a ${monthWithDe(snapshot.lastMonth)}.`}
              </p>
            )}
          </div>
        </div>

        <div className="plan-block">
          <h2 className="plan-heading">Lo que cobrás, si querés</h2>
          <p className={stale ? "plan-stale" : undefined}>{work ?? "Así te decimos cuánto laburo te lleva."}</p>
          <Money
            id="asado-pay"
            label="¿Cuánto te cae en la cuenta por mes?"
            note="Sin aguinaldo. El número no se manda a ningún lado."
            example="1.200.000"
            value={payText}
            onChange={(text) => {
              rememberPay(text);
              setPayText(text);
              const parsed = parsePay(text);
              if (Result.isSuccess(parsed)) setPay(parsed.success);
              else if (parsed.failure === "empty") setPay(null);
            }}
          />
        </div>

        <details>
          <summary>Cómo calculamos</summary>
          <div className="panel">
            <p>A cada persona le toca:</p>
            <ul className="plan-rations">
              {ASADO_LIST.map((item) => <li key={item.unit}>{perPersonText(item)}</li>)}
            </ul>
            <p>Redondeamos para arriba a lo que se puede comprar de verdad, y la bebida a botellas enteras.</p>
            <p>Son precios promedio de GBA, no los de tu carnicería. Los precios y el mes salen del INDEC: estos son de {monthWithDe(snapshot.lastMonth)}.</p>
          </div>
        </details>
      </section>

      <footer>
        Fuente: <a href="https://www.indec.gob.ar" target="_blank" rel="noopener noreferrer">INDEC</a>
      </footer>
    </main>
  );
}
