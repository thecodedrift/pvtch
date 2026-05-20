## Why

The Lingo translator currently calls Cloudflare AI (`@cf/qwen/qwen3-30b-a3b-fp8`) on every chat message that survives a small set of cheap heuristics, and only decides whether the result was worth keeping _after_ the call returns. The LLM round-trip is the dominant cost and latency of the translate pipeline, and a large share of those calls are predictable no-ops — text already in the target language, very short content, or stream-chat ephemera (emote spam, reactions, mentions). A local detection layer in front of the LLM can eliminate the majority of unnecessary calls and, because the project prefers "no translation over a bad translation," can also suppress ambiguous cases the LLM might mistranslate.

## What Changes

- Add a **pre-LLM detection pipeline** to the translate route that runs entirely inside the Worker, before any AI call. Pipeline stages: preprocess (strip @usernames and Twitch-emote-shaped tokens), gibberish length gate, script-mismatch gate, classifier ensemble.
- Bundle three local language classifiers and load them at module scope: **fasttext (`lid.176.ftz`)** via WASM, **CLD3** via WASM, and a **pure-JS detector** (franc or eld) as the third voice. All three run in parallel on the cleaned input.
- Adopt an **asymmetric decision rule**: K=1 to translate (any single classifier confidently identifying a non-target language earns an LLM call), K=2 to declare "already target" (skip without LLM), everything else falls through to skip-ambiguous.
- Add a script-disjoint short-circuit: if the cleaned input uses no script that the target language is written in, translate immediately without running classifiers.
- Add a cleaned-length gibberish gate (skip when length < 16 after username/emote stripping).
- Keep the existing post-LLM `isSameLanguage` / NOOP detection as a safety net for cases the ensemble lets through.
- Emit per-decision diagnostic logs (input, cleaned input, script verdict, per-classifier `{lang, conf}`, final action) so calibration can be driven by user-reported cases against the existing corpus.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `lingo`: introduces a new pre-LLM language detection stage in the translate flow, adds a cleaned-length gibberish gate, removes the existing "single-word, ≤6 char" short-message gate in favor of the new length-after-cleaning rule, and reframes the post-LLM NOOP detection as a safety net rather than the primary skip mechanism.

## Impact

- **Code**: `workers/core/app/lib/translator.ts` (new detector module integrated; `isSameLanguage` retained), `workers/core/app/routes/lingo.translate.$token.tsx` (new pipeline stages inserted between config fetch and `translate()` call). New module(s) under `workers/core/app/lib/lang-detect/` for preprocessing, script analysis, classifier wrappers, and the decision function.
- **Build**: Vite configuration updated to bundle three binary assets — `fasttext.wasm` + `lid.176.ftz`, `cld3.wasm` — into the Worker. Bundle size grows by roughly 2 MB; acceptable on the paid Workers plan.
- **Dependencies**: New runtime dependencies for the fastText WASM wrapper, the CLD3 WASM wrapper, and the JS detector (franc-min or eld). No new infrastructure (no R2 fetch, no KV reads).
- **Behavior**: Fewer AI calls per request volume (expected 30–60% reduction depending on chat language mix); slightly higher per-request CPU (~3–5 ms warm); some currently-translated ambiguous messages will now be silently skipped — this is the explicit trade. No API surface change to the `/lingo/translate/:token` endpoint.
- **Observability**: New structured log lines from the translate route capturing the decision path; no new dashboards required for the initial ship.
