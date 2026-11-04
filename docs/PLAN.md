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
| `¿Más o menos?` keeps both faces of a round in the DOM, stacked, with the hidden one under `visibility: hidden` | Stacking is what keeps the card and the buttons still through the reveal, with no measuring. The answer is in the HTML this way, and it already was in the snapshot the page needs: this game has no stakes worth hiding it for |
| A hit in the game's progress marks is that round's product sticker, a miss a drawn x in a hollow ring | The row reads as the stickers you won, it is the game's own version of the first tab's pile, and hit and miss differ by shape, never by colour alone |
| The game's reveal draws its numbers and sparkline on a plate, a scale's ticket inside the oxblood card | `--line-product` and `--line-prices` were tuned for light surfaces and do not reach 3:1 on the card |
| The game ignores a second tap within 500 ms on any control in its page, except the share fallback's two buttons | Every tap there swaps the buttons under the finger, so a double tap would otherwise answer the next question unseen or throw away the score, and at 400 ms it still did. Nobody reads a question or a reveal that fast. Capturing it in one place also covers `Compartir` and `Cómo se juega`. `Copiar link` then `Descargar imagen` are two deliberate choices, so the guard would only lose one. Only an accepted tap restarts the wait, so steady tapping cannot lock the buttons. `Otra partida` waits 1,500 ms, because it is the one button that destroys a result and it can sit under a slow extra tap on `Ver el resultado`; anyone who waits 1.5 s after their last tap is never ignored |
| The verdict comes from right or wrong plus the margin, walking that list through the game | By position, round 1 right was always the same word whatever happened, and picking from each round alone repeated a line back to back in about one neighbouring pair in ten. The same answers still read the same. `por goleada` is about one round in fifteen, so it gets its own lines and a harder hit |
| `por poco` is under 1.25x between the two rises the reveal prints, `por goleada` from 2x or when one side did not rise | Not the multiples the near-tie rule uses: 11,5 % against 33,5 % is only 1.2x as multiples and reads as nothing like `por poco` |
| `Otra partida` moves 137 seeds, not 1 | Today's seed plus one is tomorrow's daily game, so its questions would repeat. 137 is coprime with 1000, so every seed still comes round |
| A record needs a streak of 3 | Saying `¡Récord!` for a first game's streak of 1 cheapens it. `Tu mejor racha` still counts from 1 |
| On phones up to 760 px tall the answer buttons are sticky, the question sits above its sticker and the title is hidden | The buttons must be on screen as a friend's link opens, so on the shortest screens they may cover the sticker and, on a reveal, the source line until a scroll |
| The best streak is the game's only storage, written as soon as it grows | Leaving mid-game keeps the record. It holds no pay, and a blocked or junk value reads as no record |
| Plan URLs hold no pesos; plan cards read the cached snapshot | Public people and months reproduce the same shopping basket without letting a forged URL invent an INDEC price |
| Game candidates need a 5 percentage point gap and prefer a 12% relative gap, falling back to 5% if no balanced game exists | The 5 pp rule stays as the owner asked; 5% made most reveals coin flips, while 20% left 17 of 21 products with one fixed answer and real months with no game. The fallback keeps the game alive when a release leaves too few products |
| Games require five más and five menos answers with distinct products, reserving enough products for the remaining answers or returning none | Always tapping the same answer scores five, and reserving products prevents early choices from exhausting one side in historical months |
| Game URLs pin seed and month | Friends replay the same questions even after a new data release |
| Work time defaults to 176 hours and defines a day as monthly hours / 22 | Eight hours times 22 workdays makes the assumption explicit and lets an edited monthly total retain the same day definition |
| Work time never leaves the page or appears on cards | A product price plus its work time reveals the visitor's pay |
| The clock assumes a 9:00 start and stays out of URLs and cards, like all work time | It turns a duration into a moment of the day; past the workday it shows nothing rather than a false time |
| The chart verdict says `Empate` when the wage lag leaves the winner unknown | Wages are compared at the last common month, but the chart shows the latest product price. A printed tie with either price or a winner that flips between them cannot support a definite verdict until the missing wage value is published |
| Charts include the national INDEC wage index as reference lines; IPIM is skipped; series use multiples | Owner requested wages despite the original exclusion in DESIGN.md. They describe reference series, never the visitor's salary history: own pay stays two points. Wholesale IPIM is outside this consumer-price comparison. Multiples (`x66`) read directly and match the existing `x121` copy, unlike base 100 |
| The chart is a race: every line starts at x1 on a log axis of multiples, and whoever ends highest rose the most | It answers the one question a visitor has, `¿Los salarios le ganaron al asado?`, and a log axis keeps a x2 step the same height in 2017 and 2025. `Tu sueldo` is two dots joined by a dashed line, because `docs/DESIGN.md` forbids an invented earnings history; the gap to the product line is the change in kilos, so the marker sits there. It is a full-width row under the two columns, so the first screen stays as it was, and the sticky card now lives in a stretched slot, because browsers bound a sticky grid item by the whole grid. Hand-rolled SVG with HTML labels in percent: no dependency, nothing to measure, no layout shift. An own line past x1.000 or under x0,01 stops at that limit and its label says so, or typed extremes would crush the real series |
| `vercel.json` declares `framework: nextjs` | The project was created before any code and has no framework set |
| npm and Vitest | Installed everywhere, and no build-script approvals to manage |
| The only script is `scripts/write-snapshot-fixture.ts`, run with Node type stripping and relative `.ts` imports | It needs no runner dependency, only `@effect/platform-node` as a devDependency for `runMain` |
| Next.js owns the entry point in routes | Matches the design and the Effect guidelines |
| Share is offered for a typed pay only, not for presets | The card says `Cobro...`, which would be false for a preset. Preset cards are a follow-up |
| INDEC terms checked 2026-11-03 | The API home page allows copying and redistribution when the primary source is cited, and `/ayuda/terminos` adds no restriction on reuse. `INDEC` stays on every result and card |
| Client bundle limit: the app's own code, including `effect` modules, adds at most 30 KB gzip to T1's 135 KB baseline | The design asks to measure `effect` in the browser. `next build` no longer prints sizes, so T3 and T5 each measure the way T1 did: the gzip size of the modern client chunks `/` loads, from the build output, excluding the `nomodule` polyfill, with Node's `zlib.gzipSync` at its default level. `Option` plus `Result` cost about 8 KB, while the `Effect` runtime alone is about 32 KB, which is why `src/domain` stays free of it |
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
| The planner's shared banner carries no price: `Te pasaron un asado para 6. Armá el tuyo:` | A link keeps its month and the card prints today's, so a priced banner shows two totals after every INDEC release. `planSharedLine` stays for the link preview, whose price is pinned with its own card |
| The planner's card prints `$13.968 por cabeza` under the total, in the display face, and skips it for one person | It is what a `che, armemos` chat asks, and it reads as part of the sentence the total starts. It stays off the PNG and the share text, which say what the asado costs |
| On a short laptop the planner's total and stickers give up size, which keeps `Compartir` on the first screen down to 1366x768 | The number caps at 18vh and the stickers narrow, with one limit when the work line is there and a larger one when it is not, so a card without it keeps the bigger table. Neither applies at 1440x900. Shorter windows can still miss it: see Follow-ups |
| Each tap on the planner's stepper re-drops one sticker, keyed by the last count that landed on its place | The toy wore out after about 5 taps because the table did not react. Exactly one key changes per tap, in either direction. The load cascade went from 40 ms to the page's 7 ms per sticker, because a re-drop keeps its place's delay and the last sticker would sit invisible for 360 ms |
| The planner's stepper ends use `aria-disabled`, not `disabled` | A disabled button drops the keyboard's focus the moment the count reaches 1 or 100. The click clamps anyway |
| The planner's stepper has no live region of its own: the one live sentence carries the count and the total | `Un asado para 7 sale $99.116.` tells a screen reader the new number and what it did, and two regions would talk over each other. The work line has its own region, which waits for the 700 ms pause `Money` uses, so typing a pay is not read out on every key. A month change is not announced: the tail is plain text on the card |
| The planner's card shows its ten stickers as two rows of five, not one row | One row leaves icons of 28 px on a 360 px phone, and the whole table is what makes the card worth a screenshot |
| `Cómo calculamos` states rations in grams and millilitres | INDEC prices gaseosa per bottle, and `0,2 botellas por persona` is nobody's idea of a serving. Generated from `ASADO_LIST`, so they can't drift |
| A refused month prices today's plan with the first month as a placeholder, and nothing past it is shown | `planAsado` needs a valid past month even though today's prices don't depend on it, and the share link hides with it |
| The planner's multiple and stepper count stamp with a scale and no fade, the multiple only when its whole number moves | The page's sticker drop starts from opacity 0, which left the multiple below 60 % opacity for 42 % of frames in a fast run of taps, and the count for 78 %. The multiple's text changes on 77 of the 99 taps from 1 to 100, its whole number on 13: the rest is rounding. A month change within the same whole number gets no stamp |
| The planner's share card prints the multiple as a yolk sticker | It is the surprise on the page, and at 32 px in cream it read as a footnote in a chat |
| Icons are drawn from one data file, on the page and the card | The card route can't fetch, so emoji are out, and system emoji would differ per phone anyway |
| Work time is a second reading of the main card, shown only for a typed pay | The owner's brief asks for a toggle, not a page. A preset is not the visitor's pay, so it has no work time: it falls back to kilos and clearing it returns to the chosen view. One sticker replaces the pile, because a pile would lie about what it counts |
| Sharing from the hours view still sends the kilos result, and the button says `Compartir en kilos` | A card has to match what the button promises, and work time implies the pay as directly as kilos do, so it stays off cards and URLs |
| On a phone the toggle's row takes no room until there is a pay, and the card gave up height for it: `--cap` went from 19dvh to 17dvh and the minimum height from 470 to 440 px | A reserved row left 44 blank px above the card and cut the tagline to its first line, on every first visit. The row now pushes the card 44 px on the first keystroke, but the finger is on the keyboard then and the input stays put. A preset over a typed pay only hides the row, so hiding it adds no movement of its own, though the preset chips still move with the card. Desktop keeps the row reserved, because the left column has room. The shrink keeps `Compartir` on the first screen at 390x844 for asado. In the hours view that holds for 3 of the 22 units, because shorter times get bigger digits, and the digits are the fun |
| The chart renders only when its slot comes within 50 px of the viewport, through `React.lazy` | Merged with the planner, `/` measured 165,082 bytes against the 164,904 limit, before later code. With all of it and no split it measures 165,652, so the decision still holds. Fetching the chart after every load would save nobody a byte, so the limit can only leave its file out if a visitor who never reaches it never downloads it. First load is 161,994 bytes and the file is 4,423, fetched when the slot comes near. A visitor who loads it downloads 166,417 in total, which is over the limit and about 0.8 KB more than with no split, because a separate file compresses worse. On phones from 360x740 to 430x932 the file waits for a scroll. On desktop it often does not: at 1440x900 and 1920x1080 the slot is already within the margin, so the file loads at once and those visitors pay the 0.8 KB for nothing; at 1280x720 and 1366x768 it waits. The first Tab press also loads it, because on a short laptop the chart would otherwise mount behind the focus and forward Tab would never reach its controls. Keyboard users pay the 4.4 KB. A screen reader in browse mode sends no Tab, and the empty plate gives it nothing to stop on, so it can pass the chart unless reading brings the slot near. No real screen reader was tested. The margin is 50 px and not 300 because a phone's slot starts 72 to 360 px below the first screen. `next/dynamic` took back only 598 bytes, because its runtime brings a chunk of its own. The server no longer renders the chart, so no-JS visitors get no chart, and neither does a print made before it loads. The empty plate is hidden in both cases, so neither gets a large blank box. A file that cannot load logs its error and leaves the calculator working, without a chart |
| The punch-clock line sits beside the sticker, and uses the butcher's price when there is one | The headline alone had nothing after its first reading, and this turns the time into a day. Beside the sticker it fills the card's empty half and adds no height for asado. It follows the same price as the headline, so the two never disagree. When a price takes longer than a workday the same slot reads `Eso es 1 día y 2 h de laburo.`, because a sticker alone beside an empty half read like a missing piece. It states the time and says nothing about the pay |
| The hours a month live in `memory.ts` as the last valid number, not as text | They are not private, but the planner reads them too, and half-typed text is only the input's business |

## Follow-ups

- On a phone the dotted kilos leader can cross the last month label for own months 202603 to 202607.
- On a phone the chart starts about 1,000 px down the page and nothing points to it.
- With `Tu sueldo` at x0,01 on a short range, the `x1,50` and `x1,25` axis labels touch. Absurd input only, and still legible.
- The client bundle has little room left: 161,994 bytes gzip for `/`, measured as this file describes, against 164,904 (the 134,904 baseline plus 30 KB). That leaves about 2.9 KB. The chart's own file, 4,423 bytes, is outside that count: see Decisions. `/asado` is 159,806 and `/juego` 161,269. The planner cost `/` 1,881 bytes without adding code it runs: sharing modules with a second route splits them into their own chunk, which compresses worse, and `memory.ts` brings in `worktime.ts`, which the hours view needs anyway.
- At 320 px wide, `/c/a/100/201909/202609` clips the past column of the shopping list. 320 is below the 360 px rule.
- At 1366x650, roughly what Chrome leaves on a 768 px laptop, with a pay remembered from `/`, the planner's `Compartir` sits at 664–716, below the fold, and the sticky card keeps it hidden until about 880 px of scroll. The tray is at its floor, so a real fix means restructuring the card.
- At 1280x720 with a pay, the planner's `Compartir` ends at 727, 7 px past the fold. 20 px of scroll shows it.
- With invalid text dimming the planner's work line, another key undims it until the next pause. `/` does the same.
- Getting to 100 people takes 94 taps from the default. The stepper has no hold-to-repeat and no typed value.
- On a phone at 390x844, a share page's card ends at 830 before typing, but after typing with touch `Compartir` sits at 856–908, off the screen. Accepted for now. On `/` in the hours view, `Compartir` ends at 842 for asado, carne picada and salame, and at about 862 to 883 for the other units, past the 844 screen.
- On a desktop window 900 px tall or more, the chart's file loads with no scroll, so those visitors gain nothing from the split and pay about 0.8 KB more.
- At 320 px wide the three tabs wrap to two rows instead of scrolling the page. At 360 px they fit one row.
- `/favicon.ico` answers 404, because the app only declares `icon.svg`. Chrome occasionally asks for it anyway and logs a console error. Seen locally after a cold server start, cause not pinned down.
- 10 of 22 products have one fixed answer across all seeds at 202609 (`queso`, `yerba` and `vino` are always `menos`), so a replay can be memorised and `Otra partida` repeats about 5 products. The generator stays as it is: prefer mixed-answer products if replays get stale.
- A slow third or fourth tap on `Ver el resultado` can still wipe the score where `Otra partida` lands under it: three taps 800 ms apart, or four 600 ms apart, on a friend's link at 390x844. That tap comes 1.5 s after the first and cannot be told apart from a real one.
- On short phones the answer buttons move about 15 px between rounds, since the card's height follows that round's reveal.
- On a friend's link at 375x553 and 360x560, `Siguiente` covers the reveal's source line until a scroll.
- The game's `aria-live` verdict and the focus moves were checked in the DOM, not with a real screen reader.
- Preset cards: share is typed pay only.
- An override is forgotten when switching units and back. The headline loses its label, so it is honest but mildly annoying.
- Real phones, Web Share sheets, real screen readers, Safari and Firefox were never tested.
- The early-request guard is a text check and cannot catch `new Image()` or `sendBeacon`, or automatic invocation through effects in forms other than a direct `useEffect(tap`, such as an alias or `useLayoutEffect(tap)`.
- The INDEC key expires about 2027-05-01 and nothing alerts: the page keeps serving old data with its month visible.
- The month floor `202609` in validation stops large regressions, not a one-month step back.
