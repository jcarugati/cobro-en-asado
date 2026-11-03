# Build plan

Source of truth for scope: `docs/DESIGN.md`. This file holds the order of work, who owns what, and the contracts tasks share.

## Tasks

One branch, one worktree and one PR per task. Merges are sequential; rebase before merge.

| # | Branch | Scope | Implementer | Reviewers | Depends on |
|---|---|---|---|---|---|
| T1 | `feat/scaffold-data` | Next.js + Effect scaffold, INDEC client, validated snapshot, ISR, bare page with real data, CI, deployed | Codex `gpt-6.1-sol` high | Codex + Claude | none |
| T2 | `feat/core-logic` | Pay parser, calculations, refusals, formatters, tally, share path codec, acceptance tests, bundle measurement | Codex | Codex + Claude | T1 |
| T3 | `feat/main-ui` | Full page: input, result, tally, tiles, presets, override, `¿Y antes?`, `Cómo se calcula`, theme, font | Claude `claude-opus-5-5` high | Claude | T2 |
| T4 | `feat/share-routes` | `/c/...` page, `/card/...` PNG route, per-result metadata, immutable caching, generic preview | Codex | Codex + Claude | T3 |
| T5 | `feat/share-ui` | Share button, Web Share with PNG, copy and download fallback, warning line, shared banner, card visuals | Claude | Claude | T4 |
| T6 | `chore/launch` | Live screenshots, first-time-user review, fixes, README, AGENTS status | Claude | Claude, plus Codex if non-UI files change | T5 |

## Gate

Every PR, before merge: `npm run typecheck && npm test && with-indec npm run build`.

- CI runs typecheck and tests with no secrets. The Vercel preview deployment runs the build with the key.
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
| `src/domain/**` (client-safe, no `Schema`) | T1, T2 |
| `src/server/**`, `scripts/**` | T1 |
| `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `src/components/**`, fonts | T3 (T1 leaves a bare version) |
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
- All pages read the snapshot through one `unstable_cache` entry, so a new share URL never triggers INDEC requests of its own.
- The cache key includes `VERCEL_GIT_COMMIT_SHA`. That cache survives deployments, and this keeps an old snapshot shape from reaching new code.
- Page and data caches stack, so a new INDEC release can take up to about 48 h to appear. That is fine for monthly data.

### Share URLs

These hold counts only, never pesos, and are path-based so `/` and each share page stay CDN-cached.

```
pay result     /c/p/<unit>/<count>/<altUnit>/<altCount>/<month>
own price      /c/o/<unit>/<count>/<altUnit>/<altCount>/<month>
then vs now    /c/t/<unit>/<thenCount>/<nowCount>/<thenMonth>/<month>
card image     /card/<the same segments>
```

- `count`: `0` to `1000000`, canonical integer with no leading zeros.
- `unit`: a known slug. `altUnit`: `yerba` when `unit` is `asado`, otherwise `asado`.
- `month`: `YYYYMM`, valid calendar month, from `201612` to `209912`. `thenMonth` must be earlier than `month`.
- Anything else returns 404.

## Decisions

| Decision | Why |
|---|---|
| `vercel.json` declares `framework: nextjs` | The project was created before any code and has no framework set |
| npm | Installed everywhere and no build-script approvals to manage |
| Node type stripping for scripts, with relative `.ts` imports | No extra runner dependency |
| Next.js owns the entry point in routes; scripts use `NodeRuntime.runMain` | Matches the design and the Effect guidelines |
| Share is offered for a typed pay only, not for presets | The card says `Cobro...`, which would be false for a preset. Preset cards are a follow-up |
| INDEC terms checked 2026-11-03 | The API home page allows copying and redistribution when the primary source is cited, so `Fuente: INDEC` stays on every result |
| UI PRs get a Claude review only | Owner's routing for this build, which overrides the global rule asking for both reviewers. Non-UI PRs get both |

## Follow-ups

None yet.
