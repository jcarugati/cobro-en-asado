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

These hold counts only, never pesos, and are path-based so `/` and each share page stay CDN-cached.

```
pay result     /c/p/<unit>/<count>/<altCount>/<month>
own price      /c/o/<unit>/<count>/<altCount>/<month>
then vs now    /c/t/<unit>/<thenCount>/<nowCount>/<thenMonth>/<month>
card image     /card/<the same segments>
```

- `count`: `0` to `1000000`, canonical integer with no leading zeros.
- `unit`: a known slug. The alternate unit is not in the URL: it is `yerba` when `unit` is `asado`, otherwise `asado`.
- `month`: `YYYYMM`, valid calendar month, from `201612` to `209912`. `thenMonth` must be earlier than `month`.
- Anything else returns 404.
- The encoder returns an `Option`. When a value is out of range (say a $1 override price), `Compartir` is hidden, so the app never builds a link the route rejects.
- The share button builds `t` when `¿Y antes?` is showing, otherwise `o` when an override is active, otherwise `p`.
- **Nothing is requested from `/c` or `/card` before the tap on `Compartir`.** No `<Link>` to them, no prefetch and no card preview `<img>`. A count implies the pay, so an early request would break `El número no sale de tu teléfono`.
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
| `vercel.json` declares `framework: nextjs` | The project was created before any code and has no framework set |
| npm and Vitest | Installed everywhere, and no build-script approvals to manage |
| The only script is `scripts/write-snapshot-fixture.ts`, run with Node type stripping and relative `.ts` imports | It needs no runner dependency, only `@effect/platform-node` as a devDependency for `runMain` |
| Next.js owns the entry point in routes | Matches the design and the Effect guidelines |
| Share is offered for a typed pay only, not for presets | The card says `Cobro...`, which would be false for a preset. Preset cards are a follow-up |
| INDEC terms checked 2026-11-03 | The API home page allows copying and redistribution when the primary source is cited, and `/ayuda/terminos` adds no restriction on reuse. `INDEC` stays on every result and card |
| Client bundle limit: the app's own code, including `effect` modules, adds at most 30 KB gzip to T1's 135 KB baseline | The design asks to measure `effect` in the browser. `next build` no longer prints sizes, so T3 and T5 each measure the way T1 did: the gzip size of the modern client chunks `/` loads, from the build output, excluding the `nomodule` polyfill. `Option` plus `Result` cost about 8 KB, while the `Effect` runtime alone is about 32 KB, which is why `src/domain` stays free of it |
| UI PRs get a Claude review only | Owner's routing for this build, which overrides the global rule asking for both reviewers. Non-UI PRs get both |
| Review loop cap | Owner's rule for this build, which overrides the global "until no valid findings". Cheap low findings still get fixed |

## Follow-ups

None yet.
