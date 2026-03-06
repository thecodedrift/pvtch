# 1s-chat-poll Specification

## Purpose

Real-time chat-based quick-polling OBS overlay ("1s in chat") with timed voting rounds, bar chart results, mod controls, and customizable appearance.

## Requirements

### Requirement: Chat-based voting

The system SHALL treat the first word of any chat message as a vote. In numeric mode, votes SHALL be normalized: repeated digits ("1111" → "1"), decimal numbers truncated to integer, and non-numeric strings ignored. In choice-list mode, only votes matching a predefined option (case-insensitive) SHALL be accepted.

#### Scenario: Numeric vote

- **WHEN** a viewer types "2" in chat during a voting phase
- **THEN** a vote for option "2" is recorded

#### Scenario: Meme-format number

- **WHEN** a viewer types "1111111" in chat
- **THEN** it is normalized to "1" and a vote for option "1" is recorded

#### Scenario: Choice-list vote

- **WHEN** choices are set to "pizza, tacos, sushi" and a viewer types "PIZZA"
- **THEN** a vote for "pizza" is recorded (case-insensitive match)

#### Scenario: Invalid vote in choice mode

- **WHEN** choices are set and a viewer types something not in the list
- **THEN** the message is ignored (no vote recorded)

### Requirement: Voting lifecycle

The system SHALL implement a three-phase lifecycle: (1) **Ready** — waiting for first vote, (2) **Voting** — timer counting down, votes accepted, (3) **Locked** — results frozen for cooldown period. The timer SHALL auto-start when the first vote is received.

#### Scenario: First vote starts timer

- **WHEN** the system is in "ready" state and a viewer casts a vote
- **THEN** the timer starts counting down and the state transitions to "voting"

#### Scenario: Timer expires

- **WHEN** the voting duration elapses
- **THEN** the state transitions to "locked" and no new votes are accepted

#### Scenario: Cooldown ends

- **WHEN** the cooldown period elapses after locking
- **THEN** the state returns to "ready" and all votes are cleared for the next round

### Requirement: Vote deduplication

The system SHALL track which users have voted. When repeat mode is disabled (default), each user SHALL be allowed exactly one vote per round. When repeat mode is enabled, users SHALL be allowed to change their vote.

#### Scenario: Single vote mode

- **WHEN** repeat is disabled and a user tries to vote twice
- **THEN** the second vote is ignored

#### Scenario: Repeat vote mode

- **WHEN** repeat is enabled and a user votes again
- **THEN** the new vote is counted (adding to the total)

### Requirement: Mod configuration commands

The system SHALL accept `!1s` prefixed commands from moderators and broadcasters only. Supported subcommands: `timer {duration}/{cooldown}`, `vote one|many`, `list {comma-separated choices}`, `reset`. All configuration changes SHALL reset current vote state.

#### Scenario: Set timer

- **WHEN** a moderator sends `!1s timer 30/15`
- **THEN** the voting duration is set to 30 seconds and cooldown to 15 seconds, and votes are reset

#### Scenario: Set vote mode

- **WHEN** a moderator sends `!1s vote many`
- **THEN** repeat voting is enabled and votes are reset

#### Scenario: Set choice list

- **WHEN** a moderator sends `!1s list pizza, tacos, sushi`
- **THEN** only those choices are accepted as valid votes, and votes are reset

#### Scenario: Clear choice list

- **WHEN** a moderator sends `!1s list` with no options
- **THEN** the choice list is cleared (returns to numeric mode)

#### Scenario: Reset votes

- **WHEN** a moderator sends `!1s reset`
- **THEN** all votes, voters, and the timer are cleared

#### Scenario: Non-mod command attempt

- **WHEN** a regular viewer sends `!1s reset`
- **THEN** the command is ignored

### Requirement: Bar chart display

The system SHALL display the top 4 vote options as horizontal bars sorted by vote count (descending). Each bar SHALL show the option label, vote count in parentheses, and a proportional width based on its share of total votes. Bars SHALL use CSS transitions for smooth animation.

#### Scenario: Multiple options

- **WHEN** option "1" has 5 votes and option "2" has 3 votes out of 8 total
- **THEN** option "1" bar fills 62.5% width and option "2" fills 37.5% width

#### Scenario: Locked state display

- **WHEN** voting is locked
- **THEN** the winning option (index 0) displays at full opacity while other options display at 50% opacity

### Requirement: Timer and status indicators

The system SHALL display a countdown timer during the voting phase and a lock icon during the locked phase. No indicator is shown during the ready phase.

#### Scenario: Voting phase display

- **WHEN** the system is in "voting" state
- **THEN** a timer icon and remaining seconds countdown are displayed

#### Scenario: Locked phase display

- **WHEN** the system is in "locked" state
- **THEN** a lock icon is displayed

### Requirement: Choice list display

When predefined choices are configured, the system SHALL display the available options as chips/badges at the top of the overlay so viewers know what to type.

#### Scenario: Choices configured

- **WHEN** the `choices` parameter includes options
- **THEN** each choice is displayed as a badge at the top of the widget

### Requirement: Customizable appearance

The system SHALL accept URL query parameters for: background color (`bg`), text color (`text`), bar color (`bar`), voting duration in seconds (`duration`, default 60), cooldown in seconds (`cooldown`, default 30), repeat voting (`repeat`, default false), choice list (`choices`, comma-separated), and callback URL (`callback`, validated as URL).

#### Scenario: Custom colors

- **WHEN** the URL includes `?bg=black&bar=red&text=white`
- **THEN** the widget renders with the specified colors

#### Scenario: Default parameters

- **WHEN** no URL parameters are set
- **THEN** defaults are used: bg=rgb(34,34,34), bar=rgb(216,228,103), text=white, duration=60, cooldown=30, repeat=false

### Requirement: Demo mode

The system SHALL accept a `demo` URL query parameter. When `demo=true`, the system SHALL NOT initialize a Twitch chat connection. Instead, it SHALL display a play button in the bottom-right corner of the overlay. The demo SHALL override duration to 10 seconds and cooldown to 5 seconds regardless of other parameter values.

#### Scenario: Demo mode disables chat

- **WHEN** the overlay loads with `?demo=true`
- **THEN** no Twitch chat connection is established and a play button is visible

#### Scenario: Play triggers simulation

- **WHEN** the user clicks the play button in demo mode
- **THEN** simulated votes trickle in over approximately 3 seconds, the 10-second voting timer counts down, the display locks for 5 seconds showing results, and then all state resets to ready

#### Scenario: Demo resets to ready

- **WHEN** the demo simulation completes (voting + cooldown)
- **THEN** all votes, voters, and the timer are cleared, and the play button is available again

#### Scenario: Demo respects appearance params

- **WHEN** the overlay loads with `?demo=true&bg=black&bar=red`
- **THEN** the demo renders with the specified colors

### Requirement: Configuration form

The system SHALL provide a configuration page at `/widgets/1s` with form fields for: background color, text color, bar color, vote duration, cooldown duration, repeat voting toggle, and choices list. All fields SHALL have default values matching the overlay defaults. Changes to form fields SHALL immediately update the generated URL and iframe preview.

#### Scenario: Default form state

- **WHEN** the user visits `/widgets/1s` with no prior input
- **THEN** all form fields display the overlay defaults (bg: rgb(34,34,34), text: white, bar: rgb(216,228,103), duration: 60, cooldown: 30, repeat: off, choices: empty)

#### Scenario: Changing a color field

- **WHEN** the user changes the bar color to "red"
- **THEN** the generated URL includes `bar=red` and the iframe preview updates to show red bars

#### Scenario: Setting choices

- **WHEN** the user enters "pizza, tacos, sushi" in the choices field
- **THEN** the generated URL includes `choices=pizza%2Ctacos%2Csushi` and the iframe preview shows choice badges

### Requirement: Channel name input

The system SHALL provide a channel name text input. If the user is logged in via Twitch, the field SHALL be pre-filled with their Twitch username. The field SHALL always be editable regardless of login state. The channel name SHALL be used as the path parameter in the generated URL.

#### Scenario: Logged in user

- **WHEN** a user with Twitch username "streamerguy" visits the page while logged in
- **THEN** the channel name field is pre-filled with "streamerguy"

#### Scenario: Not logged in

- **WHEN** a user visits the page without being logged in
- **THEN** the channel name field is empty and the user types their channel name manually

#### Scenario: Channel name in URL

- **WHEN** the channel name is "mychannel"
- **THEN** the generated OBS URL uses the path `/sources/1s/mychannel`

### Requirement: URL generation and copy

The system SHALL display a read-only text field showing the complete OBS browser source URL constructed from the current form state. The URL SHALL include only parameters that differ from defaults. A copy button SHALL copy the URL to the clipboard.

#### Scenario: URL with custom parameters

- **WHEN** the user sets duration to 45 and bar color to "red", with all other fields at defaults
- **THEN** the displayed URL is `/sources/1s/{channel}?duration=45&bar=red`

#### Scenario: Copy to clipboard

- **WHEN** the user clicks the copy button
- **THEN** the OBS URL is copied to the clipboard and a success toast is shown

### Requirement: Live iframe preview

The system SHALL display a sticky preview area containing an iframe that loads the overlay with the current form parameters plus `demo=true`. The iframe src SHALL update when form values change. The preview SHALL show the overlay exactly as it will appear in OBS.

#### Scenario: Preview reflects form state

- **WHEN** the user changes the background color to "black"
- **THEN** the iframe reloads with `bg=black` and the preview shows a black background

#### Scenario: Demo mode in preview

- **WHEN** the preview iframe loads
- **THEN** it includes `demo=true` in the URL and shows a play button instead of connecting to chat

### Requirement: How-to guide

The system SHALL display an inline guide below the URL output with four sections: (1) how to add to OBS as a browser source with recommended dimensions, (2) how viewers vote (numbers or choices in chat, meme format support), (3) mod commands reference (`!1s timer`, `!1s vote`, `!1s list`, `!1s reset`), and (4) tips for effective use.

#### Scenario: Guide is visible

- **WHEN** the user scrolls below the URL output
- **THEN** all four guide sections are visible with concise, scannable content

#### Scenario: Mod commands reference

- **WHEN** the user reads the mod commands section
- **THEN** they see the command format and effect for timer, vote, list, and reset commands
