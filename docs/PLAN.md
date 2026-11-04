# Build plan

Source of truth for scope: `docs/DESIGN.md`. This file holds the order of work, who owns what, and the contracts tasks share.

## Tasks

One branch, one worktree and one PR per task. Merges are sequential; rebase before merge.

| # | Branch | Scope | Implementer | Reviewers | Depends on |
|---|---|---|---|---|---|
| T1 | `feat/scaffold-data` | Next.js + Effect scaffold, INDEC client, validated snapshot and its tests, committed 2026-09 fixture, ISR, bare page with real data, CI, deployed | Codex `gpt-6.1-sol` high | Codex + Claude | none |
| T2 | `feat/core-logic` | Pay parser, calculations, refusals, formatters, tally, share path codec, acceptance tests on the fixture | Codex | Codex + Claude | T1 |
| T3 | `feat/main-ui` | Full page: input, result, tally, tiles, presets, override, `¿Y antes?`, `Cómo se calcula`, theme, font, MVP item 9 (quality), client bundle measurement | Claude `claude-opus-5-5` high | Claude | T2 |
| T4 | `feat/share-routes` | `/c/...` page, `/card/...` PNG route, per-result metadata, immutable caching, generic preview, card CPU measurement, Hobby limit behaviour | Codex | Codex + Claude | T3 |
| T5 | `feat/share-ui` | Share button, Web Share with PNG, copy and download fallback, warning line, shared banner, card visuals, MVP item 9 for all of this, client bundle measurement | Claude | Claude | T4 |
| T6 | `chore/launch` | Live screenshots, first-time-user review, fixes, README, AGENTS status | Claude | Claude, plus Codex if non-UI files change | T5 |
| F1a | `feat/fun-domain` | Horas de laburo: client-safe time math and fixture tests | Codex | Coordinator | T6 |
| F1b | `feat/fun-domain` | Armá tu asado: basket math, share codec, cached-snapshot card and bare pages | Codex | Coordinator | T6 |
| F1c | `feat/fun-domain` | ¿Más o menos?: seeded rounds, score, share codec, card and bare pages | Codex | Coordinator | T6 |

## Gate

Every PR, before merge: `npm run typecheck && npm test && with-indec npm run build`.

- CI runs typecheck and Vitest with no secrets, on the Node version the Vercel project uses (26). The Vercel preview deployment runs the build with the key.
- Tests never call INDEC. Acceptance values are pinned to `test/fixtures/snapshot-202609.json`, so a new INDEC release cannot break them.
- At most 2 heavy test or build runs at once across all threads.
- After each merge the coordinator checks that the production deployment is READY, then smoke-tests `https://cobro-en-asado.vercel.app` (HTTP 200 with real INDEC data).

## Review rules

- The coordinator requests reviews and judges each finding. The implementing thread fixes valid ones and merges its own PR once told the round is clean.
- A round with no valid findings ends the loop. Otherwise fix and run a new round, passing the previous findings and responses.
- After two consecutive rounds with no blocker or major finding, log the remaining low findings under Follow-ups and merge.
- No AI attribution in commits or PR text. Commits are authored by `jcarugati`.

## Shared contracts

### File ownership

| Path | Owner |
|---|---|
| `src/domain/**` (client-safe: pure functions plus `Option` and `Result`; no `Effect` runtime, no `Schema`) | T1, T2 |
| The `Effect` runtime and `Schema` | `src/server/**`, scripts and tests only |
| `src/server/**`, `scripts/write-snapshot-fixture.ts`, the fixture | T1 |
| `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `src/components/**`, fonts | T3 (T1 leaves a bare version), then T5 |
| `app/c/**`, `app/card/**`, `app/opengraph-image*` | T4, then visuals in T5 |

### Snapshot

```ts
type Month = string // "YYYYMM"
type Snapshot = {
  firstMonth: Month                       // always "201612"
  lastMonth: Month                        // latest month common to prices and IPC
  prices: Record<UnitSlug, number[]>      // one per month, firstMonth..lastMonth, contiguous
  ipc: number[]                           // GBA general level, same indexing
  wages: {
    lastMonth: Month                      // latest common wage month, clipped to lastMonth
    series: Record<WageKey, number[]>      // contiguous from firstMonth; may lag IPC/prices
  }
  presets: {
    cbtHogar2: { month: Month; value: number }
    crianzaMenor1: { month: Month; value: number }
  }
}
```

### Caching

- `app/page.tsx` exports `revalidate = 86_400`. Cache Components stays off, because it forbids the empty `generateStaticParams` that T4 needs.
- All pages read the snapshot through one `unstable_cache` entry with `{ revalidate: 86_400 }`, because leaving it out caches forever. A new share URL reuses that entry, so INDEC is only called when the entry is missing or expired.
- The cache key includes `VERCEL_GIT_COMMIT_SHA`. That cache survives deployments, and this keeps an old snapshot shape from reaching new code.
- Page and data caches stack, so a new INDEC release can take up to about 48 h to appear. That is fine for monthly data.

### Share URLs

These hold public counts, seeds and months only, never pesos, and are path-based so `/` and each share page stay CDN-cached.

```
pay result     /c/p/<unit>/<count>/<altCount>/<month>
own price      /c/o/<unit>/<count>/<altCount>/<month>
then vs now    /c/t/<unit>/<thenCount>/<nowCount>/<thenMonth>/<month>
asado plan     /c/a/<people>/<thenMonth>/<month>
game result    /c/j/<score>/<total>/<seed>/<month>
card image     /card/<the same segments>
```

- `count`: `0` to `1000000`, canonical integer with no leading zeros.
- `unit`: a known slug. The alternate unit is not in the URL: it is `yerba` when `unit` is `asado`, otherwise `asado`.
- `month`: `YYYYMM`, valid calendar month, from `201612` to `209912`. `thenMonth` must be earlier than `month`.
- Plan people: canonical integer 1..100; both months valid and thenMonth < month. The card computes prices from the cached snapshot and refuses missing months.
- Game: canonical integers with 0 <= score <= total, total = 10, seed = 0..999. The shared page also checks that the pinned month can generate a game. The card needs no snapshot.
- Anything else returns 404.
- The encoder returns an `Option`. When a value is out of range (say a $1 override price), `Compartir` is hidden, so the app never builds a link the route rejects.
- The share button builds `t` when `¿Y antes?` is showing, otherwise `o` when an override is active, otherwise `p`.
- **Nothing is requested from `/c` or `/card` before the tap on `Compartir`.** No `<Link>` to them, no prefetch and no card preview `<img>`. A count implies the pay, so an early request would break `El número no se manda a ningún lado`.
- Cards answer with `Cache-Control: public, max-age=31536000, s-maxage=31536000, immutable`. `next/og` defaults to `max-age=0`. After T4 merges, a second production request must show `x-vercel-cache: HIT`.
- Fetching the card after the tap can use up the browser's activation window. On `NotAllowedError`, keep the fetched file with its share path and ask for a second tap, which shares it with no `await` first. Discard the file if the path changes. If the second tap also fails, show the copy and download buttons, each acting on its own tap. On `AbortError` the visitor cancelled, so do nothing.
- `next/og` cannot read WOFF2. The card route needs a `.ttf` or `.woff`, within its 500 KB bundle limit.
- Every card ends with `Promedio GBA · <month> · INDEC`, including the second-act card, so each one shows GBA, the month and the source. The page footer says `Fuente: INDEC`.

### Input limits

- A `¿Y antes?` month is accepted only when `firstMonth <= m < lastMonth`. Earlier months and later months each get a friendly refusal, because later months have no price and the latest month compares nothing.
- An override price must be above zero.

## Decisions

| Decision | Why |
|---|---|
| Plan URLs hold no pesos; plan cards read the cached snapshot | Public people and months reproduce the same shopping basket without letting a forged URL invent an INDEC price |
| Game candidates need both a 5 percentage point gap and a 5% relative gap | The first removes close short-span answers; the second removes coin flips when decades of inflation make 5 points negligible |
| Games require five más and five menos answers with distinct products, reserving enough products for the remaining answers or returning none | Always tapping the same answer scores five, and reserving products prevents early choices from exhausting one side in historical months |
| Game URLs pin seed and month | Friends replay the same questions even after a new data release |
| Work time defaults to 176 hours and defines a day as monthly hours / 22 | Eight hours times 22 workdays makes the assumption explicit and lets an edited monthly total retain the same day definition |
| Work time never leaves the page or appears on cards | A product price plus its work time reveals the visitor's pay |
| The chart verdict says `Empate` when the wage lag leaves the winner unknown | Wages are compared at the last common month, but the chart shows the latest product price. A printed tie with either price or a winner that flips between them cannot support a definite verdict until the missing wage value is published |
| Charts include the national INDEC wage index as reference lines; IPIM is skipped; series use multiples | Owner requested wages despite the original exclusion in DESIGN.md. They describe reference series, never the visitor's salary history: own pay stays two points. Wholesale IPIM is outside this consumer-price comparison. Multiples (`x66`) read directly and match the existing `x121` copy, unlike base 100 |
| The chart is a race: every line starts at x1 on a log axis of multiples, and whoever ends highest rose the most | It answers the one question a visitor has, `¿Los salarios le ganaron al asado?`, and a log axis keeps a x2 step the same height in 2017 and 2025. `Tu sueldo` is two dots joined by a dashed line, because `docs/DESIGN.md` forbids an invented earnings history; the gap to the product line is the change in kilos, so the marker sits there. It is a full-width row under the two columns, so the first screen stays as it was, and the sticky card now lives in a stretched slot, because browsers bound a sticky grid item by the whole grid. Hand-rolled SVG with HTML labels in percent: no dependency, nothing to measure, no layout shift. An own line past x1.000 or under x0,01 stops at that limit and its label says so, or typed extremes would crush the real series |
| `vercel.json` declares `framework: nextjs` | The project was created before any code and has no framework set |
| npm and Vitest | Installed everywhere, and no build-script approvals to manage |
| The only script is `scripts/write-snapshot-fixture.ts`, run with Node type stripping and relative `.ts` imports | It needs no runner dependency, only `@effect/platform-node` as a devDependency for `runMain` |
| Next.js owns the entry point in routes | Matches the design and the Effect guidelines |
| Share is offered for a typed pay only, not for presets | The card says `Cobro...`, which would be false for a preset. Preset cards are a follow-up |
| INDEC terms checked 2026-11-03 | The API home page allows copying and redistribution when the primary source is cited, and `/ayuda/terminos` adds no restriction on reuse. `INDEC` stays on every result and card |
| Client bundle limit: the app's own code, including `effect` modules, adds at most 30 KB gzip to T1's 135 KB baseline | The design asks to measure `effect` in the browser. `next build` no longer prints sizes, so T3 and T5 each measure the way T1 did: the gzip size of the modern client chunks `/` loads, from the build output, excluding the `nomodule` polyfill. `Option` plus `Result` cost about 8 KB, while the `Effect` runtime alone is about 32 KB, which is why `src/domain` stays free of it |
| UI PRs get a Claude review only | Owner's routing for this build, which overrides the global rule asking for both reviewers. Non-UI PRs get both |
| Review loop cap | Owner's rule for this build, which overrides the global "until no valid findings". Cheap low findings still get fixed |
| Card render CPU: median 0.0194 s (20 production renders, 2026-11-03) | Measured `process.cpuUsage()` around the built card route's `GET` plus full PNG body consumption, sequentially on Node 26.13.0; includes the first cold render (0.197 s). This is local process CPU, not Vercel billing telemetry. The original 0.2 s estimate is conservative for warm renders; immutable caching still matters for cold requests and transfer |
| Hobby limits can pause features; a generic preview is not a quota escape hatch | [Vercel Hobby docs](https://vercel.com/docs/plans/hobby#hobby-billing-cycle), fetched 2026-11-03, say exceeding usage usually requires waiting 30 days before using that feature again; [limits](https://vercel.com/docs/limits) require Pro for higher limits. For this free-only app, uncached cards and revalidation can become unavailable on compute exhaustion, and transfer exhaustion can affect static pages too. The build-time generic preview avoids per-card compute but cannot bypass exhausted delivery quotas. Keep strict validation and immutable caching; no automatic paid upgrade |
| Copy diverges from `docs/DESIGN.md` on purpose | The first-visit review of the live site found words that read wrong or were hard to check: `hoy tendrías que cobrar`, `los palitos`, `El número no se manda a ningún lado`, `tu dispositivo`, `septiembre de 2026` inside sentences, and the comparison-link line `Alguien cobraba 161 kilos de asado en 2019. Hoy, 71. ¿Y vos?`. `docs/DESIGN.md` stays as agreed; the code is right where the two differ |
| The price-move sentence says `subió` and `bajó` instead of the design's `aguantó` | The first-visit review replaced `aguantó`, but a flat `Lo que menos subió` was then often false: the bottom of the ranking is a price that fell in 15 of the last 16 months of the fixture, such as asado at -5,3 % for marzo 2026. Each side now takes its verb from its own price change. It opens with `Sin contar verduras` because papa, cebolla and tomate stay out of the ranking, as the design requires, yet have their own tiles: tomate rose x121 since enero 2019 while the sentence names carne picada at x94. The acceptance row in `docs/DESIGN.md` (`carne picada -57.6 % / fideos -3.7 %`) describes units of pay and stays arithmetically true, while the code now ranks and tests by price change (carne picada x94,4, fideos x41,5) |
| The look is `Bodegón`, replacing the butcher's ticket in `docs/DESIGN.md` | The owner called the live ticket UI horrible (2026-11-03). Three directions were rendered and an independent critic picked this one: butcher-paper pink, an oxblood result card, Caprasimo and Figtree, and 22 hand-drawn sticker icons. `docs/DESIGN.md` stays as agreed for scope and copy; the code is right on the look |
| Tally marks became a pile of product icons, one per unit up to 100 | The brief asks for product visuals proportional to the quantity. Past 100 each icon is worth 2, 5, 10, 20... and a legend says how much, on the page and on the share image, so the pile stays a true share of the count at any size |
| The picker shows six units and `Más` opens a sheet with all 22 | The 22-tile wall was the page's loudest element. Asado, yerba, cerveza, vino, dulce de leche and pañales stay in reach, and a unit picked from the sheet takes the first place |
| Money fields regroup on every keystroke | The brief asks for live thousands separators. A deletion always regroups, so `1.200.00` can't be left behind. A dot just typed waits for its digits, and a paste goes through `withDots`, so `1200000.50` is refused either way and not read as 120 million |
| Share pages show the friend's result on the card and start on its unit | The page was an empty calculator under one line, which is a flat place to land from a shared link. The card turns into the visitor's own result as soon as they type. It prints the month from the link and no price, since that count may come from an older release or a butcher's price. The line above the input stays, as the design asks, because it outlasts the card once the visitor types |
| The typed pay lives in a module variable (`src/components/memory.ts`), not in storage | `docs/DESIGN.md` keeps pesos out of URLs, cards, logs and storage, and `El número no se manda a ningún lado` is a promise. A variable survives moving between tabs and dies on a reload, on purpose. Only event handlers write it, so the server never holds a value. Only the pay is remembered: the override, the past form and the unit reset |
| The nav is plain anchors plus `router.push`, not `next/link` | `test/no-early-request.test.ts` forbids `next/link` under `src/components`, and the link component requests routes on its own. Anchors keep the keyboard, a middle click and no-JS working; a plain left click swaps the page without a reload, so the pay in memory survives |
| Icons are drawn from one data file, on the page and the card | The card route can't fetch, so emoji are out, and system emoji would differ per phone anyway |

## Follow-ups

- On a phone the dotted kilos leader can cross the last month label for own months 202603 to 202607.
- On a phone the chart starts about 1,000 px down the page and nothing points to it.
- With `Tu sueldo` at x0,01 on a short range, the `x1,50` and `x1,25` axis labels touch. Absurd input only, and still legible.
- The client bundle has little room left: 161,890 bytes gzip for `/`, measured as this file describes, against 164,904 (the 134,904 baseline plus 30 KB). That leaves about 3.0 KB.
- On a phone at 390x844, a share page's card now ends 16 px below the first screen, because of the nav row, and after typing on that page with touch `Compartir` sits at 834–886, so only 10 px shows. `/` still fits.
- At 320 px wide the three tabs wrap to two rows instead of scrolling the page. At 360 px they fit one row.
- `/favicon.ico` answers 404, because the app only declares `icon.svg`. Chrome occasionally asks for it anyway and logs a console error. Seen locally after a cold server start, cause not pinned down.
- Preset cards: share is typed pay only.
- An override is forgotten when switching units and back. The headline loses its label, so it is honest but mildly annoying.
- Real phones, Web Share sheets, real screen readers, Safari and Firefox were never tested.
- The early-request guard is a text check and cannot catch `new Image()` or `sendBeacon`, or automatic invocation through effects in forms other than a direct `useEffect(tap`, such as an alias or `useLayoutEffect(tap)`.
- The INDEC key expires about 2027-05-01 and nothing alerts: the page keeps serving old data with its month visible.
- The month floor `202609` in validation stops large regressions, not a one-month step back.
