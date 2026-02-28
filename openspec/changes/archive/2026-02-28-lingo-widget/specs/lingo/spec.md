## ADDED Requirements

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

### Requirement: Short message filtering
The system SHALL skip translation for single-word messages that are 6 characters or fewer.

#### Scenario: Short single word
- **WHEN** a message contains no spaces and is 6 characters or fewer
- **THEN** the system returns an empty response without processing

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
