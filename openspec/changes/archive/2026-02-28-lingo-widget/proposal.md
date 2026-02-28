## Why

Twitch streamers with international audiences need real-time chat translation. Lingo provides AI-powered translation that integrates with popular chatbot tools (Firebot, MixItUp) so foreign-language chat messages are automatically detected and translated, helping streamers understand and engage with their global community.

## What Changes

- Translation API endpoint that accepts a chat message and username, detects the language, and translates to the streamer's configured target language
- Smart message filtering: skips known bots (900+ curated list), chat commands, short single-word messages, and user-configured ignored accounts
- Message normalization pipeline: strips URLs, removes Twitch emotes while preserving @usernames
- LLM-based translation using Cloudflare AI (Qwen 3 30B) with structured two-line response format
- Similarity detection to prevent echoing near-identical "translations" of same-language text
- Configuration API for setting target language and ignored bots list (Zod validated)
- Dashboard page with configuration form and setup guides for Firebot, MixItUp, and custom integrations
- Development-only test route with fixture-based translation accuracy testing

## Capabilities

### New Capabilities
- `lingo`: AI-powered chat message translation with language detection, smart filtering, chatbot integration APIs, configuration management, and setup documentation

### Modified Capabilities

(none)

## Impact

- **Routes**: `/lingo/translate/:token` (translation API), `/lingo/config/:token/set` (config API), `/helpers/lingo` (dashboard), `/lingo/test` (dev-only test fixture runner)
- **Cloudflare AI**: Uses `@cf/qwen/qwen3-30b-a3b-fp8` model binding
- **Durable Objects**: One DO instance per user for lingo config (`{token}::lingo-config`)
- **Libraries**: `p-retry` for LLM call retry logic, `Intl.Segmenter` for word-level text processing
- **Dependencies**: Requires auth system for token validation
