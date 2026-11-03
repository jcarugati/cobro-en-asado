import { Config, Data, Effect, Redacted, Schedule, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

export class IndecError extends Data.TaggedError("IndecError")<{
  tag: "Transport" | "Status" | "Timeout" | "Decode" | "Pagination" | "Validation" | "Config";
  endpoint: string;
  status: number;
  detail?: "wage" | "month" | "value" | "price" | "ipc" | "coverage" | "gap" | "preset" | "floor" | "unit";
}> {
  override get message() { return `${this.tag} ${this.endpoint} ${this.status}${this.detail ? ` ${this.detail}` : ""}`; }
}

export const PriceRow = Schema.Struct({
  codigo: Schema.String, descripcion: Schema.String, periodo: Schema.String,
  tipo_de_indicador_descripcion: Schema.String,
  valor: Schema.NullOr(Schema.Number),
});
export const IndexRow = Schema.Struct({
  periodo: Schema.String, valor: Schema.NullOr(Schema.Number),
});
export const CrianzaRow = Schema.Struct({ Periodo: Schema.String, tot_men1: Schema.NullOr(Schema.Number) });

export const readRows = <S extends Schema.Constraint & { readonly DecodingServices: never }>(
  endpoint: "indice_salarios" | "ipc_nacional" | "valorizacion_canastas_cba_cbt" | "canasta-crianza",
  query: Record<string, string>, schema: S,
) => Effect.gen(function*() {
  const key = yield* Config.Redacted("INDEC_API_KEY").pipe(
    Effect.mapError(() => new IndecError({ tag: "Config", endpoint, status: 0 })),
  );
  const rows: S["Type"][] = [];
  let total: number | undefined;
  do {
    const offset = rows.length;
    const url = new URL(endpoint, "https://api.indec.gob.ar/v1/");
    url.search = new URLSearchParams({ ...query, limit: query.limit ?? "1000", offset: String(offset) }).toString();
    const page = yield* Effect.gen(function*() {
      const response = yield* HttpClient.execute(HttpClientRequest.get(url, {
        headers: { Authorization: `Bearer ${Redacted.value(key)}`, Prefer: "count=exact" },
      })).pipe(Effect.mapError((error) => new IndecError({
        tag: error.reason._tag === "TransportError" ? "Transport" : "Decode", endpoint, status: 0,
      })));
      if (response.status !== 200 && response.status !== 206) {
        return yield* Effect.fail(new IndecError({ tag: "Status", endpoint, status: response.status }));
      }
      // shortcut: a connection drop while reading the body surfaces as Decode and is not retried; split body read from decode if this occurs in practice.
      const body = yield* HttpClientResponse.schemaBodyJson(Schema.Array(schema))(response).pipe(
        Effect.mapError(() => new IndecError({
          tag: "Decode",
          endpoint, status: response.status,
        })),
      );
      return { body, range: response.headers["content-range"], status: response.status };
    }).pipe(
      Effect.timeout("15 seconds"),
      Effect.mapError((error) => error._tag === "TimeoutError"
        ? new IndecError({ tag: "Timeout", endpoint, status: 0 }) : error),
      Effect.retry({ times: 2, schedule: Schedule.exponential("250 millis"),
        while: (error) => error.tag === "Transport" || (error.tag === "Status" && error.status >= 500 && error.status <= 599),
      }),
    );
    const match = /^(\d+)-(\d+)\/(\d+)$/.exec(page.range ?? "");
    // PostgREST counts the full relation even for the latest-row queries.
    const count = query.limit === "1" ? Math.min(1, Number(match?.[3])) : Number(match?.[3]);
    if (!match || !Number.isSafeInteger(count) || count <= 0 ||
      Number(match[1]) !== offset || Number(match[2]) !== offset + page.body.length - 1 ||
      (total !== undefined && total !== count) || page.body.length === 0 || offset + page.body.length > count) {
      return yield* Effect.fail(new IndecError({ tag: "Pagination", endpoint, status: page.status }));
    }
    total = count;
    rows.push(...page.body);
  } while (rows.length < total);
  return rows;
});
