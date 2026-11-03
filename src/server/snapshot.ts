import { Effect } from "effect";
import { UNITS, type UnitSlug } from "../domain/units.ts";
import type { Snapshot } from "../domain/snapshot.ts";
import { CrianzaRow, IndecError, IndexRow, PriceRow, readRows } from "./indec.ts";

export const getSnapshot = Effect.gen(function*() {
  const prices = yield* readRows("ipc_nacional", {
    select: "codigo,descripcion,tipo_de_indicador_descripcion,periodo,valor", region: "eq.GBA",
    tipo_de_indicador: "eq.Precio promedio", periodo: "gte.201612",
    codigo: `in.(${UNITS.map((unit) => unit.code).join(",")})`, order: "periodo,codigo",
  }, PriceRow);
  const ipc = yield* readRows("ipc_nacional", {
    select: "periodo,valor", region: "eq.GBA", codigo: "eq.0",
    tipo_de_indicador: "eq.Indice", periodo: "gte.201612", order: "periodo",
  }, IndexRow);
  const cbt = yield* readRows("valorizacion_canastas_cba_cbt", {
    select: "periodo,valor", codigo: "eq.CBT H2", tipo_de_indicador: "eq.Hogar 2",
    order: "periodo.desc", limit: "1",
  }, IndexRow);
  const crianza = yield* readRows("canasta-crianza", {
    select: "Periodo,tot_men1", order: "Periodo.desc", limit: "1",
  }, CrianzaRow);
  return yield* Effect.try({
    try: () => buildSnapshot(prices, ipc, cbt, crianza),
    catch: (error) => error instanceof IndecError ? error
      : new IndecError({ tag: "Validation", endpoint: "snapshot", status: 0 }),
  });
});

function buildSnapshot(
  prices: readonly (typeof PriceRow.Type)[], ipc: readonly (typeof IndexRow.Type)[],
  cbt: readonly (typeof IndexRow.Type)[], crianza: readonly (typeof CrianzaRow.Type)[],
): Snapshot {
  function fail(detail: NonNullable<IndecError["detail"]>): never {
    throw new IndecError({ tag: "Validation", endpoint: "snapshot", status: 0, detail });
  }
  const checkMonth = (month: string) => {
    if (!/^(20\d{2})(0[1-9]|1[0-2])$/.test(month)) fail("month");
    return month;
  };
  const positive = (value: number | null) => {
    if (value === null || !Number.isFinite(value) || value <= 0) fail("value");
    return value;
  };
  const byUnit = new Map(UNITS.map((unit) => [unit.code as string, new Map<string, number>()]));
  for (const row of prices) {
    const unit = UNITS.find((unit) => unit.code === row.codigo);
    const months = byUnit.get(row.codigo);
    const month = checkMonth(row.periodo);
    if (!unit || !months || unit.description !== row.descripcion || months.has(month) || month < "201612") fail("price");
    if (row.tipo_de_indicador_descripcion !== unit.indecUnit) fail("unit");
    months.set(month, positive(row.valor));
  }
  const indexes = new Map<string, number>();
  for (const row of ipc) {
    const month = checkMonth(row.periodo);
    if (indexes.has(month) || month < "201612") fail("ipc");
    indexes.set(month, positive(row.valor));
  }
  const priceMonths = new Set(prices.map((row) => row.periodo));
  const lastMonth = [...indexes.keys()].filter((month) => priceMonths.has(month)).sort().at(-1);
  if (!lastMonth || lastMonth < "201612") fail("coverage");
  const months: string[] = [];
  for (let year = 2016, month = 12; ; ) {
    const value = `${year}${String(month).padStart(2, "0")}`;
    if (value > lastMonth) break;
    months.push(value);
    if (++month === 13) { month = 1; year++; }
  }
  const series = (values: Map<string, number>) => months.map((month) => {
    const value = values.get(month);
    if (value === undefined) fail("gap");
    return value;
  });
  if (cbt.length !== 1 || crianza.length !== 1 || !cbt[0] || !crianza[0]) fail("preset");
  // shortcut: stops large regressions, not a one-month step back; raise it if that ever matters.
  if (lastMonth < "202609" || checkMonth(cbt[0].periodo) < "202609" || checkMonth(crianza[0].Periodo) < "202609") fail("floor");
  return {
    firstMonth: "201612", lastMonth,
    prices: Object.fromEntries(UNITS.map((unit) => [unit.slug, series(byUnit.get(unit.code)!)])) as Record<UnitSlug, number[]>,
    ipc: series(indexes),
    presets: {
      cbtHogar2: { month: checkMonth(cbt[0].periodo), value: positive(cbt[0].valor) },
      crianzaMenor1: { month: checkMonth(crianza[0].Periodo), value: positive(crianza[0].tot_men1) },
    },
  };
}
