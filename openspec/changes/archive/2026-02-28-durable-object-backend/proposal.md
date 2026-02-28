## Why

PVTCH needs strongly consistent, per-user key-value storage for widget configuration and state that Cloudflare KV's eventual consistency cannot reliably provide. The Durable Object backend provides a reusable, generic key-value store with TTL-based expiration and two cleanup strategies, serving as the persistence layer for all widget data.

## What Changes

- Generic Durable Object class (`PvtchBackend`) with `set`, `get`, and `alarm` methods
- Two TTL strategies: PRESERVE_ON_UPDATE (reset on write) and PRESERVE_ON_FETCH (reset on read)
- 5KB max value size to prevent abuse
- Alarm-based automatic data expiration and cleanup
- Key normalization helper for consistent DO instance naming (`{token}::{id}`)
- React Router context system for injecting Cloudflare bindings into loaders/actions

## Capabilities

### New Capabilities
- `durable-object-backend`: Generic key-value Durable Object with TTL strategies, size limits, alarm-based cleanup, key normalization, and Cloudflare binding context injection

### Modified Capabilities

(none)

## Impact

- **Durable Objects**: `PvtchBackend` class bound as `PVTCH_BACKEND` in wrangler config
- **Storage**: SQLite-backed per-DO-instance storage (Cloudflare managed)
- **Utilities**: `normalizeKey` helper used by all widget routes for consistent DO addressing
- **Context**: `cloudflareEnvironmentContext`, `cloudflareExecutionContext`, and `userContext` used across all server-side routes
- **All widgets depend on this** for configuration and state persistence
