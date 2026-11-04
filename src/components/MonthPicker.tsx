"use client";

import { MONTH_NAMES } from "../domain/format.ts";
import type { Snapshot } from "../domain/snapshot.ts";

export function MonthPicker({ snapshot, monthNumber, year, onChange }: {
  snapshot: Snapshot;
  monthNumber: string;
  year: string;
  onChange: (change: { monthNumber: string } | { year: string }) => void;
}) {
  // Years before the data start stay on the list, so they get the refusal instead of a silent limit.
  const lastYear = Number(snapshot.lastMonth.slice(0, 4));
  const years = Array.from({ length: lastYear - 2009 }, (_, index) => lastYear - index);

  return (
    <div className="when">
      <div>
        <label htmlFor="past-month">Mes</label>
        <select id="past-month" value={monthNumber} onChange={(event) => onChange({ monthNumber: event.target.value })}>
          <option value="">Elegí</option>
          {MONTH_NAMES.map((name, index) => <option key={name} value={String(index + 1).padStart(2, "0")}>{name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="past-year">Año</label>
        <select id="past-year" value={year} onChange={(event) => onChange({ year: event.target.value })}>
          <option value="">Elegí</option>
          {years.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
    </div>
  );
}
