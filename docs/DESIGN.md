NAME: Cobro en Asado
SLUG: cobro-en-asado
TAGLINE: Tu sueldo, en la unidad que entendemos todos: kilos de asado.

# Decision: Cobro en Asado

Stage 1 output. Data probed live on 2026-11-03. Latest published prices: September 2026.

## Concept

Type your monthly take-home pay and see it in kilos of asado, in the browser, as you type.

```
¿Cuánto te cae en la cuenta por mes?   [ 1.200.000 ]

        Cobrás 71 kilos de asado.
        ||||| ||||| ||||| ||||| ||||| ||||| ...
        O 452 paquetes de yerba.
        Equivale al 73,5 % de la canasta básica total de un hogar de 4 en GBA.
        Promedio GBA · septiembre 2026 · INDEC

   [ asado ] [ yerba ] [ cerveza ] [ café ] [ pañales ] ...
   ¿Y antes?  [ mes ] [ lo que cobrabas ]
   [ Compartir ]
```

The trick: nobody posts their salary in pesos, but plenty of people will post it in asado.

The second act compares the visitor's own past pay, with no wage index and no invented history:

> En enero de 2019 eran 161 kilos. Hoy, 71.
> Para empatar con los precios en general, hoy deberías cobrar $1.986.506. Estás un 39,6 % abajo.
> Lo que peor aguantó: carne picada. Lo que mejor aguantó: fideos.

(For a hypothetical $30.000 then and $1.200.000 now.)

## Why it won

Two ideators proposed 9 ideas, which merge into 7 concepts. Two critics scored them independently, each out of 25, on fun in <30 s, data support, cost, buildability and shareability.

| Concept | Critic A (data, build) | Critic B (delight) | Sum /50 | Verdict |
|---|---:|---:|---:|---|
| **Sueldo en asados** | 20 | 24 | **44** | Chosen, with its salary-history slider removed |
| Trueque (price one product in another) | 23 | 20 | 43 | Honest but impersonal. Critic B: "Trueque goes nowhere" |
| Mi inflación (tap products, get "your" rate) | 20 | 22 | 42 | The headline number is not well defined |
| ¿Me aumentaron? (two salaries, two months) | 21 | 18 | 39 | Kept as the optional second act, not the entry |
| Qué pasaba cuando (a month's prices as a receipt) | 21 | 18 | 39 | Receipt styling kept. The 2016 floor refuses the most emotional dates |
| Changuito federal (one basket, six regions) | 21 | 16 | 37 | Only 14 products, and Patagonia nearly always loses |
| Club de tu edad (people your age) | 18 | 19 | 37 | Nobody forwards a population count |

How the judge resolved the disagreement:

- **Critic A preferred Trueque.** Most of its objection to Sueldo en asados was the slider that moved a salary through the wage index, which invents an earnings history. Critic B cut that slider too, so it's gone. The scores above were not re-run after the cut.
- **Mi inflación lost on evidence.** Critic A measured one five-product basket at 61.92 % under equal spending and 27.31 % under one unit of each, against an official 33.54 %. Both calculations are legitimate, and tapping tiles can't say which one applies. The basket also leaves out rent and services.
- **The brief favours a personal input with a surprising answer.** Salary is the most personal input available. It also has the lowest friction, at a single field.

Taken from the other ideas: the receipt styling, the salary comparison, and Trueque's idea of pricing one thing in another (the unit tiles).

## MVP

Everything here is required for launch.

1. **Pay input.** One field: `¿Cuánto te cae en la cuenta por mes?`, with the subline `Sin aguinaldo. El número no sale de tu teléfono.` Accepts `1.200.000` and `1200000`. The result updates live, with no submit button.
2. **Result.** Headline count in the selected unit, one alternate unit, the canasta line, and tally marks (one per unit, grouped by 5, capped at 100 then `+N`). Counts use `Math.round`.
3. **Two presets, for people who won't type a salary:**
   - `Una familia tipo`: canasta básica total, Hogar 2 = 97 kilos.
   - `Criar un bebé`: canasta de crianza for under 1 year = 34 kilos, labelled `incluye el valor del tiempo de cuidado`.
4. **22 unit tiles.** Tapping one changes the headline: `Cobrás 869 lavandinas`. See the table below.
5. **`¿Y antes?` (optional).** Month plus the pay received that month. Shows then vs now in the selected unit, the break-even pay, the real change, and the best and worst products.
   - The month has no default and there are no suggested dates.
   - Earliest month is 2016-12, so prices and IPC both exist. Earlier dates get a friendly refusal, not an error.
   - Best and worst exclude papa, cebolla and tomate, because seasonal spikes dominate them.
6. **Price override.** `¿En tu carnicería está a otro precio?` for the selected unit. Changes the headline only, and the card then says `a precio de mi carnicería`. The `¿Y antes?` comparison always uses INDEC prices on both months, so it never mixes sources.
7. **Share.** Web Share API with a PNG and a link; fallback is copy link plus download. Sharing is opt-in, next to the line `Con una calculadora se puede estimar tu sueldo a partir de esto.`
   - Card: `Cobro 71 kilos de asado por mes.` / `(o 452 paquetes de yerba)` / `Promedio GBA · septiembre 2026 · INDEC`.
   - Second-act card: `En 2019 cobraba 161 kilos de asado. Hoy, 71.`
   - The link opens the app with `Alguien cobra 71 kilos de asado. ¿Y vos?` above the input, and has a per-result link preview.
8. **`Cómo se calcula`.** A short disclosure covering sources, months, GBA, published average prices, the lag, and that this is not a personal inflation measure.
9. **Quality.** Responsive from 360 px, keyboard-usable tiles, a labelled input, `aria-live` on the result, and `prefers-reduced-motion` respected.
10. **Tests.** Input parser, calculations, refusals and snapshot validation, using the acceptance values below.

### Calculations

```
units       = pay / price(unit, latest)
unitsThen   = oldPay / price(unit, month)
unitChange  = units / unitsThen - 1
breakEven   = oldPay * ipcGBA(latest) / ipcGBA(month)
realChange  = pay / breakEven - 1      // a ratio, never a subtraction of percentages
```

Prices are GBA, so the benchmark must be the GBA IPC, not Nacional (over the last 12 months: 33.54 % vs 33.35 %).

### Acceptance values (2026-09 data)

| Input | Expected |
|---|---|
| $1.200.000 in asado / yerba | 71.3 kg / 452.4 packs |
| $1.200.000 vs CBT Hogar 2 | 73.5 % |
| CBT Hogar 2 / crianza <1 in asado | 97.0 kg / 33.9 kg |
| $30.000 in 2019-01, asado then | 160.5 kg |
| IPC GBA 2019-01 → 2026-09 | 189.1236 → 12523.1733, x66.217 |
| Break-even / real change, $30.000 in 2019-01 vs $1.200.000 | $1.986.506 / -39.59 % |
| Same case, worst / best of the 19 non-seasonal tiles | carne picada -57.6 % / fideos -3.7 % |

### The 22 units (GBA)

Use the code to query and assert the description at ingest. The UI labels (singular, plural, pack size) are hand-written.

| Product | Code | Unit | 2026-09 price |
|---|---|---|---:|
| Asado | `01.1.2.1.02` | kg | 16,836.34 |
| Carne picada común | `01.1.2.1.08` | kg | 10,713.74 |
| Pollo entero | `01.1.2.2.01` | kg | 4,787.75 |
| Salame | `01.1.2.6.09` | kg | 26,910.30 |
| Queso cremoso | `01.1.4.2.03` | kg | 14,603.36 |
| Manteca | `01.1.5.3.01` | 200 g | 4,600.94 |
| Dulce de leche | `01.1.4.3.05` | 400 g | 3,953.16 |
| Huevos de gallina | `01.1.4.4.01` | dozen | 3,940.50 |
| Leche fresca entera sachet | `01.1.4.1.01` | litre | 2,071.04 |
| Pan francés | `01.1.1.1.05` | kg | 4,958.05 |
| Fideos secos tipo guisero | `01.1.1.4.04` | 500 g | 1,751.06 |
| Yerba mate | `01.2.1.1.12` | 500 g | 2,652.39 |
| Café molido | `01.2.1.1.02` | 500 g | 14,027.98 |
| Cerveza en botella | `02.1.3.1.01` | litre | 4,394.49 |
| Vino común | `02.1.2.1.01` | litre | 2,312.09 |
| Gaseosa base cola | `01.2.2.1.04` | 1.5 litres | 3,806.44 |
| Papa | `01.1.7.1.19` | kg | 2,201.11 |
| Cebolla | `01.1.7.1.10` | kg | 2,696.23 |
| Tomate redondo | `01.1.7.1.26` | kg | 4,038.58 |
| Pañales descartables | `12.1.3.1.04` | 10 units | 4,709.66 |
| Lavandina | `05.6.1.1.12` | 1,000 cc | 1,380.53 |
| Desodorante | `12.1.3.2.08` | 150 cc | 4,550.81 |

## Out of scope

- Wage index and any salary-history slider: it invents someone's earnings path.
- Region switch: asado isn't published outside GBA, and the other regions have only 14 products. First candidate after launch.
- "Tu inflación" or any personal inflation rate.
- Trueque as a separate picker, population, trade, poverty and activity data.
- Prices before 2016-12.
- Accounts, database, stored results, leaderboards, comments, runtime LLM.
- Analytics. Add later only if amounts provably can't reach it.
- Dollar conversion, custom domain, ads. Commercial use would break the Hobby terms.

## Data

### Endpoints used

| Need | Query | Rows |
|---|---|---:|
| Prices | `ipc_nacional?region=eq.GBA&tipo_de_indicador=eq.Precio promedio&periodo=gte.201612&codigo=in.(...)&order=periodo,codigo` | 2,596 (3 pages) |
| Benchmark | `ipc_nacional?region=eq.GBA&codigo=eq.0&tipo_de_indicador=eq.Indice&periodo=gte.201612&order=periodo` | 118 |
| Family preset | `valorizacion_canastas_cba_cbt?codigo=eq.CBT H2&tipo_de_indicador=eq.Hogar 2&order=periodo.desc&limit=1` | 1 |
| Baby preset | `canasta-crianza?select=Periodo,tot_men1&order=Periodo.desc&limit=1` | 1 |

That is about 6 requests per refresh.

### Verified (live probes and measurements)

- 59 GBA products have peso prices from 2016-04 to 2026-09, with units unchanged. All 22 chosen products have no nulls in the 118 months from 2016-12.
- GBA general IPC runs 2016-12 to 2026-09, base Dec 2016 = 100.
- 2026-09: CBT Hogar 2 $1,632,504.69 (couple with children aged 6 and 8), crianza under 1 year $570,832 (of which goods and services $184,912).
- The API returns at most 1000 rows per response even with a higher `limit`, so pagination is required. Latency is about 50 ms. Without the key it returns 401.
- Responses are 206 with `Prefer: count=exact` and a limit, otherwise 200. `Content-Range` gives the total for validating coverage.
- Field names are not consistent: `periodo` on `ipc_nacional`, `Periodo` and `Mes` on `canasta-crianza`. `periodo` is a `YYYYMM` string.
- Nulls carry a marker in `<col>_null` (`///` = unavailable, `s` = suppressed). No rate-limit headers were observed.
- Snapshot size for the 22 products over 118 months, plus IPC and both presets: 20.5 KB raw, 9.3 KB gzipped (measured with a compact JSON shape).
- `effect` latest on npm is 4.1.2 (stable), and the v4 guidelines URL responds. `next` latest is 16.4.4.
- Vercel docs, read today: Hobby includes 1M function invocations, 4 active CPU-hours and 100 GB of transfer, for non-commercial use only. Hobby cron runs once per day at most.
- Next.js docs: if ISR revalidation throws, the last good data keeps being served and the next request retries.
- Name checks: `gh repo view jcarugati/cobro-en-asado` returns not found, and `cobro-en-asado.vercel.app` returns 404 `DEPLOYMENT_NOT_FOUND`.
  - Rejected as taken on Vercel: `asadometro.vercel.app` (an unrelated app about who attends the most asados) and `cuanto-asado.vercel.app`.

### Assumed (not tested)

- People will enjoy this and share it. Scores are agent judgment; no real user has seen it.
- INDEC's API terms allow this public use with attribution. The terms were not read, so check them during the build and always show `Fuente: INDEC`.
- API rate limits are harmless at about 6 requests per day.
- Rendering a card takes roughly 0.2 s of CPU, which would allow about 72,000 uncached cards per month within 4 CPU-hours.
- The `effect` client bundle stays small enough. Measure it.
- A daily refresh is frequent enough for monthly INDEC releases.

## Architecture

```
INDEC API
   │  Bearer key, server only (Vercel env, never NEXT_PUBLIC_)
   ▼
getSnapshot()   Effect: paginate → decode with Schema → validate coverage
   │  ISR, revalidate once a day. If it throws, the last good data stays
   ▼
Static page + snapshot, on the CDN
   │
   ▼
Browser: all calculations. Pay never leaves the device.

Card route (next/og): gets only counts, unit and month. Never pesos.
```

- **Stack:** Next.js App Router on Vercel Hobby, TypeScript, Effect v4 for the data layer and logic. Follow the v4 guidelines: no `flow`, no tacit `Effect.map(fn)`.
- **Entry points:** Next owns the process in routes, so run Effects at that boundary. Any standalone script uses a `runMain`-style entry point.
- **Refresh:** ISR needs no cron, deploy hook or GitHub Action. A GitHub scheduled workflow would also be disabled after 60 days without repo activity (from memory, not checked today).
- **Snapshot validation, before it can be served:**
  - All 22 codes are present with the expected description.
  - One row per product and month, full month coverage, no unexplained nulls.
  - The data month is the latest month common to prices and IPC. Each preset prints its own month if it differs.
  - Any failure throws, so ISR keeps the last good version.
- **Build:** the key must be available at build time and at runtime. If INDEC is down during a deploy, the build fails and the previous deployment stays live.
- **Card route:** validate input strictly (integer ranges, known unit slug, known month format, otherwise 404). Cards contain only their URL's values, so they can be cached as immutable. Bundle the font locally and don't rely on emoji.

### Cost

| Item | Usage | Cost |
|---|---|---|
| Page and snapshot | Static CDN, about 9 KB gzipped of data | $0, 100 GB transfer included |
| INDEC refresh | About 6 requests per day, only when the page has traffic | $0 |
| Cards | Only on share or unfurl, then cached | $0, within 1M invocations and 4 CPU-hours |
| LLM, database, paid services | None | $0 |

Visitor math runs on the visitor's device, so traffic adds transfer but no compute.

## UI direction

Superseded on 2026-11-03: the live look is `Bodegón`, see the decisions in `docs/PLAN.md`. Scope and copy rules below still hold.

A butcher's ticket, not a dashboard.

- One column, about 560 px wide, one screen until the visitor chooses to go further. The result is the page.
- Warm paper background, near-black ink, and one ember accent, with a charcoal dark mode.
- One enormous number with tabular figures. One free grotesque, served locally. No chart library, no decorative images, no gradients or card grids.
- Tally marks are the only graphic. Dotted rules and a small printed footer give the receipt feel, on the page and the share card.
- Motion: a count-up of at most 400 ms, off under `prefers-reduced-motion`.

### Copy rules

- Rioplatense voseo, neutral gender: `Cobrás`, `Probá`, `Alguien cobra`.
- Order is always asado, then yerba, then canasta. The canasta line is a flat fact (`Equivale al 73,5 %...`). Never `no te alcanza` or `pobre`.
- No governments, parties, presidents or political eras. No `te robaron`, no `INDEC miente`. Say `los precios en general`, not `la inflación oficial` as an opponent.
- Every result shows both `GBA` and the data month. Say `precio promedio`, because these aren't shop quotes or specific brands.
- Humour comes from the unit (`869 lavandinas`), never from the visitor's income.

## Risks

| Risk | Handling |
|---|---|
| **One joke, one share.** Critic B's strongest argument against this pick | The tiles and `¿Y antes?` give reasons to retry. Accepted: this is something fun to try, not a daily habit |
| **Asado counts can reveal pay.** 71 kg implies about $1.2M | Sharing is opt-in with a visible warning. Pesos never appear in URLs, cards, logs or storage |
| **`Acá no está a ese precio`.** GBA averages, published with a lag, will be the first complaint | GBA and month on every result and card, plus the price override. Regions are the first post-launch candidate |
| **Reads as bleak or partisan** | No suggested dates, no slider, flat canasta wording, the copy rules above |
| **Key expires about 2027-05-01, or the API changes** | Old data keeps serving with its month visible, but nothing alerts anyone and the owner must renew the key. While revalidation fails, requests keep retrying, bounded by traffic |
| **Forged share URLs** can show any count under an INDEC footer | Accepted: a card is a claim about a person, it shows no INDEC price, and values are range-limited |
| **Card route exhausts Hobby quotas** in a viral spike | Immutable caching and strict validation. The page itself stays static, but check how Hobby behaves at its limits and use a generic preview as the fallback |
| **`effect` weight in the browser** | Measure it. If it is too heavy, keep Schema on the server and keep the client code lean, still following the v4 style |
| **Ten-year floor.** Dates before 2016-12 are refused | Friendly refusal. Don't mention the politics of older INDEC data |
