## 1. Dependencies

- [x] 1.1 Confirm `tinyld` is already in `workers/core/package.json`; add `franc-min`. fastText and CLD3 are deferred — research showed both require Emscripten loader patterns incompatible with the Workers runtime; they are tracked as follow-up changes.
- [x] 1.2 (deferred) Model binary bundling via the Cloudflare Static Assets binding — no binary assets in this change since both initial classifiers are pure JS.
- [x] 1.3 (deferred) Worker `assets` binding configuration — added when the first WASM classifier lands.
- [x] 1.4 Run `pnpm typecheck` after the dependency change to confirm types still resolve

## 2. Detection module scaffolding

- [x] 2.1 Create `workers/core/app/lib/lang-detect/` directory (no barrel; consumers import each module directly)
- [x] 2.2 Add a target-language → expected-Unicode-scripts map at `lang-detect/script-map.ts`, seeded from the existing `NON_LATIN_SCRIPT_LANGUAGES` set in `translator.ts` plus the rest of `app/lib/constants/languages.ts`
- [x] 2.3 Add `lang-detect/preprocess.ts` implementing URL stripping, @username stripping (Twitch username regex), Twitch-emote-shaped token stripping (all-caps ≥3 OR internal-capital transition — tightened from spec's `^[A-Z][A-Za-z0-9]{2,24}$` because that over-strips normal sentence-initial words like "Hello"), whitespace collapse
- [x] 2.4 Add `lang-detect/script.ts` exposing `detectScripts(input): Set<string>` and `isScriptDisjoint(scripts, target)`
- [x] 2.5 Add `graphemeLength` helper using `Intl.Segmenter` for the gibberish gate
- [x] 2.6 (deferred) Lazy isolate-shared init pattern for WASM classifiers — not needed in this change since both initial classifiers are pure JS.

## 3. Classifier wrappers

- [x] 3.1 Implement `lang-detect/classifiers/tinyld.ts` using the existing `tinyld` package; exposes `detect(input): ClassifierResult`
- [x] 3.2 Implement `lang-detect/classifiers/franc.ts` using `franc-min`; same signature. Confidence is derived as `gap * GAP_SCALE` (where `gap = top.score − second.score`) — empirically calibrated so clean prose lands above τ_skip; without the scale franc's structurally small gaps would prevent SKIP_TARGET from ever firing.
- [x] 3.3 (deferred) WASM-based classifier wrappers (fastText, CLD3) — see decision note in `design.md`.
- [x] 3.4 Normalize each classifier's language output via `normalizeLanguage()` so comparisons against the configured target work uniformly.
- [x] 3.5 Wrap each classifier call in defensive try/catch returning `undefined` on failure; ensemble logic treats `undefined` as abstention

## 4. Decision rule

- [x] 4.1 Define `DecisionResult` (action: `TRANSLATE` / `SKIP_GIBBERISH` / `SKIP_TARGET` / `SKIP_AMBIGUOUS`) at `lang-detect/decision.ts`. Note: there is no separate `SKIP_SCRIPT_DISJOINT` action — script-disjoint maps to `TRANSLATE` because the input cannot be in the target language, with the reason recorded in the `reason` field.
- [x] 4.2 Implement `decide(input, target, classifiers?)`: preprocess → length gate → script gate → run classifiers in parallel → apply K=1 translate / K=2 skip-target rule. Classifiers are injectable for tests; the default is `[tinyldClassifier, francClassifier]`.
- [x] 4.3 Threshold defaults in `lang-detect/thresholds.ts`: `GIBBERISH_LENGTH = 16`, `TAU_TRANSLATE = 0.65`, `TAU_SKIP = 0.85`.
- [x] 4.4 `decide()` returns cleaned input, length, scripts, and per-classifier votes alongside the action.

## 5. Translate route integration

- [x] 5.1 In `workers/core/app/routes/lingo.translate.$token.tsx`, inserted a `decide()` call after the user-config bot filter and before the existing `translate()` call
- [x] 5.2 On any non-`TRANSLATE` decision the route returns an empty 200 immediately
- [x] 5.3 On `TRANSLATE`, the existing LLM call path is preserved; `isSameLanguage`, username-only suppression, and the NOOP safety net are unchanged
- [x] 5.4 Retired the existing "single-word, ≤6 char" short-message gate; bot list, command (`!`), and `imtyping` gates kept as-is

## 6. Diagnostic logging

- [x] 6.1 Route emits a single structured log entry per request containing action, reason, cleaned input, cleaned grapheme length, detected scripts, and per-classifier votes
- [x] 6.2 Skip decisions log at `debug`; the TRANSLATE decision logs at `info` so production logs stay readable
- [x] 6.3 Existing per-request token redaction applies — the detection log does not introduce any new identifier types

## 7. Tests

- [x] 7.1 Unit-tested `preprocess.ts`: URL, mention, emote (PascalCase + all-caps), mixed, empty-after-cleaning, whitespace collapse, sentence-initial capitalized words preserved, plus `graphemeLength` for ASCII / multi-codepoint emoji / CJK / empty (`test/lang-detect/preprocess.test.ts`)
- [x] 7.2 Unit-tested `script.ts` for Latin / Hangul / Cyrillic / Japanese (Hiragana+Han) / mixed / empty plus `isScriptDisjoint` against multiple targets (`test/lang-detect/script.test.ts`)
- [x] 7.3 Unit-tested `decide()` with mocked classifier outputs covering all paths: K=1 translate, K=2 skip-target, conflicting confident votes (translate wins), all low-confidence (ambiguous), abstention via `undefined`, gibberish gate, script-disjoint short-circuit (`test/lang-detect/decision.test.ts`)
- [x] 7.4 Corpus snapshot test runs the existing e2e lingo fixtures (plus pure-Korean / pure-Russian / pure-Japanese for script-disjoint coverage) through `decide()` and pins the expected action per case (`test/lang-detect/corpus.test.ts`)
- [x] 7.5 Live-classifier smoke tests for tinyld + franc-min on English/Spanish input to catch package-API breakage (`test/lang-detect/classifiers.test.ts`)

## 8. Verification

- [x] 8.1 `pnpm typecheck` and `pnpm lint` pass clean
- [x] 8.2 `pnpm --filter @pvtch/core test:unit` — 104 tests pass; `pnpm --filter @pvtch/core test:e2e` — 36 tests pass (including all 11 lingo translation fixtures)
- [ ] 8.3 Manual route smoke against deployed `/lingo/translate/:token` with curated inputs — deferred to user verification post-merge (the e2e suite exercises the full translate path; manual log inspection covers the decision-path observability surface)
- [x] 8.4 Worker server bundle is ~3.3 MB after build, well under the 10 MB Workers script size limit

## 9. Archive readiness

- [ ] 9.1 Once verified in production logs over the first 24–48 hours, capture observed initial-τ behavior (false skips, missed translates) into a follow-up note for calibration
- [ ] 9.2 Run `pnpm openspec status --change local-language-detection` and confirm completion before archiving via `/opsx:archive`
