## Context

PVTCH uses Cloudflare Workers with no traditional database. While KV works for auth tokens (eventual consistency is acceptable), widget configurations need strong consistency — a user saving a progress bar config and immediately viewing the OBS source should see the updated config. Durable Objects provide per-instance SQLite storage with strong consistency guarantees.

## Goals / Non-Goals

**Goals:**
- Generic, reusable key-value store for any widget's data
- Strong consistency for read-after-write scenarios
- Automatic TTL-based data expiration to prevent unbounded storage growth
- Two TTL strategies to suit different access patterns
- Size limits to prevent abuse
- Clean context injection for Cloudflare bindings

**Non-Goals:**
- Multi-key operations or transactions across DO instances
- Complex query patterns (it's a single-value store per instance)
- User-facing API (only used internally by widget routes)
- Migration tooling for existing data

## Decisions

### 1. One DO instance per data item
Each piece of data (e.g., a user's progress bar config, a progress value) gets its own DO instance, identified by `{token}::{dataKey}`. This provides natural isolation — each item has independent TTL, storage, and alarm scheduling. The trade-off is more DO instances, but Cloudflare handles this efficiently.

### 2. Two TTL strategies
- **PRESERVE_ON_UPDATE**: TTL resets only when `set` is called. Used for progress bar values — they should expire if not updated.
- **PRESERVE_ON_FETCH**: TTL resets on every `get` or `set`. Used for configurations — as long as someone is viewing the config (e.g., OBS source polling), it stays alive.

### 3. 5KB value size limit
Prevents storing large blobs in DO storage. All current use cases (JSON configs, numeric values) are well under this limit. Throws an error rather than silently truncating.

### 4. Alarm-based cleanup
When data expires, the DO's `alarm` fires and deletes all storage. This is more reliable than checking expiration on every read, as it handles the case where no one reads the data after expiration.

### 5. Default 25-hour TTL
Without explicit TTL options, data expires after 25 hours (slightly longer than 24h to handle timezone edge cases). This ensures abandoned data doesn't persist indefinitely.

### 6. React Router context for bindings
Cloudflare env, execution context, and user data are injected via React Router's `createContext` → middleware → `context.get()` pattern. This avoids prop drilling and keeps the binding injection type-safe.

## Risks / Trade-offs

- **Single-value per DO** → Each DO stores exactly one value. To store multiple related values, multiple DO instances are needed. This is intentional for isolation but increases the number of DO instances.
- **No migration path** → If the storage schema changes, existing DO instances keep the old format. Mitigated by the TTL — old data naturally expires.
- **Alarm reliability** → Cloudflare alarms are eventually consistent. A DO might persist slightly past its TTL. Acceptable for TTL-based cleanup.
