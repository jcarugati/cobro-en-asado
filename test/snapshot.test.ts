import { readFile } from "node:fs/promises";
import { ConfigProvider, Effect, Result } from "effect";
import { FetchHttpClient } from "effect/http";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  valor: fixture.prices[unit.slug][i] as number | null, valor_null: null as string | null,
})));
const indexRows = () => months.map((periodo, i) => ({ periodo, valor: fixture.ipc[i], valor_null: null }));
type Price = ReturnType<typeof priceRows>[number];
const fakeKey = "fake-secret-do-not-leak";
const run = <A, E>(effect: Effect.Effect<A, E, import("effect/http/HttpClient").HttpClient>, fetch: typeof globalThis.fetch) => Effect.runPromise(Effect.result(effect.pipe(
  Effect.provide(FetchHttpClient.layer), Effect.provideService(FetchHttpClient.Fetch, fetch),
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ INDEC_API_KEY: fakeKey })),
)));
function mockFetch(prices: unknown[] = priceRows(), ipc: unknown[] = indexRows()) {
  return vi.fn<typeof globalThis.fetch>(async (input) => {
    const url = new URL(String(input));
    const endpoint = url.pathname.split("/").at(-1);
    const rows = endpoint === "canasta-crianza"
      ? [{ Periodo: fixture.presets.crianzaMenor1.month, tot_men1: fixture.presets.crianzaMenor1.value }]
      : endpoint === "valorizacion_canastas_cba_cbt"
      ? [{ periodo: fixture.presets.cbtHogar2.month, valor: fixture.presets.cbtHogar2.value, valor_null: null }]
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
    expect(Result.isFailure(await run(readRows("ipc_nacional", {}, PriceRow), fetch))).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects changed totals and premature empty pages", async () => {
    const base = mockFetch();
    const fetch = vi.fn<typeof globalThis.fetch>(async (...args) => {
      const response = await base(...args);
      if (base.mock.calls.length === 2) response.headers.set("Content-Range", "1000-1999/2597");
      return response;
    });
    expect(Result.isFailure(await run(readRows("ipc_nacional", {}, PriceRow), fetch))).toBe(true);
    const empty = vi.fn<typeof globalThis.fetch>(async () => new Response("[]", { headers: { "Content-Range": "*/2596" } }));
    expect(Result.isFailure(await run(readRows("ipc_nacional", {}, PriceRow), empty))).toBe(true);
  });
  it("rejects malformed rows without retrying", async () => {
    const fetch = mockFetch([{ codigo: 12 }]);
    expect(Result.isFailure(await run(getSnapshot, fetch))).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([401, 429])("does not retry HTTP %s", async (status) => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(null, { status }));
    expect(Result.isFailure(await run(getSnapshot, fetch))).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each(["transport", "5xx"])("retries %s at most twice with backoff", async (mode) => {
    vi.useFakeTimers();
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      if (mode === "transport") throw new Error(fakeKey);
      return new Response(null, { status: 503 });
    });
    const pending = run(getSnapshot, fetch);
    await vi.advanceTimersByTimeAsync(2000);
    expect(Result.isFailure(await pending)).toBe(true);
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
  const invalid: [string, (rows: Price[]) => void][] = [
    ["missing code", (rows) => { rows.splice(0, rows.length, ...rows.filter((row) => row.codigo !== UNITS[0].code)); }],
    ["wrong description", (rows) => { rows[0]!.descripcion = "Wrong"; }],
    ["duplicate row", (rows) => { rows.push({ ...rows[0]! }); }],
    ["month gap", (rows) => { rows.splice(22, 22); }],
    ["null value", (rows) => { rows[0]!.valor = null; rows[0]!.valor_null = "///"; }],
    ["non-positive value", (rows) => { rows[0]!.valor = 0; }],
  ];
  it.each(invalid)("rejects %s", async (_, mutate) => {
    const rows = priceRows(); mutate(rows);
    expect(Result.isFailure(await run(getSnapshot, mockFetch(rows)))).toBe(true);
  });
  it("rejects a missing IPC month and duplicate IPC rows", async () => {
    const ipc = indexRows(); ipc.splice(1, 1);
    expect(Result.isFailure(await run(getSnapshot, mockFetch(priceRows(), ipc)))).toBe(true);
    ipc.push(ipc[0]!);
    expect(Result.isFailure(await run(getSnapshot, mockFetch(priceRows(), ipc)))).toBe(true);
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
    expect(Result.isFailure(await run(getSnapshot, fetch))).toBe(true);
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
  expect(JSON.stringify(fixture).length).toBeLessThan(30000);
});
