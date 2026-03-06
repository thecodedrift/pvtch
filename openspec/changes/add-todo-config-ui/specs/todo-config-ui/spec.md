## ADDED Requirements

### Requirement: Configuration page at /widgets/todo

The system SHALL provide a configuration page at the route `/widgets/todo` that allows users to customize the todo widget's appearance and behavior through a form interface. The page SHALL use a two-column layout on desktop (config left, preview right) and stack vertically on mobile (preview on top, config below).

#### Scenario: Desktop layout

- **WHEN** a user visits `/widgets/todo` on a viewport wider than the `md` breakpoint
- **THEN** the config form appears on the left and the widget preview appears on the right in a side-by-side layout

#### Scenario: Mobile layout

- **WHEN** a user visits `/widgets/todo` on a viewport narrower than the `md` breakpoint
- **THEN** the widget preview appears above the config form in a single-column layout

### Requirement: Live widget preview via iframe

The system SHALL display a live preview of the todo widget in an iframe on the config page. The iframe SHALL load the todo source route with `demo=true` and reflect current form values (colors, help toggle, command names). The iframe source SHALL be debounced (500ms) to prevent excessive reloads during rapid input changes.

#### Scenario: Color change updates preview

- **WHEN** a user changes the background color in the config form
- **THEN** the iframe preview updates after a 500ms debounce to show the new background color

#### Scenario: Help toggle updates preview

- **WHEN** a user toggles "Show Help Header" off
- **THEN** the iframe preview updates to hide the command header bar

### Requirement: Channel name input with auto-fill

The system SHALL provide a channel name input field. If the user is authenticated via Twitch login, the field SHALL be pre-filled with their Twitch username. The field SHALL always be editable.

#### Scenario: Authenticated user

- **WHEN** an authenticated user visits the config page
- **THEN** the channel input is pre-filled with their Twitch username

#### Scenario: Unauthenticated user

- **WHEN** an unauthenticated user visits the config page
- **THEN** the channel input is empty and the user types their channel name

### Requirement: Color picker controls

The system SHALL provide RGBA color pickers for background (`bg`) and text (`fg`) colors. Each picker SHALL display a color swatch button that opens a dropdown with an RGBA color picker and a text input for manual color entry. Clicking outside the dropdown SHALL close it.

#### Scenario: Open color picker

- **WHEN** a user clicks the background color swatch
- **THEN** an RGBA color picker dropdown appears with the current color selected

#### Scenario: Manual color entry

- **WHEN** a user types `rgba(255, 0, 0, 0.5)` in the color input field
- **THEN** the color picker updates to reflect the entered color

### Requirement: Behavior controls

The system SHALL provide a toggle for the help header display (default: on) and a numeric input for the maximum tasks per user (default: 5).

#### Scenario: Toggle help header off

- **WHEN** a user turns off "Show Help Header"
- **THEN** the generated OBS URL includes `?help=false`

#### Scenario: Change max tasks

- **WHEN** a user sets max tasks to 3
- **THEN** the generated OBS URL includes `?count=3`

### Requirement: Command name inputs

The system SHALL provide text inputs for the three viewer-facing command names: add (default: `add`), done (default: `done`), and focus (default: `focus`). These SHALL be always visible.

#### Scenario: Custom command name

- **WHEN** a user changes the "Add" command name to `task`
- **THEN** the generated OBS URL includes `?add=task` and the preview header shows `!task`

### Requirement: Mod command disclosure

The system SHALL provide a toggle labeled "Change mod commands" that, when enabled, reveals text inputs for reset (default: `reset`) and clear (default: `clear`) command names. The mod command inputs SHALL be hidden by default.

#### Scenario: Mod commands hidden by default

- **WHEN** a user visits the config page
- **THEN** the mod command inputs are not visible

#### Scenario: Reveal mod commands

- **WHEN** a user enables "Change mod commands"
- **THEN** text inputs for reset and clear command names appear

### Requirement: OBS URL generation and copy

The system SHALL generate an OBS URL based on form values, including only parameters that differ from defaults. The URL SHALL be displayed in a read-only input field with a copy-to-clipboard button. The URL and copy button SHALL appear on the right pane below the preview on desktop, and below the config form on mobile.

#### Scenario: Default config URL

- **WHEN** all form values match defaults and channel is "mychannel"
- **THEN** the OBS URL is `{origin}/sources/todo/mychannel` with no query parameters

#### Scenario: Custom config URL

- **WHEN** the user sets bg to `rgba(0,0,0,0.5)` and add command to `task`
- **THEN** the OBS URL includes `?bg=rgba(0%2C0%2C0%2C0.5)&add=task`

#### Scenario: Copy URL

- **WHEN** a user clicks the copy button
- **THEN** the OBS URL is copied to the clipboard and a success toast appears

### Requirement: How to Use documentation

The system SHALL display a "How to Use" section below the config/preview columns spanning full width. It SHALL include: (1) OBS setup instructions with a note about setting dimensions in source properties instead of dragging to resize, (2) "For Chat" section with command examples, (3) "For Streamers & Mods" section with mod command examples. Command examples SHALL reflect the current custom command names from the form state.

#### Scenario: Custom command names in docs

- **WHEN** the user has renamed "add" to "task" and "done" to "finish"
- **THEN** the For Chat section shows `!task` and `!finish` in its examples

#### Scenario: Default command names in docs

- **WHEN** all command names are at their defaults
- **THEN** the docs show `!add`, `!done`, `!focus`, `!reset`, `!clear`
