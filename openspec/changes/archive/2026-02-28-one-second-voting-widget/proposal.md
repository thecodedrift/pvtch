## Why

Streamers need a quick, visual way to poll their audience in real time. The 1-second voting widget provides a chat-driven polling overlay for OBS where viewers type their choice directly in chat and results display as animated bar charts. It supports timed voting rounds with configurable duration and cooldown, repeat voting, and custom choice lists.

## What Changes

- Client-side OBS browser source that connects to Twitch chat via ComfyJS
- Real-time vote tallying from first word of chat messages (numeric or choice-list based)
- Three-phase voting lifecycle: ready → voting → locked (with timer display)
- Animated horizontal bar chart showing top 4 options sorted by vote count
- Mod/broadcaster commands to configure duration/cooldown, vote mode (one/many), choice lists, and reset
- Numeric input normalization (meme formats like "1111" → "1", decimal truncation)
- Customizable appearance (background, text, bar colors) via URL query parameters
- Optional callback URL support (scaffolded, not yet implemented)

## Capabilities

### New Capabilities
- `one-second-voting`: Real-time chat-based voting/polling OBS overlay with timed rounds, bar chart results, mod controls, and customizable appearance

### Modified Capabilities

(none)

## Impact

- **Routes**: `/sources/1s/:channel` (OBS browser source)
- **Dependencies**: ComfyJS for Twitch chat, `rooks` for interval timing and visibility detection, `lucide-react` for Lock/Timer icons, Zod for parameter validation
- **Client-side only**: All voting state lives in React state (not persisted)
- **Hooks**: Uses `useComfy` for chat, `useNoTheme` for bare embed
