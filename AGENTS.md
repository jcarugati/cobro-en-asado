# Cobro en Asado — agent instructions

Purpose: Tu sueldo, en la unidad que entendemos todos: kilos de asado. — see docs/DESIGN.md (the agreed design; source of truth for scope).

## Constraints (MUST NOT)
- MUST NOT commit, log, or ship to the browser the INDEC API key. Locally use `with-indec <cmd>` (exposes $INDEC_API_KEY to the child). On Vercel it is the env var INDEC_API_KEY (sensitive, server-only).
- MUST NOT use paid services, paid plans, or runtime LLM API calls. Free tiers only (Vercel Hobby).
- MUST NOT write code outside TypeScript. All logic/data code uses Effect TS v4 following https://effect.website/docs/v4/code-style/guidelines (runMain-style entry points where applicable; no tacit/point-free calls like `Effect.map(fn)` or `flow`; write `Effect.map((x) => fn(x))`).

## Conventions
- UI copy in Spanish (Argentina); code, comments, docs in English.
- Minimalist, simple UI. One PR per task; main is deployed by Vercel Git integration.
- Vercel CLI/API: use `with-vercel <cmd>` (exposes $VERCEL_TOKEN). Team: testingstudios-4007s-projects (team_4hAit7X9yHNvtMPrMA0ezMqQ). Project: cobro-en-asado.

## Status
Design agreed; implementation in progress.
