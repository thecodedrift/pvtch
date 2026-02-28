## 1. Core Translation Engine

- [x] 1.1 Create `app/lib/translator.ts` with LLM system prompt defining two-line response format (language + translation/NOOP)
- [x] 1.2 Implement `extractResponse` to handle Qwen choices-based and older llama response formats, stripping `<think>` blocks
- [x] 1.3 Implement `normalizeString` pipeline: `dropURLs` → `removeTwitchEmotes` (with @username preservation via Intl.Segmenter)
- [x] 1.4 Implement `translate` function with Cloudflare AI call, p-retry (3 retries), two-line response parsing, and line-prefix stripping
- [x] 1.5 Implement three-stage NOOP detection: model NOOP, language match, and similarity check with adaptive thresholds

## 2. Similarity Scoring

- [x] 2.1 Create `app/lib/strings.ts` with `similar` function using Intl.Segmenter word extraction and overlap coefficient

## 3. Configuration & Constants

- [x] 3.1 Create `app/lib/constants/lingo.ts` with Zod schema (`{ bots: string[], language: string }`) and default config
- [x] 3.2 Create `app/lib/known-bots.ts` with curated list of 900+ known Twitch bot usernames

## 4. Translation API

- [x] 4.1 Create `app/routes/lingo.translate.$token.tsx` with GET (query params) and POST (JSON body) handlers
- [x] 4.2 Implement pre-LLM filtering: known bots, commands (`!`), short single-word (≤6 chars), hardcoded skip strings
- [x] 4.3 Implement post-LLM filtering: NOOP safety net, empty-after-username-removal check
- [x] 4.4 Prefix successful translations with `ImTyping ` and return empty responses on all error/skip paths

## 5. Configuration API

- [x] 5.1 Create `app/routes/lingo.config.$token.set.tsx` with GET and POST handlers for saving lingo config
- [x] 5.2 Validate config against Zod schema, store in Durable Object with 30-day PRESERVE_ON_FETCH TTL

## 6. Dashboard

- [x] 6.1 Create `app/routes/helpers/lingo.tsx` with loader/action for config CRUD via Durable Object
- [x] 6.2 Build configuration form with target language and comma-separated ignored bots fields
- [x] 6.3 Display translate API URL in password-masked field with copy button
- [x] 6.4 Create tabbed setup guide with Firebot and MixItUp screenshot walkthroughs
- [x] 6.5 Gate page behind authentication with RequireTwitchLogin fallback

## 7. Testing

- [x] 7.1 Create `app/routes/lingo.test.tsx` with fixture-based translation accuracy tests (development-only, returns 404 in production)
