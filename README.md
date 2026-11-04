# Cobro en Asado

Tu sueldo, en la unidad que entendemos todos: kilos de asado.

Live: https://cobro-en-asado.vercel.app

Type your monthly pay and see it in kilos of asado or 21 other INDEC-priced products, compare it with an older pay, and see in a chart whether wages beat its price. Design: docs/DESIGN.md. Plan and follow-ups: docs/PLAN.md. API catalog: docs/API-CATALOG.md.

## Data

- Prices, IPC and baskets come from the official INDEC API (https://api.indec.gob.ar), called server-side only. The key never reaches the browser.
- The national INDEC wage index supplies four chart reference series, with its own last available month.
- Every response is validated into one snapshot before use.
- Pages use daily ISR, and all of them read the snapshot through one shared `unstable_cache` entry, so a new share URL does not call INDEC.
- When a refresh fails, the last good data keeps being served, with its month visible.
- Page and data caches stack, so a new INDEC release can take up to about 48 h to appear.

## Privacy

All the math runs in the browser, and the pay is never sent anywhere. Share links and cards hold counts only, never pesos, and nothing requests them until the visitor taps `Compartir`.

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
