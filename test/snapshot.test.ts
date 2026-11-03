import { readFile } from "node:fs/promises";
import { ConfigProvider, Effect, Result } from "effect";
import { FetchHttpClient } from "effect/http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WAGES } from "../src/domain/wages.ts";
import { UNITS } from "../src/domain/units.ts";
import type { Snapshot } from "../src/domain/snapshot.ts";
import { PriceRow, readRows } from "../src/server/indec.ts";
import { getSnapshot } from "../src/server/snapshot.ts";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

const fixture: Snapshot = JSON.parse(await readFile(new URL("./fixtures/snapshot-202609.json", import.meta.url), "utf8"));
const months = Array.from({ length: fixture.ipc.length }, (_, i) => {
  const date = new Date(Date.UTC(2016, 11 + i));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
});
const priceRows = () => months.flatMap((periodo, i) => UNITS.map((unit) => ({
  codigo: unit.code as string, descripcion: unit.description as string, periodo,
  valor: fixture.prices[unit.slug][i] as number | null,
  tipo_de_indicador_descripcion: unit.indecUnit as string,
})));
const indexRows = () => months.map((periodo, i) => ({ periodo, valor: fixture.ipc[i] }));
const wageRows = () => months.slice(0, fixture.wages.series.general.length).flatMap((periodo, i) => WAGES.map((wage) => ({
  codigo: wage.code as string, descripcion: wage.description as string, periodo,
  valor: fixture.wages.series[wage.key][i] as number | null,
  tipo_de_indicador_descripcion: "Nivel del período, base octubre 2016=100",
})));
type Price = ReturnType<typeof priceRows>[number];
const fakeKey = "fake-secret-do-not-leak";
const run = <A, E>(effect: Effect.Effect<A, E, import("effect/http/HttpClient").HttpClient>, fetch: typeof globalThis.fetch) => Effect.runPromise(Effect.result(effect.pipe(
  Effect.provide(FetchHttpClient.layer), Effect.provideService(FetchHttpClient.Fetch, fetch),
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ INDEC_API_KEY: fakeKey })),
)));
function mockFetch(prices: unknown[] = priceRows(), ipc: unknown[] = indexRows(), wages: unknown[] = wageRows()) {
  return vi.fn<typeof globalThis.fetch>(async (input) => {
    const url = new URL(String(input));
    const endpoint = url.pathname.split("/").at(-1);
    const rows = endpoint === "indice_salarios" ? wages : endpoint === "canasta-crianza"
      ? [{ Periodo: fixture.presets.crianzaMenor1.month, tot_men1: fixture.presets.crianzaMenor1.value }]
      : endpoint === "valorizacion_canastas_cba_cbt"
      ? [{ periodo: fixture.presets.cbtHogar2.month, valor: fixture.presets.cbtHogar2.value }]
      : url.searchParams.get("codigo") === "eq.0" ? ipc : prices;
    const offset = Number(url.searchParams.get("offset"));
    const limit = Number(url.searchParams.get("limit"));
    const body = rows.slice(offset, offset + limit);
    return new Response(JSON.stringify(body), { status: 206, headers: {
      "Content-Range": `${offset}-${offset + body.length - 1}/${rows.length}`,
    } });
  });
}

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("INDEC ingestion", () => {
  it("assembles 2,596 rows in three pages", async () => {
    const fetch = mockFetch();
    const result = await run(readRows("ipc_nacional", {}, PriceRow), fetch);
    expect(Result.isSuccess(result) && result.success).toEqual(priceRows());
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls.map(([url]) => new URL(String(url)).searchParams.get("offset"))).toEqual(["0", "1000", "2000"]);
  });
  it("rejects a count that disagrees with received rows", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify(priceRows().slice(0, 2)), {
      headers: { "Content-Range": "0-1/1" },
    }));
    expect(await run(readRows("ipc_nacional", {}, PriceRow), fetch)).toMatchObject({
      _tag: "Failure", failure: { message: "Pagination ipc_nacional 200" },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects changed totals and premature empty pages", async () => {
    const base = mockFetch();
    const fetch = vi.fn<typeof globalThis.fetch>(async (...args) => {
      const response = await base(...args);
      if (base.mock.calls.length === 2) response.headers.set("Content-Range", "1000-1999/2597");
      return response;
    });
    expect(await run(readRows("ipc_nacional", {}, PriceRow), fetch)).toMatchObject({
      _tag: "Failure", failure: { message: "Pagination ipc_nacional 206" },
    });
    const empty = vi.fn<typeof globalThis.fetch>(async () => new Response("[]", { headers: { "Content-Range": "*/2596" } }));
    expect(await run(readRows("ipc_nacional", {}, PriceRow), empty)).toMatchObject({
      _tag: "Failure", failure: { message: "Pagination ipc_nacional 200" },
    });
  });
  it("rejects a repeated Content-Range position on page two", async () => {
    const base = mockFetch();
    const fetch = vi.fn<typeof globalThis.fetch>(async (...args) => {
      const response = await base(...args);
      if (base.mock.calls.length === 2) response.headers.set("Content-Range", "0-999/2596");
      return response;
    });
    expect(await run(readRows("ipc_nacional", {}, PriceRow), fetch)).toMatchObject({
      _tag: "Failure", failure: { message: "Pagination ipc_nacional 206" },
    });
  });
  it("rejects malformed rows without retrying", async () => {
    const fetch = mockFetch([{ codigo: 12 }]);
    expect(await run(getSnapshot, fetch)).toMatchObject({
      _tag: "Failure", failure: { message: "Decode ipc_nacional 206" },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([401, 429])("does not retry HTTP %s", async (status) => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(null, { status }));
    expect(await run(getSnapshot, fetch)).toMatchObject({
      _tag: "Failure", failure: { message: `Status ipc_nacional ${status}` },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each(["transport", "5xx"])("retries %s at most twice with backoff", async (mode) => {
    vi.useFakeTimers();
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      if (mode === "transport") throw new Error(fakeKey);
      return new Response(null, { status: 503 });
    });
    const pending = run(getSnapshot, fetch);
    await vi.advanceTimersByTimeAsync(249);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(499);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({
      _tag: "Failure", failure: { message: mode === "transport" ? "Transport ipc_nacional 0" : "Status ipc_nacional 503" },
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("times out a stalled response body without retrying", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(new ReadableStream(), {
      headers: { "Content-Range": "0-0/1" },
    }));
    const pending = run(getSnapshot, fetch);
    await vi.advanceTimersByTimeAsync(15001);
    const result = await pending;
    expect(Result.isFailure(result) && result.failure.message).toBe("Timeout ipc_nacional 0");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("snapshot validation", () => {
  const invalid: [string, string, (rows: Price[]) => void][] = [
    ["missing code", "gap", (rows) => { rows.splice(0, rows.length, ...rows.filter((row) => row.codigo !== UNITS[0].code)); }],
    ["wrong description", "price", (rows) => { rows[0]!.descripcion = "Wrong"; }],
    ["wrong pack size", "unit", (rows) => { rows[0]!.tipo_de_indicador_descripcion = "Valor por 1 kg"; }],
    ["duplicate row", "price", (rows) => { rows.push({ ...rows[0]! }); }],
    ["month gap", "gap", (rows) => { rows.splice(22, 22); }],
    ["bad month", "month", (rows) => { rows[0]!.periodo = "2026-09"; }],
    ["null value", "value", (rows) => { rows[0]!.valor = null; }],
    ["non-positive value", "value", (rows) => { rows[0]!.valor = 0; }],
  ];
  it.each(invalid)("rejects %s", async (_, detail, mutate) => {
    const rows = priceRows(); mutate(rows);
    expect(await run(getSnapshot, mockFetch(rows))).toMatchObject({
      _tag: "Failure", failure: { detail, message: `Validation snapshot 0 ${detail}` },
    });
  });
  it("rejects a missing IPC month, duplicate IPC rows and a non-positive IPC value", async () => {
    const ipc = indexRows(); ipc.splice(1, 1);
    expect(await run(getSnapshot, mockFetch(priceRows(), ipc))).toMatchObject({
      _tag: "Failure", failure: { message: "Validation snapshot 0 gap" },
    });
    const duplicates = indexRows();
    duplicates.push(duplicates[0]!);
    expect(await run(getSnapshot, mockFetch(priceRows(), duplicates))).toMatchObject({
      _tag: "Failure", failure: { message: "Validation snapshot 0 ipc" },
    });
    const nonPositive = indexRows();
    nonPositive[0]!.valor = 0;
    expect(await run(getSnapshot, mockFetch(priceRows(), nonPositive))).toMatchObject({
      _tag: "Failure", failure: { message: "Validation snapshot 0 value" },
    });
  });
  it("rejects series or either preset below the September 2026 floor", async () => {
    for (const target of ["series", "valorizacion_canastas_cba_cbt", "canasta-crianza"]) {
      const base = target === "series"
        ? mockFetch(priceRows().filter((row) => row.periodo <= "201812"), indexRows().filter((row) => row.periodo <= "201812"))
        : mockFetch();
      const fetch = vi.fn<typeof globalThis.fetch>(async (...args) => {
        const response = await base(...args);
        if (!String(args[0]).includes(target)) return response;
        const rows = await response.json();
        if (target === "canasta-crianza") rows[0].Periodo = "201812";
        else rows[0].periodo = "201812";
        return new Response(JSON.stringify(rows), { status: response.status, headers: response.headers });
      });
      expect(await run(getSnapshot, fetch)).toMatchObject({
        _tag: "Failure", failure: { detail: "floor", message: "Validation snapshot 0 floor" },
      });
    }
  });
  it("drops October prices when IPC ends in September", async () => {
    const prices = priceRows();
    prices.push(...prices.slice(-22).map((row) => ({ ...row, periodo: "202610" })));
    const result = await run(getSnapshot, mockFetch(prices));
    expect(Result.isSuccess(result) && result.success).toEqual(fixture);
  });
  it("preserves preset months independently", async () => {
    const base = mockFetch();
    const fetch = vi.fn<typeof globalThis.fetch>(async (...args) => {
      if (String(args[0]).includes("canasta-crianza")) return new Response(JSON.stringify([{ Periodo: "202610", tot_men1: 570832 }]), { headers: { "Content-Range": "0-0/20" } });
      return base(...args);
    });
    const result = await run(getSnapshot, fetch);
    expect(Result.isSuccess(result) && result.success.presets.crianzaMenor1.month).toBe("202610");
  });
  it("rejects null preset values", async () => {
    const base = mockFetch();
    const fetch = vi.fn<typeof globalThis.fetch>(async (...args) => String(args[0]).includes("canasta-crianza")
      ? new Response(JSON.stringify([{ Periodo: "202609", tot_men1: null }]), { headers: { "Content-Range": "0-0/1" } }) : base(...args));
    expect(await run(getSnapshot, fetch)).toMatchObject({
      _tag: "Failure", failure: { message: "Validation snapshot 0 value" },
    });
  });
  it("keeps the key out of the plain Next boundary Error and stack", async () => {
    vi.stubEnv("INDEC_API_KEY", fakeKey);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error(fakeKey); }));
    const { loadSnapshot } = await import("../src/server/loadSnapshot.ts");
    const error = await loadSnapshot().catch((error: Error) => error);
    expect(error).toBeInstanceOf(Error);
    if (!(error instanceof Error)) throw new Error("Expected failure");
    expect(Object.getPrototypeOf(error)).toBe(Error.prototype);
    expect(String(error.message)).toMatch(/^Transport ipc_nacional 0$/);
    expect(error.message + error.stack).not.toContain(fakeKey);
    expect(error.cause).toBeUndefined();
  });
});

it("matches the committed fixture acceptance values and size", async () => {
  const result = await run(getSnapshot, mockFetch());
  expect(Result.isSuccess(result) && result.success).toEqual(fixture);
  expect(fixture.prices.asado.at(-1)).toBe(16836.34);
  expect(fixture.ipc[25]).toBe(189.1236);
  expect(fixture.ipc.at(-1)).toBe(12523.1733);
  expect(fixture.presets.cbtHogar2.value).toBe(1632504.69);
  expect(fixture.presets.crianzaMenor1.value).toBe(570832);
  expect(fixture.firstMonth).toBe("201612");
  expect(fixture.lastMonth).toBe("202609");
  expect(JSON.stringify(fixture).length).toBeLessThan(35000);
});

describe("wage validation", () => {
  const invalid: [string, string, (rows: ReturnType<typeof wageRows>) => void][] = [
    ["unknown code", "wage", (rows) => { rows[0]!.codigo = "999"; }],
    ["wrong description", "wage", (rows) => { rows[0]!.descripcion = "Wrong"; }],
    ["wrong indicator", "wage", (rows) => { rows[0]!.tipo_de_indicador_descripcion = "Wrong"; }],
    ["duplicate", "wage", (rows) => { rows.push({ ...rows[0]! }); }],
    ["early month", "wage", (rows) => { rows[0]!.periodo = "201611"; }],
    ["bad month", "month", (rows) => { rows[0]!.periodo = "202613"; }],
    ["null", "value", (rows) => { rows[0]!.valor = null; }],
    ["zero", "value", (rows) => { rows[0]!.valor = 0; }],
    ["negative", "value", (rows) => { rows[0]!.valor = -1; }],
    ["hole", "gap", (rows) => { rows.splice(4, 1); }],
    ["floor", "floor", (rows) => { rows.splice(rows.length - 4, 4); }],
    ["missing series", "floor", (rows) => { rows.splice(0, rows.length, ...rows.filter((row) => row.codigo !== "0")); }],
  ];
  it.each(invalid)("rejects %s", async (_, detail, mutate) => {
    const rows = wageRows(); mutate(rows);
    expect(await run(getSnapshot, mockFetch(priceRows(), indexRows(), rows))).toMatchObject({
      _tag: "Failure", failure: { detail },
    });
  });
  it("accepts the one-month lag and requests the four national index series", async () => {
    const fetch = mockFetch();
    const result = await run(getSnapshot, fetch);
    expect(Result.isSuccess(result) && result.success).toEqual(fixture);
    const url = new URL(String(fetch.mock.calls.find(([url]) => String(url).includes("indice_salarios"))![0]));
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      select: "codigo,descripcion,tipo_de_indicador_descripcion,periodo,valor",
      codigo: "in.(0,110,120,200)", tipo_de_indicador: "eq.Indice", periodo: "gte.201612", order: "periodo,codigo",
    });
    expect(url.searchParams.has("region")).toBe(false);
    expect(fixture.wages.lastMonth).toBe("202608");
  });
  it("clips to the earliest ending series and drops rows past the price/IPC end", async () => {
    const rows = wageRows();
    rows.push(...rows.slice(-4).map((row) => ({ ...row, periodo: "202609" })).filter((row) => row.codigo !== "200"));
    rows.push(...rows.slice(0, 4).map((row) => ({ ...row, periodo: "202610" })).filter((row) => row.codigo !== "200"));
    const result = await run(getSnapshot, mockFetch(priceRows(), indexRows(), rows));
    expect(Result.isSuccess(result) && result.success).toEqual(fixture);
  });
  it("drops future wage rows even when all four series have them", async () => {
    const rows = wageRows();
    for (const periodo of ["202609", "202610"]) rows.push(...rows.slice(-4).map((row) => ({ ...row, periodo })));
    const result = await run(getSnapshot, mockFetch(priceRows(), indexRows(), rows));
    expect(Result.isSuccess(result) && result.success.wages.lastMonth).toBe("202609");
    expect(Result.isSuccess(result) && result.success.wages.series.general).toHaveLength(fixture.ipc.length);
  });
});
