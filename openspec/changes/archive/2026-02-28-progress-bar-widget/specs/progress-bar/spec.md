## ADDED Requirements

### Requirement: Progress bar configuration options
The system SHALL support the following configuration options for each progress bar: background color (`bg`), foreground gradient color 1 (`fg1`), foreground gradient color 2 (`fg2`), goal amount (`goal`, minimum 1), goal text (`text`), value prefix (`prefix`), and decimal places (`decimal`). Default values SHALL be: bg=#000000, fg1=#ffffff, fg2=#ffffff, goal=100, text=empty, prefix=empty, decimal=0.

#### Scenario: Default configuration
- **WHEN** no configuration has been saved for a progress bar
- **THEN** the system uses the default values for all options

#### Scenario: Partial configuration
- **WHEN** a saved configuration is missing some fields
- **THEN** the missing fields fall back to their default values

### Requirement: Multiple named progress bars
The system SHALL support multiple named progress bars per user, identified by a name parameter in the URL. The default name SHALL be `default`. Each named bar has independent configuration and progress values.

#### Scenario: Accessing different bars
- **WHEN** a user creates bars named `subs` and `donations`
- **THEN** each bar has its own configuration and progress value

#### Scenario: Dashboard ID switching
- **WHEN** a user changes the ID in the dashboard UI
- **THEN** the page reloads with the configuration for the selected bar name

### Requirement: Configuration dashboard
The system SHALL provide a dashboard page at `/widgets/progress` where authenticated users can configure their progress bar appearance with a live preview. The dashboard SHALL require authentication and display a login prompt for unauthenticated users.

#### Scenario: Authenticated user configures bar
- **WHEN** an authenticated user visits `/widgets/progress`
- **THEN** the existing configuration is loaded and displayed in an editable form with a live preview

#### Scenario: Save configuration
- **WHEN** a user submits the configuration form
- **THEN** the configuration is saved to a Durable Object with a 30-day TTL using PRESERVE_ON_FETCH strategy

#### Scenario: Unauthenticated user
- **WHEN** an unauthenticated user visits `/widgets/progress`
- **THEN** the system displays a login prompt via RequireTwitchLogin

### Requirement: OBS browser source display
The system SHALL provide an embeddable page at `/sources/progress/:token/:name` that renders the progress bar. The page SHALL poll for updates every 3 seconds. Invalid tokens SHALL display an error message.

#### Scenario: Valid token loads progress
- **WHEN** an OBS browser source loads `/sources/progress/:token/:name` with a valid token
- **THEN** the progress bar renders with the saved configuration and current progress value

#### Scenario: Auto-refresh
- **WHEN** the OBS source is active
- **THEN** it polls every 3 seconds for updated progress values and re-renders

#### Scenario: Invalid token
- **WHEN** the token in the URL is invalid
- **THEN** the page displays "Invalid token" with HTTP 400

### Requirement: Progress value get API
The system SHALL provide a GET endpoint at `/progress/:token/:name/get` that returns the current progress value as JSON `{ _: value }`. Invalid tokens SHALL return HTTP 400.

#### Scenario: Get current value
- **WHEN** a GET request is made to `/progress/:token/:name/get` with a valid token
- **THEN** the system returns the current progress value as JSON

#### Scenario: Invalid token on get
- **WHEN** a GET request is made with an invalid token
- **THEN** the system returns HTTP 400 with `{ error: "Invalid token" }`

### Requirement: Progress value set API
The system SHALL provide a set endpoint at `/progress/:token/:name/set` that accepts a numeric value. The endpoint SHALL support both GET (value via `?value=` query param) and POST (value via JSON body `{ value }`). The value MUST be a valid number (validated via Zod). The updated value is stored in a Durable Object.

#### Scenario: Set via GET query param
- **WHEN** a GET request is made to `/progress/:token/:name/set?value=42`
- **THEN** the progress value is updated to 42 and the response returns `{ _: "42" }`

#### Scenario: Set via POST body
- **WHEN** a POST request is made with JSON body `{ "value": "42" }`
- **THEN** the progress value is updated to 42

#### Scenario: Invalid value
- **WHEN** a non-numeric value is provided
- **THEN** the system returns HTTP 400 with `{ error: "Invalid progress value" }`

#### Scenario: Invalid token on set
- **WHEN** the token is invalid
- **THEN** the system returns HTTP 400 with `{ error: "Invalid token" }`

### Requirement: Visual rendering with adaptive text
The progress bar component SHALL render a horizontal bar with a gradient fill from fg1 to fg2 representing the percentage complete (progress/goal * 100, capped at 100%). Text SHALL display the goal name and current progress value (with prefix and decimal formatting). When the filled portion is too narrow to contain the text, the text SHALL be repositioned to avoid clipping.

#### Scenario: Partial fill
- **WHEN** progress is 64 and goal is 100
- **THEN** the bar fills 64% with the gradient and 36% with the background color

#### Scenario: Text repositioning
- **WHEN** the filled portion is narrower than the text content
- **THEN** the text shifts from right-aligned to left-aligned (pinned) and swaps color/stroke for readability

#### Scenario: Full screen vs embedded
- **WHEN** the component is rendered as an OBS source (not embedded)
- **THEN** it uses full viewport height and width
- **WHEN** rendered embedded in the dashboard preview
- **THEN** it uses its container's dimensions

### Requirement: Dashboard URL display
The dashboard SHALL display the OBS browser source URL and the update API URL. Both URLs SHALL be masked as password fields to prevent accidental exposure on stream.

#### Scenario: URLs displayed after save
- **WHEN** an authenticated user views the progress bar dashboard
- **THEN** the OBS source URL and API update URL are shown in read-only password-masked input fields
