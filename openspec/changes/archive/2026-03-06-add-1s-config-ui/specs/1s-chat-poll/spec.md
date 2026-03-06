## ADDED Requirements

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
