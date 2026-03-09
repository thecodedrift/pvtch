## MODIFIED Requirements

### Requirement: Token validation

The system SHALL provide an `isValidToken` function that looks up `token-data-{token}` in KV and returns the associated Twitch user ID, or `undefined` if the token is invalid or missing. Token validation SHALL be performed centrally in React Router middleware (`app/middleware/auth.ts`) instead of in individual route loaders. The middleware SHALL set `userContext` with the authenticated user's data, and `instanceAccessContext` with authorization state.

#### Scenario: Valid token

- **WHEN** a request arrives with a valid `pvtch_token` cookie
- **THEN** the middleware resolves the user, sets `userContext` with `{ id, login, displayName }`, and loaders access user data via `context.get(userContext)`

#### Scenario: Invalid or missing token

- **WHEN** a request arrives without a `pvtch_token` cookie or with an invalid token
- **THEN** the middleware does not set `userContext`, and `context.get(userContext)` returns `undefined` in loaders

### Requirement: Login UI component

The system SHALL provide a `TwitchLogin` component that renders a Twitch-branded login button when unauthenticated, and a logout button when authenticated. Login navigates to `/auth/start`. Logout removes the `pvtch_token` cookie and reloads the page. On a private instance, when the user is logged in but not authorized, the component SHALL display an `X` icon instead of the Twitch icon, and the username SHALL link to `/private` instead of opening a dropdown.

#### Scenario: Unauthenticated user

- **WHEN** no `pvtch_token` cookie is present
- **THEN** the component renders a purple Twitch-branded "Login With Twitch" button linking to `/auth/start`

#### Scenario: Authenticated and authorized user

- **WHEN** a `pvtch_token` cookie is present and the user is authorized (or the instance is open)
- **THEN** the component renders the Twitch icon with the display name and a sign-out dropdown

#### Scenario: Authenticated but unauthorized user on private instance

- **WHEN** a `pvtch_token` cookie is present but the user is not on the allow list
- **THEN** the component renders an `X` icon with the display name as a link to `/private`
