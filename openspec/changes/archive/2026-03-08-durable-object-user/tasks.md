## 1. Helpers (migrate + job scheduler)

- [ ] 1.1 Create `workers/core/do/helpers/migrate.ts` — copy from Taskless with same API: `migrate(sql, migrations, versionTable?)` and `Migrations` type
- [ ] 1.2 Create `workers/core/do/helpers/job-scheduler/migrations.ts` — copy job scheduler migrations from Taskless (jobs table + idempotency key index)
- [ ] 1.3 Create `workers/core/do/helpers/job-scheduler/index.ts` — copy JobScheduler from Taskless as-is (constructor runs migrations)

## 2. Plugins

- [ ] 2.1 Create `workers/core/do/plugins/progress.ts` — Progress plugin with constructor(sql) running migrations, get(name), set(name, value). Migration 1 creates `progress` table (name TEXT PK, value REAL, updated_at INTEGER)
- [ ] 2.2 Create `workers/core/do/plugins/lingo.ts` — Lingo plugin with constructor(sql) running migrations, getConfig(), setConfig(config), import(config). Migration 1 creates `lingo_config` table (key TEXT PK, value TEXT, updated_at INTEGER)

## 3. User Durable Object

- [ ] 3.1 Create `workers/core/do/user.ts` — User DO class extending DurableObject<Env>, implements JobSchedulerHost. Constructor wires Progress, Lingo, JobScheduler plugins. Accessor methods progress() and lingo(). alarm() delegates to scheduler.processAlarm(this). scheduled(job) dispatches by task name.
- [ ] 3.2 Export User class from `workers/core/cloudflare/handler.ts` (or wherever DO classes are exported for wrangler)

## 4. Wrangler Configuration

- [ ] 4.1 Add v3 migration tag to wrangler.jsonc: `{ "tag": "v3", "new_sqlite_classes": ["User"] }`
- [ ] 4.2 Add `PVTCH_USER` binding to durable_objects.bindings pointing to `User` class
- [ ] 4.3 Update `worker-configuration.d.ts` with `PVTCH_USER: DurableObjectNamespace<User>` binding type

## 5. Route Updates — Progress

- [ ] 5.1 Update `progress.$token.$name.get.tsx` — resolve token → userId, use `PVTCH_USER.idFromName("twitch:" + userId)`, call `stub.progress().get(name)`
- [ ] 5.2 Update `progress.$token.$name.set.tsx` — same pattern, call `stub.progress().set(name, value)`
- [ ] 5.3 Update `sources/progress.$token.$name.tsx` loader — use new User DO for progress reads

## 6. Route Updates — Lingo

- [ ] 6.1 Update `helpers/lingo.tsx` (loadLingoConfig/saveLingoConfig) — use `PVTCH_USER`, add temporary migration block: if `stub.lingo().getConfig()` returns null, fetch from old `PVTCH_BACKEND` via token, call `stub.lingo().import(parsed)` if found
- [ ] 6.2 Update `lingo.config.$token.set.tsx` — use new User DO for config writes
- [ ] 6.3 Update `lingo.translate.$token.tsx` — use new User DO for config reads

## 7. Cleanup

- [ ] 7.1 Remove unused `normalizeKey` imports (keep utility file — still used by lingo migration block)
- [ ] 7.2 Verify build succeeds with `pnpm build` or typecheck
