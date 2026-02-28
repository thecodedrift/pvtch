## Context

Twitch chat is global. Streamers often receive messages in languages they don't understand. Lingo bridges this gap by detecting the source language and translating to the streamer's language via LLM, integrated through existing chatbot tools. The system needs to be fast, avoid false positives (translating messages already in the target language), and handle the noisy reality of Twitch chat (emotes, bot commands, mixed scripts).

## Goals / Non-Goals

**Goals:**
- Accurate language detection and translation via Cloudflare AI
- Minimize false positives (unnecessary translations of same-language text)
- Filter out bots, commands, and noise before hitting the LLM
- Simple integration with Firebot, MixItUp, and other chatbots via GET URL
- Configurable target language and ignored users
- Graceful failure: return empty response on any error (never break the chatbot)

**Non-Goals:**
- Caching translations (each message is unique enough that cache hits would be rare)
- Supporting multiple target languages per user
- Direct Twitch IRC/EventSub integration (relies on user's chatbot)
- Translating from a specific source language (auto-detects source)

## Decisions

### 1. Two-line LLM response format
The LLM is prompted to respond with exactly two lines: detected language name and translation (or "NOOP"). This structured format is easy to parse, avoids complex JSON extraction from the model, and provides the detected language for downstream logic (same-language suppression).

### 2. Multi-stage NOOP detection
Translation is suppressed through three independent checks:
1. **Model NOOP**: The LLM itself outputs "NOOP" when text is already in the target language
2. **Language match**: If the detected language name matches the target language
3. **Similarity check**: Word overlap coefficient between input and output catches cases where the model paraphrases instead of translating

Short messages (≤3 words) use a lower similarity threshold (0.5) because language detection is unreliable for short text. Longer messages use 0.75 to avoid blocking legitimate mixed-language translations.

### 3. Pre-LLM filtering pipeline
Messages are filtered before reaching the LLM to save compute:
- Known bots list (900+ entries) checked first
- Chat commands (starting with `!`) skipped
- Short single-word messages (≤6 characters) skipped
- Hardcoded special strings (`imtyping`, `megaphonez`) skipped
- User-configured ignored bots checked after KV fetch

This ordering ensures cheap checks happen before expensive KV reads and LLM calls.

### 4. Message normalization
Before translation, messages are normalized:
- URLs stripped entirely (they'd confuse the LLM)
- Twitch emotes removed using a CamelCase heuristic regex (`[a-zA-Z][a-z0-9]+[0-9]*[A-Z][a-zA-Z0-9]+`)
- @usernames preserved through Intl.Segmenter word-walking that tracks the `@` flag

### 5. Retry with p-retry
LLM calls use `p-retry` with 3 retries to handle transient Cloudflare AI failures. The structured prompt format means retries are likely to produce valid responses.

### 6. Response prefix convention
Successful translations are prefixed with `ImTyping ` — a convention used by the chatbot integration to identify the response as a valid translation. The chatbot is configured to only send messages when the response is non-empty.

### 7. Fail-safe empty responses
All error paths return HTTP 200 with an empty body rather than error status codes. This prevents chatbot integrations from displaying error messages in chat. Errors are logged server-side for debugging.

## Risks / Trade-offs

- **LLM accuracy** → Language detection and translation quality depend on the model. Qwen 3 30B provides good quality at low cost ($0.051/M input tokens). Model can be swapped by changing `CURRENT_MODEL`.
- **No caching** → Every message hits the LLM. Mitigated by pre-filtering removing a significant portion of messages before they reach the model.
- **Emote removal heuristic** → The CamelCase regex may incorrectly strip legitimate words. Mitigated by it only removing words matching the Twitch emote naming pattern.
- **Similarity false negatives** → Mixed-language messages where the translation contains many of the same English words may be incorrectly suppressed. The 0.75 threshold for longer messages reduces this risk.
