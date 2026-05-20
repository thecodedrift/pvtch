## Context

The Lingo translate route at `workers/core/app/routes/lingo.translate.$token.tsx` currently funnels every surviving chat message into a Cloudflare Workers AI call against Qwen 3 30B. The only pre-AI filters are: known-bot username list, leading `!` command check, single-word ≤6-character check, an "imtyping" substring check, and the user's configured bot ignore list. The route's decision about whether a translation was needed (`isSameLanguage`, similarity scoring) all happens _after_ the LLM has produced a response, meaning every message that reaches the route pays the full AI cost regardless of whether the result is used.

The translator's existing post-LLM logic in `workers/core/app/lib/translator.ts` already encodes useful priors: a `NON_LATIN_SCRIPT_LANGUAGES` set and an `isLatinOnly` Unicode-script test, both used as a hack against misdetections by the LLM. That logic is the seed of a real script-based detection layer.

The user wants to reduce AI calls by moving language detection out of the LLM and into the Worker itself, using a small ensemble of local classifiers, and they accept the trade-off that ambiguous cases will be silently skipped rather than risk a bad translation.

## Goals / Non-Goals

**Goals:**

- Eliminate the LLM round-trip for messages that local detection can confidently classify as already-in-target-language.
- Eliminate the LLM round-trip for messages that, after stripping Twitch chat noise, carry no meaningful language signal.
- Keep the LLM round-trip for messages where any reliable signal suggests the text is in a non-target language, even if other signals disagree.
- Produce decision logs detailed enough that calibration can be driven by user-reported translation bug reports plus the existing corpus.
- Preserve the current API surface of `/lingo/translate/:token` (GET and POST) and the current empty-200 "skip" semantics.

**Non-Goals:**

- Adding usage quotas, rate limits, or billing telemetry. That work is deferred.
- Changing the LLM model, prompt, or response schema.
- Reworking the User DO storage layout, the Lingo config schema, or the dashboard.
- Building a real-time observability dashboard. Initial diagnostics are structured logs.
- Replacing `isSameLanguage` / post-LLM NOOP detection — those remain as a final safety net.
- Per-channel state. The token-as-identity model stays as-is.

## Decisions

### Decision: Run the classifiers we can actually load in Workers

Research during implementation surfaced two compatibility problems with the originally proposed lineup:

- **CLD3** (`cld3-asm` and friends) is Emscripten-built and throws `environment detection error` inside the Cloudflare Workers runtime because the Emscripten loader probes for `importScripts`. No maintained Workers-compatible CLD3 fork exists.
- **fastText** (`fasttext.wasm.js`) is the same Emscripten lineage. Its loader uses `locateFile` + `fetch(modelHref)` against URL paths that assume browser/Node origins, and the underlying Emscripten runtime has the same `importScripts` probes. Wiring it cleanly inside a Worker is a non-trivial side-quest (custom `locateFile`, fetch interception via `env.ASSETS`, possibly patching Emscripten env probes).

The shipped ensemble is therefore both pure JS:

1. **`tinyld`** — pure JS, already in `workers/core/package.json`. ISO 639-3 codes with confidence scores.
2. **`franc-min`** — pure JS, n-gram-based, independent codebase and training data from tinyld. Returns ISO 639-3 codes; confidence is derived from the gap between the top candidate and its runners-up.

CLD3 and fastText are tracked as follow-up enhancements. The classifier registry is open-ended, so adding a third or fourth voice later is a single-file change. The decision rule is unchanged.

**Rationale**: Two independent pure-JS classifiers with different training data and algorithmic approaches give the ensemble real signal divergence on hard cases (short Latin chat text), without taking on WASM-in-Workers integration risk in this change. The K=1 translate / K=2 skip rule still functions exactly as designed: K=1 means a single confident non-target vote earns an LLM call, K=2 means both classifiers must agree on "already target" to skip. Anything else falls through to skip-ambiguous, consistent with the "rather skip than bad-translate" stance.

**Alternatives considered**: (a) Wire fastText as a best-effort WASM stub that always abstains — adds dead-code surface area for a wrapper we cannot validate in this session. Rejected. (b) Ship with tinyld only — loses the ensemble's signal divergence and makes K=2 unsatisfiable (only one voice can ever vote target). Rejected. (c) Block this change on validating fastText in Workers — defeats the goal of landing the cost win soon.

### Decision: K=1 to translate, K=2 to skip-as-target, otherwise skip-ambiguous

After the classifiers run, the rule for the cleaned, script-ambiguous case is:

- If **any** classifier produces `{lang ≠ target, conf > τ_translate}`: **TRANSLATE**.
- Else if **two or more** classifiers produce `{lang == target, conf > τ_skip}` and **no** classifier produces `{lang ≠ target, conf > τ_translate}`: **SKIP (already target)**.
- Else: **SKIP (ambiguous)**.

**Rationale**: This directly implements the user's stated preference. A confident "foreign" vote, even from a single classifier, earns the LLM call — the LLM is then the tiebreaker. Declaring something to already be the target language requires corroboration. Anything else is treated as too risky to translate.

**Alternatives considered**: (a) Majority vote in both directions — symmetric and elegant but contradicts the "any strong foreign vote should buy an LLM call" intent. (b) Always defer to the LLM when there's any disagreement — preserves coverage but discards much of the cost win. (c) Unanimous required for either direction — too conservative; would skip too many legitimately translatable messages.

### Decision: Script gate runs before classifiers and can short-circuit to TRANSLATE

After preprocessing, the cleaned input's Unicode scripts are computed. If the script set is disjoint from the scripts the target language is normally written in, the pipeline emits TRANSLATE immediately without running classifiers.

**Rationale**: This is the highest-precision, lowest-cost rule available. If the target is English and the input is Hangul-only, no classifier needs to weigh in — it cannot be the target language. The current `NON_LATIN_SCRIPT_LANGUAGES` set in `translator.ts` is half of this rule already. A small target-language → expected-scripts map lifts it into a real gate.

**Alternatives considered**: Running the script gate as just another voting classifier with very high confidence. Cleaner architecturally, but loses the cost win of short-circuiting before the WASM/JS detectors run.

### Decision: Gibberish gate is length-after-cleaning, threshold 16

After preprocessing (URL strip already present; new @username and Twitch-emote stripping), if the remaining length is below 16 characters, the pipeline emits SKIP (gibberish) without running classifiers.

**Rationale**: Twitch chat is dominated by emote spam, mentions, and short reactions. 16 characters is a heuristic threshold the user picked as the average cutoff after stripping. It is also a calibration knob — easy to move once we have data. The existing "single word ≤6 chars" rule becomes a strict subset of this and is retired.

**Alternatives considered**: Length-based weighting fed into the classifier ensemble. Considered but harder to reason about; the explicit cutoff is easier to tune.

### Decision: Twitch-emote stripping uses a regex heuristic, not a curated list

Twitch-shaped emote tokens are stripped using a token-level pattern matching PascalCase / CamelCase alphanumeric runs (e.g., `^[A-Z][A-Za-z0-9]{2,24}$`). This runs on space-separated tokens after URL stripping and before length measurement.

**Rationale**: A curated emote list would have to track global Twitch emotes, BTTV, FFZ, channel-specific emotes, and 7TV — impractical and immediately stale. The PascalCase heuristic catches the dominant shape (PogChamp, LULW, KEKW, Kappa) cheaply. False positives (real PascalCase words in chat) are rare and only cost a stripped token in the _length_ check; they do not affect what the classifier or LLM sees in non-skipped paths, because the cleaned input is only used for detection, not as the LLM payload.

**Alternatives considered**: A maintained list of top-N global emotes. Rejected — maintenance burden outweighs accuracy gain at this layer. Can be added later if the heuristic misfires too often.

### Decision: No binary asset bundling in this change

Because both initial classifiers are pure JS with no model files, the change ships no `.wasm` and no model binaries. The Cloudflare Static Assets binding remains the planned channel when WASM-based classifiers (fastText, CLD3) are added in a follow-up — assets do not count against the script size limit and `env.ASSETS.fetch()` is the right loader for cold-start model bytes — but that infrastructure is out of scope here.

### Decision: Classifiers initialize once at module scope, lazily on first use

The WASM modules and language model are loaded once per isolate, behind a module-level promise so concurrent first-requests share the same initialization.

**Rationale**: Worker isolates are reused across requests. Re-initializing per request would defeat the cost win. Lazy initialization (rather than top-level await) keeps script startup fast and confines the warmup cost to the first translate call in a fresh isolate.

### Decision: `isSameLanguage` stays as a post-LLM safety net

The existing `isSameLanguage` and "translation equals input" checks in `translator.ts` remain in place after the LLM call. If they fire, the route still returns the empty 200.

**Rationale**: Local detection will miss things the LLM catches (the LLM has full reasoning over the input). Keeping the post-LLM check is cheap and protects against detector misses leaking a no-op translation through. The user explicitly endorsed this.

### Decision: Observability is structured `log.debug` / `log.info` lines, no metrics counters yet

Each translate request logs a single structured object with: original input, cleaned input, cleaned length, detected scripts, per-classifier `{lang, conf}`, decision (`TRANSLATE` / `SKIP_GIBBERISH` / `SKIP_TARGET` / `SKIP_AMBIGUOUS`), and the script-disjoint short-circuit flag if it fired.

**Rationale**: The user prefers asking reporters for the exact text they sent and what they expected over building dashboards. Structured logs queried via Cloudflare's log endpoints are sufficient for that workflow. Counters can be added later if the bug-report-driven loop proves insufficient.

## Risks / Trade-offs

- **Silent under-translation on ambiguous text** → Mitigation: every SKIP_AMBIGUOUS decision is logged with full classifier votes, so when a user reports "you didn't translate X," we have the data to retune τ or K, and the corpus grows by one fixture.
- **Threshold τ chosen without phase-0 shadow data** → Mitigation: pick conservative starting values (τ_translate around 0.65, τ_skip around 0.85), document them as the initial guess, treat the first weeks of bug reports as the calibration loop.
- **Cold-start latency on a fresh isolate** → Mitigation: classifier init is lazy and shared; only the first request in a new isolate pays it. Workers AI calls also have non-trivial cold paths, so the relative impact is small. Worst case is one slow first call per region per deploy.
- **PascalCase emote heuristic over-strips real words** → Mitigation: the stripping only affects the _length gate_ and classifier input, not the message sent to the LLM, so the worst case is a borderline-length message getting skipped as gibberish. Surfaced by the same bug-report loop.
- **Bundle size increase (~2 MB)** → Accepted by the user. Vite tree-shaking still applies to the rest of the bundle; the increment is the binary assets.
- **CLD3 / fasttext JS wrappers may not be Workers-runtime clean** → Mitigation: verify during implementation that each wrapper avoids Node-only APIs (`fs`, `path`, `Buffer` without polyfill). If a wrapper is incompatible, fall back to two-classifier ensemble (script gate + fasttext + JS detector) without changing the decision rule shape.
- **Asymmetric decision rule is harder to reason about than majority vote** → Mitigation: the rule lives in a single pure function, fully unit-tested with table-driven cases derived from the corpus.

## Migration Plan

Single-step deploy; no data migration required.

1. Land the detector module and tests behind no flag.
2. Wire the detector into the translate route. The route's externally observable behavior changes immediately on deploy: some requests that used to call the LLM now skip; some that used to translate now skip as ambiguous.
3. Monitor logs for the first 24–48 hours for the four decision buckets and any wrapper-init errors.
4. Tune τ and K via subsequent small changes as bug reports arrive.

Rollback is a code revert. There is no persisted state from the detector.

## Open Questions

- Initial τ values. Best resolved by running the existing corpus through each classifier as a one-off during implementation and inspecting confidence distributions; final values land in the tasks step.
- Final third-classifier choice between `franc-min` and `eld`. Resolved by checking Workers-runtime compatibility during the wrapper-import task; either works for the decision rule.
- Whether the cleaned-length gate should consider grapheme count (via `Intl.Segmenter`, already used elsewhere in this codebase) instead of UTF-16 code units, to handle multi-codepoint emoji and CJK consistently. Default to grapheme count for parity with existing normalization code.
