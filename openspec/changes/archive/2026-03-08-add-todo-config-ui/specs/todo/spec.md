## MODIFIED Requirements

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
