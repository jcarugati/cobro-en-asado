# Cobro en Asado

Tu sueldo, en la unidad que entendemos todos: kilos de asado.

Live: https://cobro-en-asado.vercel.app

Type your monthly pay and see it in kilos of asado or 21 other INDEC-priced products, switch to “Horas de laburo”, compare it with an older pay, and see in a chart whether wages beat its price. “Armá tu asado” prices a shopping list for your group, and “¿Más o menos?” tests your price intuition against GBA inflation in ten rounds. Design: docs/DESIGN.md. Plan and follow-ups: docs/PLAN.md. API catalog: docs/API-CATALOG.md.

## Data

- Prices, IPC and baskets come from the official INDEC API (https://api.indec.gob.ar), called server-side only. The key never reaches the browser.
- The national INDEC wage index supplies four chart reference series, with its own last available month.
- Every response is validated into one snapshot before use.
- Pages use daily ISR, and all of them, plus the planner's card route, read the snapshot through one shared `unstable_cache` entry, so a new share URL reuses cached data.
- When a refresh fails, the last good data keeps being served, with its month visible.
- Page and data caches stack, so a new INDEC release can take up to about 48 h to appear.

## Privacy

All pay math runs in the browser, and the pay is never sent anywhere. It lives in memory only: moving between tabs keeps it, and a reload forgets it. The only persistent browser storage is the game's best streak, in `localStorage`.

Pay-result links and cards hold product counts, units and months, never pay in pesos. The planner's link holds only a people count and two months; its card computes shopping totals in pesos from the cached snapshot. The game's link holds a score out of ten, a seed and a month, so a friend plays the same questions. Work time never reaches a link or card. No share link or card is requested until the visitor taps `Compartir`.

## Local development

Needs Node 26. Dev and build need a key from https://api.indec.gob.ar; tests do not.

```sh
npm ci
INDEC_API_KEY=<your key> npm run dev
```

On Vercel the key is a sensitive, server-only env var. The owner's `with-indec` wrapper does the same as setting it by hand.

Every PR passes this gate:

```sh
npm run typecheck && npm test && INDEC_API_KEY=<your key> npm run build
```

## Key expiry

The INDEC key expires around 2027-05-01 and nothing alerts. After that the page keeps serving old data with its month visible, until the key is renewed.
