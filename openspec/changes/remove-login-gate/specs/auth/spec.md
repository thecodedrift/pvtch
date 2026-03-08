## MODIFIED Requirements

### Requirement: Auth guard component

The system SHALL provide an `<AuthGate>` component (replacing `<RequireTwitchLogin>`) that wraps token-dependent UI sections with an inline login prompt. Pages SHALL NOT use full-page auth blocking — authentication gating is scoped to sections that require a token.

#### Scenario: Protected section without auth

- **WHEN** a user visits a page containing an `<AuthGate>` section without being logged in
- **THEN** the `<AuthGate>` component renders an inline login prompt with trust copy and a Twitch login button, while the rest of the page renders normally

#### Scenario: Protected section with auth

- **WHEN** a user visits a page containing an `<AuthGate>` section while logged in
- **THEN** the `<AuthGate>` component renders its children (the token-dependent content)
