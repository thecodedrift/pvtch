## ADDED Requirements

### Requirement: Inline auth gate component

The system SHALL provide an `<AuthGate>` component that accepts an `authenticated` boolean prop and children. When `authenticated` is true, it SHALL render its children. When `authenticated` is false, it SHALL render a login prompt with trust copy and a Twitch login button.

#### Scenario: Authenticated user sees gated content

- **WHEN** `<AuthGate authenticated={true}>` wraps content
- **THEN** the children are rendered directly with no login prompt

#### Scenario: Unauthenticated user sees login prompt

- **WHEN** `<AuthGate authenticated={false}>` wraps content
- **THEN** the children are NOT rendered and a login prompt is displayed instead

### Requirement: Trust copy in login prompt

The `<AuthGate>` login prompt SHALL include trust copy explaining: (1) login is used only for identification, (2) no Twitch permissions are requested, and (3) only username and a generated token are stored.

#### Scenario: Trust copy is displayed

- **WHEN** an unauthenticated user sees the `<AuthGate>` login prompt
- **THEN** the prompt includes text explaining why login is needed and what data is stored

### Requirement: Login button in auth gate

The `<AuthGate>` login prompt SHALL include a Twitch-branded login button that navigates to `/auth/start`, using the same `<TwitchLogin>` component as the header.

#### Scenario: Login button links to auth start

- **WHEN** an unauthenticated user sees the `<AuthGate>` login prompt
- **THEN** the prompt includes a "Login With Twitch" button linking to `/auth/start`

### Requirement: Progress page open config with gated URLs

The progress bar config page SHALL render all configuration controls (colors, goal, text, preview) without requiring authentication. Only the URL output section (OBS URL, Update API URL) SHALL be wrapped in `<AuthGate>`.

#### Scenario: Unauthenticated user configures progress bar

- **WHEN** an unauthenticated user visits `/widgets/progress`
- **THEN** the live preview, color pickers, goal, text, decimal, and prefix controls are all visible and interactive

#### Scenario: Unauthenticated user cannot see progress URLs

- **WHEN** an unauthenticated user visits `/widgets/progress`
- **THEN** the OBS URL and Update API URL sections are replaced by the `<AuthGate>` login prompt

#### Scenario: Authenticated user sees full progress page

- **WHEN** an authenticated user visits `/widgets/progress`
- **THEN** all config controls AND the URL output section are visible

### Requirement: Lingo page open docs with gated config

The lingo config page SHALL render its description and setup guide (Firebot/MixItUp tabs) without requiring authentication. The config form (bots, language, save) and Translate URL SHALL be wrapped in `<AuthGate>`.

#### Scenario: Unauthenticated user reads lingo docs

- **WHEN** an unauthenticated user visits `/helpers/lingo`
- **THEN** the page title, description, and setup guide with bot integration tabs are visible

#### Scenario: Unauthenticated user cannot access lingo config

- **WHEN** an unauthenticated user visits `/helpers/lingo`
- **THEN** the config form and Translate URL are replaced by the `<AuthGate>` login prompt

#### Scenario: Authenticated user sees full lingo page

- **WHEN** an authenticated user visits `/helpers/lingo`
- **THEN** the description, config form, Translate URL, and setup guide are all visible

### Requirement: Homepage CTA directs to explore

The homepage primary hero CTA SHALL link to `/widgets/progress` with text "Explore Tools" instead of linking to `/auth/start` with "Get Started with Twitch".

#### Scenario: Homepage hero CTA

- **WHEN** a user visits the homepage
- **THEN** the primary CTA button says "Explore Tools" and links to `/widgets/progress`
