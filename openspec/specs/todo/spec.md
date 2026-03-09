# todo Specification

## Purpose

Client-side OBS overlay for chat-driven task tracking with customizable commands, auto-scrolling, per-user task lists, mod controls, and a form-based configuration page with live preview and OBS URL generation.

## Requirements

### Requirement: Add tasks via chat command

The system SHALL allow users to add tasks by sending a configurable chat command (default `!add`). Multiple tasks SHALL be separated by semicolons. Each user SHALL be limited to a configurable maximum number of incomplete tasks (default 5). Tasks beyond the limit SHALL be silently dropped.

#### Scenario: Add single task

- **WHEN** a user sends `!add Fix the login bug`
- **THEN** a new incomplete task "Fix the login bug" is created for that user

#### Scenario: Add multiple tasks

- **WHEN** a user sends `!add Task one; Task two; Task three`
- **THEN** three separate tasks are created for that user

#### Scenario: Task limit reached

- **WHEN** a user already has the maximum number of incomplete tasks
- **THEN** additional tasks are not added and a "task limit reached" warning is displayed

### Requirement: Complete tasks via chat command

The system SHALL allow users to mark their own tasks as completed by sending a configurable command (default `!done`) followed by task index numbers. If no index is provided, task 1 SHALL be completed. Multiple indexes SHALL be supported, separated by semicolons.

#### Scenario: Complete specific task

- **WHEN** a user sends `!done 2`
- **THEN** the user's task at index 2 (in their sorted task list) is marked as completed

#### Scenario: Complete first task by default

- **WHEN** a user sends `!done` without an index
- **THEN** the user's task at index 1 is marked as completed

#### Scenario: Complete multiple tasks

- **WHEN** a user sends `!done 1; 3`
- **THEN** tasks at indexes 1 and 3 are marked as completed

### Requirement: Focus task via chat command

The system SHALL allow users to prioritize a task by sending a configurable command (default `!focus`) followed by a task index. Focused tasks SHALL sort higher within the user's task list based on the focus timestamp.

#### Scenario: Focus a task

- **WHEN** a user sends `!focus 3`
- **THEN** the task at index 3 receives a focus timestamp and is sorted higher in the user's list

### Requirement: Reset tasks (mod/broadcaster only)

The system SHALL allow moderators and broadcasters to clear tasks by sending a configurable command (default `!reset`). An optional `@username` argument SHALL clear only that user's tasks. Without an argument, all tasks SHALL be cleared.

#### Scenario: Reset all tasks

- **WHEN** a moderator sends `!reset`
- **THEN** all tasks for all users are removed

#### Scenario: Reset specific user's tasks

- **WHEN** a moderator sends `!reset @username`
- **THEN** only that user's tasks are removed

#### Scenario: Non-mod attempts reset

- **WHEN** a regular viewer sends `!reset`
- **THEN** nothing happens (command is ignored)

### Requirement: Clear completed tasks (mod/broadcaster only)

The system SHALL allow moderators and broadcasters to remove all completed tasks by sending a configurable command (default `!clear`).

#### Scenario: Clear completed

- **WHEN** a moderator sends `!clear`
- **THEN** all tasks marked as completed are removed, leaving incomplete tasks

### Requirement: Task sorting order

The system SHALL sort tasks in the following priority: (1) broadcaster's tasks first, (2) usernames alphabetically, (3) incomplete before completed, (4) higher focus timestamp before lower, (5) older tasks before newer.

#### Scenario: Broadcaster tasks at top

- **WHEN** both the broadcaster and a viewer have tasks
- **THEN** the broadcaster's tasks appear first in the display

#### Scenario: Focused task priority

- **WHEN** a user has multiple tasks and focuses task 3
- **THEN** task 3 moves above unfocused tasks in that user's section

### Requirement: Auto-scrolling overflow

The system SHALL automatically scroll when task content exceeds the viewport height. Scrolling SHALL use a CSS animation that loops seamlessly by duplicating the task list. Scroll duration SHALL scale with task count at 1.4 seconds per task, clamped between 8 and 120 seconds.

#### Scenario: Content fits viewport

- **WHEN** the total task height (including header) fits within the viewport
- **THEN** no scrolling animation is applied

#### Scenario: Content exceeds viewport

- **WHEN** the total task height exceeds the viewport
- **THEN** the task list is duplicated and an infinite scroll animation is applied

### Requirement: Customizable appearance and commands

The system SHALL accept URL query parameters to customize: background color (`bg`), foreground color (`fg`), command names (`add`, `done`, `focus`, `reset`, `clear`), task count limit (`count`), help display toggle (`help`), debug mode (`debug`), and demo mode (`demo`). All parameters SHALL have sensible defaults. When `demo` is true, the system SHALL skip Twitch chat connection and seed the task list with sample data: 2 users with 3 tasks each, showing a mix of incomplete, completed, and focused states.

#### Scenario: Custom command names

- **WHEN** the URL includes `?add=task&done=finish`
- **THEN** the widget responds to `!task` for adding and `!finish` for completing

#### Scenario: Custom colors

- **WHEN** the URL includes `?bg=rgba(0,0,0,0.5)&fg=yellow`
- **THEN** the widget renders with the specified background and text colors

#### Scenario: Demo mode enabled

- **WHEN** the URL includes `?demo=true`
- **THEN** the widget does not connect to Twitch chat and displays pre-seeded sample tasks

#### Scenario: Demo mode disabled by default

- **WHEN** the URL does not include a `demo` parameter
- **THEN** the widget connects to Twitch chat normally and starts with an empty task list (or localStorage-restored tasks)

### Requirement: Help header display

The system SHALL display a header showing available command names (e.g., `!add · !done · !focus`) when the `help` parameter is true (default). The header SHALL be sticky above the scrolling content.

#### Scenario: Help enabled

- **WHEN** the `help` parameter is true or not set
- **THEN** a header bar displays the command names

#### Scenario: Help disabled

- **WHEN** the URL includes `?help=false`
- **THEN** the header is hidden

### Requirement: LocalStorage persistence

The system SHALL persist tasks in the browser's localStorage. Tasks SHALL survive page reloads within the same OBS browser source instance.

#### Scenario: Page reload

- **WHEN** the OBS browser source reloads
- **THEN** previously added tasks are restored from localStorage

### Requirement: Task display

Each task SHALL display: a numbered index (for incomplete tasks) or a check icon (for completed tasks), the username in bold, and the task description. Completed tasks SHALL appear with reduced opacity and strikethrough text.

#### Scenario: Incomplete task display

- **WHEN** a task is incomplete
- **THEN** it shows its index number, bold username, and description

#### Scenario: Completed task display

- **WHEN** a task is completed
- **THEN** it shows a check icon, strikethrough username and description, with reduced opacity

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
