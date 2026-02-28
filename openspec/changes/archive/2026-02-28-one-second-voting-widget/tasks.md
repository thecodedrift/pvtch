## 1. Parameter Parsing

- [x] 1.1 Define Zod schema for URL parameters: bg, text, bar, duration, cooldown, repeat, choices (comma-separated), callback (URL validation)
- [x] 1.2 Implement `numericNormalizer` for meme-format and decimal vote normalization

## 2. Voting Logic

- [x] 2.1 Implement vote function with choice-list matching (case-insensitive) and numeric normalization
- [x] 2.2 Implement voter tracking (username → option Map) with repeat/single-vote mode
- [x] 2.3 Implement three-phase lifecycle (ready/voting/locked) with auto-start on first vote
- [x] 2.4 Implement 1-second interval timer via `rooks` useIntervalWhen for countdown display

## 3. Mod Commands

- [x] 3.1 Wire up `!1s timer {duration}/{cooldown}` command with override merging
- [x] 3.2 Wire up `!1s vote one|many` command for repeat voting toggle
- [x] 3.3 Wire up `!1s list {choices}` command for setting/clearing choice list
- [x] 3.4 Wire up `!1s reset` command for clearing all state
- [x] 3.5 Restrict all `!1s` commands to mod/broadcaster flags

## 4. OBS Source Component

- [x] 4.1 Create `app/routes/sources/1s.$channel.tsx` with loader extracting channel from params
- [x] 4.2 Render choice chips at top when choices are configured
- [x] 4.3 Render timer countdown during voting, lock icon during locked, hidden during ready
- [x] 4.4 Render top-4 bar chart with proportional widths, vote counts, and CSS transitions
- [x] 4.5 Apply 50% opacity to non-winning options during locked state
- [x] 4.6 Add development-mode simulation helpers (sendComfyEvent, simulate functions)
