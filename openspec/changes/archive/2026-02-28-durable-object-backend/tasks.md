## 1. Durable Object Class

- [x] 1.1 Create `do/backend.ts` with `PvtchBackend` class extending `DurableObject<Env>`
- [x] 1.2 Implement `set(value, options?)` method with 5KB size validation, TTL strategy storage, expiration calculation, and alarm scheduling
- [x] 1.3 Implement `get()` method with strategy-aware TTL refresh (PRESERVE_ON_FETCH resets expiration, PRESERVE_ON_UPDATE does not)
- [x] 1.4 Implement `alarm()` method that checks expiration and deletes all storage when expired
- [x] 1.5 Export `TTLOptions` type for use by consuming routes

## 2. Key Normalization

- [x] 2.1 Create `app/lib/normalize-key.ts` with `normalizeKey(token, id)` returning `{token}::{id}` format

## 3. Context System

- [x] 3.1 Create `app/context.ts` with `cloudflareEnvironmentContext`, `cloudflareExecutionContext`, and `userContext` using React Router's `createContext`
- [x] 3.2 Define `TwitchUser` interface (id, login, displayName)

## 4. Infrastructure

- [x] 4.1 Configure `PVTCH_BACKEND` Durable Object binding in wrangler.jsonc with `PvtchBackend` class
- [x] 4.2 Create Cloudflare Worker entry handler (`cloudflare/handler.ts`) that sets context values and delegates to React Router
