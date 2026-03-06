## Why

The 1s in chat overlay is configured entirely via URL parameters, but there's no UI to help users build that URL. Users must hand-craft query strings with color values, timing, and options — error-prone and unfriendly. A configuration page (like the existing progress bar widget page) gives users a form-based interface with live preview so they can see exactly what their overlay will look like before pasting it into OBS.

## What Changes

- New `/widgets/1s` configuration page with form fields for all URL parameters (colors, timing, voting mode, choices)
- Live preview via iframe embedding the actual overlay in demo mode
- New `demo` URL parameter on the overlay that disables chat connection, shows a play button, and runs a compressed simulation (10s vote / 5s lock / reset)
- Auto-filled channel name when logged in via Twitch, with manual override
- Copy-to-clipboard OBS URL generation from form state
- Inline "How to Use" guide covering OBS setup, viewer voting, mod commands, and tips

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `1s-chat-poll`: Adding demo mode parameter, configuration page with URL builder and live preview, and inline usage guide

## Impact

- **Routes**: New `/widgets/1s` page, modification to `/sources/1s/:channel` overlay
- **Dependencies**: No new dependencies (reuses existing UI components, form patterns, and ComfyJS conditional init)
- **Auth**: Twitch login optional (used to auto-fill channel name only)
