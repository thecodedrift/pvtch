## 1. Add zod param parser to progress source route

- [x] 1.1 Add `parameterParser` zod schema to `sources/progress.$token.$name.tsx` with fields: fg1, fg2, bg (strings with defaults), goal, decimal (string→number transforms with defaults), text, prefix (strings, default empty)
- [x] 1.2 Parse `request.url` search params in the loader using `parameterParser` and pass parsed config to the component
- [x] 1.3 Remove DO config fetch (configKey, configNormalizedKey, configCdo, configStub) from the loader — keep only progress value fetch
- [x] 1.4 Remove the `ProgressConfig` type and `parseConfig` function
- [x] 1.5 Remove the `progressDefaults` import (defaults now live in the zod schema)

## 2. Convert config page to URL builder

- [x] 2.1 Remove the `action` export and all DO config storage logic from `widgets/progress.tsx`
- [x] 2.2 Simplify the `loader` to only check auth and resolve the user's token (remove DO config fetch, configKey, parseConfig)
- [x] 2.3 Replace `@tanstack/react-form` usage with individual `useState` hooks for each config field (fg1, fg2, bg, goal, text, decimal, prefix)
- [x] 2.4 Add `useMemo` to build OBS URL with only non-default params (matching 1s pattern)
- [x] 2.5 Replace the Save button with a copy-to-clipboard button for the OBS URL
- [x] 2.6 Wire the live `<BasicBar>` preview to useState values instead of form store
- [x] 2.7 Keep the ID selector but make it update the generated URL path instead of triggering a loader refetch
- [x] 2.8 Remove imports: `useFetcher`, `@tanstack/react-form` (`useForm`, `useStore`), `TTLOptions`, `normalizeKey`

## 3. Cleanup

- [x] 3.1 Remove unused `parseConfig` and `parseCookies` if no longer needed in the config page (parseCookies may still be needed for auth)
- [x] 3.2 Verify the update API URL display still works correctly with the new ID selector
- [x] 3.3 Verify the progress source route still polls and displays progress values correctly (only the config source changed, not the value polling)
