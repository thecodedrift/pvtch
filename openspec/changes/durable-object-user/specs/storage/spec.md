## REMOVED Requirements

### Requirement: Set value with TTL

**Reason**: Replaced by typed plugin methods (`Progress.set()`, `Lingo.setConfig()`). The generic KV set/get pattern with TTL strategies is no longer used. Each plugin manages its own storage schema and lifecycle.
**Migration**: Use `stub.progress().set(name, value)` for progress data. Use `stub.lingo().setConfig(config)` for lingo configuration. No TTL management needed — data persists in SQLite without expiration.

### Requirement: Get value with strategy-based TTL refresh

**Reason**: Replaced by typed plugin methods (`Progress.get()`, `Lingo.getConfig()`). TTL strategies (PRESERVE_ON_UPDATE, PRESERVE_ON_FETCH) are no longer used.
**Migration**: Use `stub.progress().get(name)` for progress data. Use `stub.lingo().getConfig()` for lingo configuration.

### Requirement: Alarm-based expiration cleanup

**Reason**: Data no longer expires via TTL. The alarm is now owned by the JobScheduler for scheduled job processing. Data lifecycle is managed by the application, not automatic expiration.
**Migration**: The User DO alarm delegates to `JobScheduler.processAlarm()`. No alarm-based cleanup is needed for user data.

### Requirement: Key normalization

**Reason**: DO instances are no longer addressed by `{token}::{id}`. The User DO is addressed by `twitch:{userId}` and plugins provide typed access to specific data.
**Migration**: Replace `normalizeKey(token, id)` + `env.PVTCH_BACKEND.idFromName(key)` with `env.PVTCH_USER.idFromName("twitch:" + userId)` and plugin method calls.
