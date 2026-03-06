## 1. Demo Mode on Overlay

- [x] 1.1 Add `demo` parameter to the Zod schema in `1s.$channel.tsx` (boolean, default false)
- [x] 1.2 Conditionally skip `useComfy` initialization when `demo=true`
- [x] 1.3 Override duration to 10s and cooldown to 5s when demo is active
- [x] 1.4 Render a play button (bottom-right, semi-transparent) when in demo mode and state is ready
- [x] 1.5 Wire play button to run compressed simulation (votes trickle in over ~3s, then 10s vote, 5s lock, reset)
- [x] 1.6 Reset all state (votes, voters, startTime) after demo completes so play button reappears

## 2. Config Page Route

- [x] 2.1 Create `app/routes/widgets/1s.tsx` with meta tags
- [x] 2.2 Add route `widgets/1s` to `routes.ts` inside the app-layout group
- [x] 2.3 Add loader that checks for `pvtch_token` cookie and resolves Twitch username if logged in

## 3. Configuration Form

- [x] 3.1 Add channel name input field, pre-filled from loader if authenticated
- [x] 3.2 Add color fields: background, text color, bar color (with defaults matching overlay)
- [x] 3.3 Add timing fields: vote duration, cooldown (numeric inputs)
- [x] 3.4 Add repeat voting toggle (checkbox)
- [x] 3.5 Add choices input field (comma-separated text)

## 4. URL Generation and Preview

- [x] 4.1 Build OBS URL from form state, including only params that differ from defaults
- [x] 4.2 Display read-only URL field with copy-to-clipboard button
- [x] 4.3 Add sticky iframe preview that loads the overlay with current params + `demo=true`
- [x] 4.4 Update iframe src when form values change (with debounce to avoid excessive reloads)

## 5. How-to Guide

- [x] 5.1 Add "Add to OBS" section with browser source instructions and recommended dimensions
- [x] 5.2 Add "How Viewers Vote" section explaining numeric and choice-list voting
- [x] 5.3 Add "Mod Commands" section with command reference table
- [x] 5.4 Add "Tips" section with practical usage advice
