## Context

Quick audience polls are a common streaming interaction. The "1s" (one-second) voting widget allows viewers to vote by typing in chat. The first word of any chat message is treated as a vote. Voting runs on a timer with a configurable duration and cooldown period, providing a structured polling experience.

## Goals / Non-Goals

**Goals:**
- Real-time vote counting from chat messages
- Timed voting rounds with duration and cooldown phases
- Visual bar chart display of top 4 options
- Configurable vote mode (single vote vs repeat voting)
- Optional predefined choice lists
- Mod commands for runtime configuration changes
- Customizable colors via URL parameters

**Non-Goals:**
- Persistent poll history or results
- Server-side vote storage or validation
- Multiple simultaneous polls
- Vote weighting or subscriber-only voting

## Decisions

### 1. First-word voting
Votes are extracted from the first word of any chat message. This keeps voting friction-free — viewers just type "1" or an option name. Numeric inputs are normalized: "1111" → "1" (meme repetition), "1.5" → "1" (decimal truncation).

### 2. Three-phase lifecycle
- **Ready**: No votes yet, waiting for first vote to start the timer
- **Voting**: Timer running, votes accepted (first vote triggers the timer)
- **Locked**: Timer expired, results frozen, cooldown period before returning to ready

This auto-start behavior means mods don't need to manually begin each poll — the first vote kicks it off.

### 3. Choice list mode vs open numeric
When `choices` parameter is provided (comma-separated), only votes matching those choices (case-insensitive) are accepted. Otherwise, any numeric input is accepted. This supports both "vote 1/2/3/4" and "vote for your favorite game" scenarios.

### 4. Runtime mod commands
Mods can change parameters during the stream via `!1s` commands:
- `!1s timer 30/15` — set duration to 30s, cooldown to 15s
- `!1s vote one|many` — toggle repeat voting
- `!1s list option1, option2, option3` — set choice list
- `!1s reset` — clear all votes and restart

All commands reset the current vote state to avoid confusion.

### 5. Top-4 display
Only the top 4 options by vote count are shown as horizontal bars. This keeps the display readable in typical OBS overlay sizes. Options are absolutely positioned and use CSS transitions for smooth reordering.

### 6. No persistence
Unlike the todo widget, votes are purely in React state (not localStorage). Polls are inherently ephemeral — results are only meaningful during the stream session.

## Risks / Trade-offs

- **Auto-start on first vote** → A stray chat message matching a valid vote could start the timer unintentionally. Mitigated by mods being able to reset.
- **Single-voter tracking** → Repeat voting prevention uses a username→option Map. If a viewer changes their Twitch display name mid-stream, they could vote twice. Extremely unlikely edge case.
- **No callback implementation** → The `callback` URL parameter is parsed and validated but the actual HTTP callback is not yet implemented (scaffolded as a TODO).
