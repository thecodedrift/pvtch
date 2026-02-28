## ADDED Requirements

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
The system SHALL accept URL query parameters to customize: background color (`bg`), foreground color (`fg`), command names (`add`, `done`, `focus`, `reset`, `clear`), task count limit (`count`), help display toggle (`help`), and debug mode (`debug`). All parameters SHALL have sensible defaults.

#### Scenario: Custom command names
- **WHEN** the URL includes `?add=task&done=finish`
- **THEN** the widget responds to `!task` for adding and `!finish` for completing

#### Scenario: Custom colors
- **WHEN** the URL includes `?bg=rgba(0,0,0,0.5)&fg=yellow`
- **THEN** the widget renders with the specified background and text colors

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
