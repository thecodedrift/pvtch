## ADDED Requirements

### Requirement: Pre-LLM detection preprocessing

The system SHALL produce a "cleaned input" for the language detection pipeline by, in order: (1) stripping URLs, (2) stripping `@username` tokens that match the Twitch username pattern, (3) stripping Twitch-emote-shaped tokens that match a PascalCase/CamelCase alphanumeric pattern (leading uppercase letter followed by 2–24 alphanumeric characters), (4) trimming and collapsing whitespace. The cleaned input SHALL be used only for detection (length gate, script gate, classifier inputs); the original message SHALL remain the payload sent to the LLM when an LLM call occurs.

#### Scenario: Cleaned input drops URLs, mentions, and emotes

- **WHEN** the input is `@bob check https://twitch.tv PogChamp hola amigo`
- **THEN** the cleaned input used for detection is approximately `hola amigo`

#### Scenario: Original input is preserved for the LLM

- **WHEN** detection passes through to a TRANSLATE decision
- **THEN** the original (un-cleaned) input is the message passed to `translate()`

### Requirement: Gibberish length gate

The system SHALL emit a SKIP (no LLM call, empty 200 response) when the cleaned input length, measured in user-perceived characters (graphemes via `Intl.Segmenter`), is below 16.

#### Scenario: Cleaned input is too short

- **WHEN** the cleaned input is `lol nice`
- **THEN** the system returns an empty response without calling the LLM, logged with reason `skip_gibberish`

#### Scenario: Cleaned input meets the threshold

- **WHEN** the cleaned input contains 16 or more graphemes
- **THEN** the system proceeds to the script gate

### Requirement: Script-disjoint short-circuit

The system SHALL maintain a mapping from each supported target language to the set of Unicode scripts it is normally written in. When the cleaned input contains no characters in any of the target language's scripts (i.e., the input's script set is disjoint from the target's expected scripts), the system SHALL emit a TRANSLATE decision and proceed to the LLM call without running classifiers.

#### Scenario: Hangul input with English target

- **WHEN** the cleaned input is `안녕하세요 친구야` and the configured target language is English
- **THEN** the system proceeds directly to the LLM call, logged with reason `translate_script_disjoint`

#### Scenario: Mixed-script input is not short-circuited

- **WHEN** the cleaned input contains at least one character in a script used by the target language
- **THEN** the system proceeds to the classifier ensemble rather than short-circuiting

### Requirement: Classifier ensemble

The system SHALL run a registry of local language classifiers in parallel on the cleaned input on every request that reaches this stage. The initial registry SHALL contain at least two independent classifiers: (1) `tinyld` (pure-JS), and (2) `franc-min` (pure-JS, independent codebase and training data). Each classifier SHALL produce either a `{ lang, confidence }` result on a normalized 0–1 confidence scale, or `null` (abstention) when detection fails. Adding further classifiers (e.g., a future WASM-based fastText or CLD3) SHALL be a one-file change to the registry; the decision rule SHALL remain unchanged.

#### Scenario: First request in a fresh isolate initializes the classifiers

- **WHEN** the first translate request after a cold start reaches the classifier stage
- **THEN** the WASM modules and language model are loaded once and reused for subsequent requests in the same isolate

#### Scenario: All registered classifiers are consulted

- **WHEN** a cleaned input reaches the classifier stage
- **THEN** every classifier in the registry runs on the same input and their results (including any `null` abstentions) are collected before the decision rule is evaluated

#### Scenario: Classifier abstention does not break the pipeline

- **WHEN** a classifier's WASM init or detection call throws (e.g., a Workers-incompatible WASM wrapper)
- **THEN** the wrapper catches the error and returns `null` for that classifier; the decision rule continues with the remaining classifier results

### Requirement: Asymmetric ensemble decision rule

Given the classifier results and configured thresholds `τ_translate` and `τ_skip`, the system SHALL choose between TRANSLATE, SKIP_TARGET, and SKIP_AMBIGUOUS using the following ordered rule: (1) if any classifier reports a non-target language with confidence above `τ_translate`, decide TRANSLATE; (2) otherwise, if two or more classifiers report the target language with confidence above `τ_skip`, decide SKIP_TARGET; (3) otherwise, decide SKIP_AMBIGUOUS. SKIP_TARGET and SKIP_AMBIGUOUS SHALL both result in an empty 200 response with no LLM call.

#### Scenario: Single confident non-target vote wins

- **WHEN** classifier results are `[{lang: spa, conf: 0.92}, {lang: eng, conf: 0.41}, {lang: eng, conf: 0.55}]` and target is English
- **THEN** the decision is TRANSLATE

#### Scenario: Two confident target votes with no non-target dissent

- **WHEN** classifier results all report `lang == target` with confidences `[0.88, 0.91, 0.62]`, τ_skip=0.85, and no non-target vote exceeds τ_translate
- **THEN** the decision is SKIP_TARGET

#### Scenario: Ambiguous result is skipped

- **WHEN** classifier results show low confidence on all classifiers, none exceeding either threshold
- **THEN** the decision is SKIP_AMBIGUOUS and the system returns an empty 200 without calling the LLM

#### Scenario: Conflicting confident votes still trigger an LLM call

- **WHEN** one classifier reports `{lang: por, conf: 0.91}` and another reports `{lang: eng, conf: 0.93}` with target English
- **THEN** the decision is TRANSLATE (the confident non-target vote earns the LLM call)

### Requirement: Detection decision logging

On every translate request that reaches the detection pipeline, the system SHALL emit a single structured log entry containing: the original input, the cleaned input, the cleaned length in graphemes, the set of detected scripts, each classifier's `{ lang, confidence }` result (when the stage was reached), the final decision (`TRANSLATE`, `SKIP_GIBBERISH`, `SKIP_SCRIPT_DISJOINT`, `SKIP_TARGET`, `SKIP_AMBIGUOUS`), and the redaction-aware request identifier already used by the route logger.

#### Scenario: Skip decision is fully recorded

- **WHEN** a request results in SKIP_AMBIGUOUS
- **THEN** the log entry includes the cleaned input and the classifier votes that produced the ambiguous outcome, sufficient for later τ/K retuning from bug reports

#### Scenario: Translate decision is recorded

- **WHEN** a request results in TRANSLATE
- **THEN** the log entry records the path taken (script-disjoint vs classifier-driven) and the classifier votes (when classifiers ran)

## REMOVED Requirements

### Requirement: Short message filtering

**Reason**: Superseded by the new `Gibberish length gate`, which measures length on the cleaned input (after URL, @username, and Twitch-emote stripping) and uses a 16-grapheme threshold. Every message that would have been skipped by the old rule (single-word, ≤6 characters) is also skipped by the new gate, since the cleaned length cannot exceed the original length.
**Migration**: No external migration required. The translate route returns the same empty 200 response for short messages; the only observable change is that additional short-but-multi-word inputs (e.g., `lol nice`) are now also skipped.
