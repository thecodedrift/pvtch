# lingo Specification

## Purpose

AI-powered chat message translation with language detection, smart filtering, chatbot integration APIs, configuration management, and setup documentation.

## Requirements

### Requirement: Translation API endpoint

The system SHALL provide a translation endpoint at `/lingo/translate/:token` that accepts a chat message and username via GET (query params `message` and `user`) or POST (JSON body `{ message, user }`). The endpoint SHALL return the translated text prefixed with `ImTyping ` on success, or an empty response (HTTP 200) when no translation is needed or on error.

#### Scenario: Successful translation via GET

- **WHEN** a GET request is made to `/lingo/translate/:token?message=hola&user=viewer1` with a valid token and configured language
- **THEN** the system returns the translated text prefixed with `ImTyping `

#### Scenario: Successful translation via POST

- **WHEN** a POST request is made with JSON body `{ "message": "hola", "user": "viewer1" }`
- **THEN** the system returns the translated text prefixed with `ImTyping `

#### Scenario: No translation needed

- **WHEN** the message is already in the target language
- **THEN** the system returns an empty response with HTTP 200

#### Scenario: Error during translation

- **WHEN** the LLM call fails after all retries
- **THEN** the system returns an empty response with HTTP 200 (never exposes errors to chatbot)

### Requirement: Known bot filtering

The system SHALL maintain a curated list of 900+ known Twitch bot usernames. Messages from users in this list SHALL be silently skipped (empty response) before any processing occurs.

#### Scenario: Message from known bot

- **WHEN** a message is received from a username matching the known bots list (case-insensitive)
- **THEN** the system returns an empty response without calling the LLM

### Requirement: Command filtering

The system SHALL skip translation for messages that begin with `!` (chat commands).

#### Scenario: Chat command message

- **WHEN** a message starting with `!` is received (e.g., `!lurk`)
- **THEN** the system returns an empty response without processing

### Requirement: Pre-LLM detection preprocessing

The system SHALL produce a "cleaned input" for the language detection pipeline by, in order: (1) stripping URLs, (2) stripping `@username` tokens that match the Twitch username pattern, (3) stripping Twitch-emote-shaped tokens, where a token is treated as emote-shaped if it matches all-uppercase alphanumeric of 3+ characters (e.g. `LULW`, `KEKW`) OR contains an internal lowercase-to-uppercase transition (e.g. `PogChamp`, `monkaW`, `4Head`). Sentence-initial capitalized words like `Hello` are NOT stripped. (4) trimming and collapsing whitespace. (5) collapsing any run of 3 or more consecutive identical characters down to 2 (so `yeeesss` becomes `yeess`, `haiiiiii` becomes `haii`); natural language never has 3+ consecutive identical letters but stream chat reaction noise does, and these inputs would otherwise pass the length gate and get mis-classified by the ensemble. The cleaned input SHALL be used only for detection (length gate, script gate, classifier inputs); the original message SHALL remain the payload sent to the LLM when an LLM call occurs.

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
- **THEN** the system proceeds directly to the LLM call with action `TRANSLATE` and reason `script disjoint from target`

#### Scenario: Mixed-script input is not short-circuited

- **WHEN** the cleaned input contains at least one character in a script used by the target language
- **THEN** the system proceeds to the classifier ensemble rather than short-circuiting

### Requirement: Classifier ensemble

The system SHALL run a registry of local language classifiers in parallel on the cleaned input on every request that reaches this stage. Before running, classifiers SHALL be filtered to those whose vocabulary nominally includes the configured target language (`supports(target) === true`); a classifier that cannot identify the target would only ever cast "non-target" votes and would bias the ensemble. The initial registry SHALL contain at least two independent classifiers: (1) `tinyld/heavy` (pure-JS), and (2) `franc-min` (pure-JS, independent codebase and training data). Each classifier SHALL produce either a `{ lang, confidence }` result on a normalized 0–1 confidence scale, or `undefined` (abstention) when detection fails. If zero classifiers survive the target-filter (i.e., no classifier supports the configured target language), the system SHALL emit a TRANSLATE decision without running the ensemble, deferring entirely to the LLM. Adding further classifiers SHALL be a one-file change to the registry; the decision rule SHALL remain unchanged.

#### Scenario: Only target-supporting classifiers are consulted

- **WHEN** the configured target language is `english` and the registry contains classifiers whose vocabularies include `english`
- **THEN** every such classifier runs on the cleaned input and its `{ lang, confidence }` result (or `undefined`) is collected before the decision rule is evaluated

#### Scenario: Classifier abstention does not break the pipeline

- **WHEN** a classifier's detection call throws
- **THEN** the wrapper catches the error and returns `undefined` for that classifier; the decision rule continues with the remaining classifier results

#### Scenario: No classifier supports the target language

- **WHEN** the configured target language is in the supported list but no registered classifier has it in its vocabulary (e.g., `catalan`)
- **THEN** the system emits a TRANSLATE decision with reason `no classifier supports target` and proceeds to the LLM call

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

On every translate request that reaches the detection pipeline, the system SHALL emit a single structured log entry containing: the original input, the configured target language, the cleaned input, the cleaned length in graphemes, the set of detected scripts, each classifier's `{ lang, confidence }` result (when the stage was reached), the final decision (`TRANSLATE`, `SKIP_GIBBERISH`, `SKIP_TARGET`, or `SKIP_AMBIGUOUS`), and the redaction-aware request identifier already used by the route logger.

#### Scenario: Skip decision is fully recorded

- **WHEN** a request results in SKIP_AMBIGUOUS
- **THEN** the log entry includes the cleaned input and the classifier votes that produced the ambiguous outcome, sufficient for later τ/K retuning from bug reports

#### Scenario: Translate decision is recorded

- **WHEN** a request results in TRANSLATE
- **THEN** the log entry records the path taken (script-disjoint vs classifier-driven) and the classifier votes (when classifiers ran)

### Requirement: Message normalization

The system SHALL normalize incoming messages before translation by: (1) stripping URLs, (2) removing Twitch emotes using a CamelCase heuristic pattern while preserving @usernames via Intl.Segmenter word-walking.

#### Scenario: Message with URLs

- **WHEN** a message contains HTTP/HTTPS URLs
- **THEN** the URLs are removed before translation

#### Scenario: Message with Twitch emotes and usernames

- **WHEN** a message contains Twitch emotes (e.g., `thecod67Lol`) and @usernames
- **THEN** emotes are removed but @usernames are preserved in the translation

### Requirement: LLM-based translation

The system SHALL use Cloudflare AI (Qwen 3 30B model) with a structured prompt that produces a two-line response: detected language name on line 1, and translation or "NOOP" on line 2. The LLM call SHALL retry up to 3 times on failure using p-retry. The system SHALL strip `<think>` blocks from Qwen model responses.

#### Scenario: Successful LLM call

- **WHEN** the LLM returns a valid two-line response
- **THEN** the system parses the detected language and translation

#### Scenario: LLM returns NOOP

- **WHEN** the LLM determines the text is already in the target language and returns "NOOP"
- **THEN** the system treats this as no translation needed

#### Scenario: Transient LLM failure

- **WHEN** the first LLM call fails
- **THEN** the system retries up to 3 times before giving up

### Requirement: Multi-stage NOOP detection

The system SHALL suppress translation output through three independent checks: (1) the LLM explicitly returns "NOOP", (2) the detected language name matches the target language (case-insensitive), (3) word overlap similarity between input and output exceeds the threshold. Short messages (≤3 words) SHALL use a similarity threshold of 0.5; longer messages SHALL use 0.75.

#### Scenario: Model returns NOOP

- **WHEN** the LLM output contains "NOOP" (case-insensitive)
- **THEN** the result is marked as noop with reason `model_noop`

#### Scenario: Language match

- **WHEN** the detected language matches the configured target language
- **THEN** the result is marked as noop with reason `language_match`

#### Scenario: High similarity on short text

- **WHEN** a 2-word message produces a translation with ≥50% word overlap
- **THEN** the result is marked as noop with reason `similarity`

#### Scenario: High similarity on long text

- **WHEN** a 5-word message produces a translation with ≥75% word overlap
- **THEN** the result is marked as noop with reason `similarity`

### Requirement: NOOP safety net

The system SHALL never output text containing "NOOP" (case-insensitive) to the user. If the final translation text contains "NOOP", the system SHALL return an empty response. Additionally, translations that are empty after removing @usernames SHALL be suppressed.

#### Scenario: Escaped NOOP in output

- **WHEN** the final translation contains "NOOP" anywhere in the text
- **THEN** the system returns an empty response

#### Scenario: Username-only translation

- **WHEN** the translation result contains only @usernames after stripping
- **THEN** the system returns an empty response

### Requirement: Similarity scoring

The system SHALL provide a word overlap coefficient similarity function using Intl.Segmenter for word extraction. The coefficient is calculated as `|intersection| / min(|A|, |B|)` on case-insensitive word sets.

#### Scenario: Identical text

- **WHEN** two identical strings are compared with any threshold
- **THEN** the similarity function returns true

#### Scenario: Partially overlapping text

- **WHEN** two strings share some words
- **THEN** the similarity is calculated as the overlap coefficient and compared against the threshold

### Requirement: Lingo configuration

The system SHALL store per-user lingo configuration in a Durable Object with key `lingo-config`. The configuration SHALL contain `bots` (array of usernames to ignore, max 15) and `language` (target language string, max 60 characters). Configuration SHALL be validated against a Zod schema.

#### Scenario: Valid config save

- **WHEN** a valid configuration is submitted to `/lingo/config/:token/set`
- **THEN** it is stored in the Durable Object with 30-day TTL (PRESERVE_ON_FETCH)

#### Scenario: Invalid config

- **WHEN** an invalid configuration is submitted (fails Zod validation)
- **THEN** the system returns HTTP 400 with an error message

### Requirement: User-configured bot filtering

The system SHALL skip translation for messages from usernames in the user's configured bots list (case-insensitive comparison). This check occurs after token validation and config retrieval.

#### Scenario: Message from user-ignored bot

- **WHEN** a message is received from a username in the user's configured bots list
- **THEN** the system returns an empty response

### Requirement: Lingo dashboard

The system SHALL provide a dashboard page at `/helpers/lingo` where authenticated users can configure their target language and ignored bots list. The dashboard SHALL display the translate API URL (password-masked) with a copy button, and SHALL include setup guides with screenshots for Firebot, MixItUp, and placeholder tabs for Streamer.bot and custom integrations.

#### Scenario: Authenticated user configures lingo

- **WHEN** an authenticated user visits `/helpers/lingo`
- **THEN** the existing configuration is loaded and displayed in an editable form

#### Scenario: Save configuration from dashboard

- **WHEN** a user submits the configuration form
- **THEN** bots are parsed from comma-separated input, each trimmed, limited to 64 chars and 15 entries, and saved with the target language

#### Scenario: Unauthenticated user

- **WHEN** an unauthenticated user visits `/helpers/lingo`
- **THEN** the system displays a login prompt

### Requirement: Translation test route

The system SHALL provide a development-only test route at `/lingo/test` that runs a suite of fixture-based translation tests and returns the results as plain text. The route SHALL return HTTP 404 when not in development mode.

#### Scenario: Run tests in development

- **WHEN** a request is made to `/lingo/test` with `DEVELOPMENT=1`
- **THEN** the system runs all fixtures against configured models and returns results

#### Scenario: Test route in production

- **WHEN** a request is made to `/lingo/test` without `DEVELOPMENT=1`
- **THEN** the system returns HTTP 404
