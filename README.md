# Cobro en Asado

Tu sueldo, en la unidad que entendemos todos: kilos de asado.

Live: https://cobro-en-asado.vercel.app

Type your monthly pay and see it in kilos of asado or 21 other INDEC-priced products, and compare it with an older pay. Design: docs/DESIGN.md. Plan and follow-ups: docs/PLAN.md. API catalog: docs/API-CATALOG.md.

## Data

- Prices, IPC and baskets come from the official INDEC API (https://api.indec.gob.ar), called server-side only. The key never reaches the browser.
- Every response is validated into one snapshot before use.
- Pages use daily ISR, and all of them read the snapshot through one shared `unstable_cache` entry, so a new share URL does not call INDEC.
- When a refresh fails, the last good data keeps being served, with its month visible.
- Page and data caches stack, so a new INDEC release can take up to about 48 h to appear.

## Privacy

All the math runs in the browser, and the pay is never sent anywhere. Share links and cards hold counts only, never pesos, and nothing requests them until the visitor taps `Compartir`.

## Local development

```sh
npm ci
with-indec npm run dev
```

`with-indec` exposes `INDEC_API_KEY` to the command. On Vercel it is a sensitive, server-only env var.

Every PR passes this gate:

```sh
npm run typecheck && npm test && with-indec npm run build
```

## Key expiry

The INDEC key expires around 2027-05-01 and nothing alerts. After that the page keeps serving old data with its month visible, until the key is renewed.
