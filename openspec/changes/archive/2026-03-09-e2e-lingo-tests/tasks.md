## 1. Vitest Setup

- [x] 1.1 Add `vitest` as a devDependency in `workers/core/package.json`
- [x] 1.2 Create `workers/core/vitest.config.ts` with path alias resolution, `e2e/**/*.test.ts` include pattern, and 30s test timeout
- [x] 1.3 Add `"test:e2e": "vitest run"` script to `workers/core/package.json`

## 2. Lingo E2E Test

- [x] 2.1 Create `workers/core/e2e/lingo.test.ts` with `getPlatformProxy` setup in `beforeAll`/`afterAll` hooks
- [x] 2.2 Define fixtures with `input`, `expected.language`, optional `preserveTokens`, and `expectSameLanguage` for script-mismatch cases
- [x] 2.3 Implement structural assertions: success check, language match, ISO 639-3 code validation, non-empty translation, token preservation, and `isSameLanguage` guard for misdetected Latin-script inputs

## 3. Remove Old Test Route

- [x] 3.1 Remove `route('lingo/test', './routes/lingo.test.tsx')` from `app/routes.ts`
- [x] 3.2 Delete `app/routes/lingo.test.tsx`

## 4. Bug Fix: Latin-script misdetection

- [x] 4.1 Add prompt rule to prevent classifying Latin-only text as non-Latin-script languages
- [x] 4.2 Add `isLatinOnly` and `isNonLatinScriptLanguage` helpers to `translator.ts`
- [x] 4.3 Add script-mismatch guard in `isSameLanguage()` — if input is Latin-only but detected language uses non-Latin script, treat as same language

## 5. Verify

- [x] 5.1 Run `pnpm test:e2e` and confirm all 11 tests pass
