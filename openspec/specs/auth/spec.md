# auth Specification

## Purpose
Twitch OAuth 2.0 authentication with token-based sessions, dual KV storage, cookie management, login/logout flows, and auth guard components.
## Requirements
### Requirement: OAuth login initiation
The system SHALL redirect users to the Twitch OAuth 2.0 authorization endpoint when they visit `/auth/start`. The redirect SHALL include `client_id`, `response_type=code`, and `redirect_uri` parameters. No OAuth scopes are requested.

#### Scenario: User clicks login
- **WHEN** a user navigates to `/auth/start`
- **THEN** the system redirects to `https://id.twitch.tv/oauth2/authorize` with the correct query parameters

### Requirement: OAuth callback token exchange
The system SHALL exchange the authorization code for a Twitch access token by POSTing to `https://id.twitch.tv/oauth2/token` with `client_id`, `client_secret`, `code`, `grant_type=authorization_code`, and `redirect_uri`.

#### Scenario: Successful token exchange
- **WHEN** Twitch redirects to `/auth/callback` with a valid `code` parameter
- **THEN** the system exchanges the code for an access token via the Twitch token endpoint

#### Scenario: Twitch returns an error
- **WHEN** Twitch redirects to `/auth/callback` with an `error` parameter
- **THEN** the system redirects to `/auth/error` with the error details as query parameters

#### Scenario: Missing code parameter
- **WHEN** a request arrives at `/auth/callback` without a `code` or `error` parameter
- **THEN** the system returns HTTP 400

### Requirement: User data retrieval
The system SHALL fetch the authenticated user's profile from `https://api.twitch.tv/helix/users` using the exchanged access token. Only `id`, `login`, and `display_name` are persisted.

#### Scenario: Fetch user profile
- **WHEN** a valid access token is obtained
- **THEN** the system fetches user data from the Twitch Helix API and extracts id, login, and display_name

### Requirement: Token generation
The system SHALL generate a 22-character Base58-encoded token from 16 cryptographically random bytes. Tokens are padded to exactly 22 characters.

#### Scenario: New token creation
- **WHEN** a new user completes OAuth for the first time
- **THEN** a unique 22-character Base58 token is generated using `crypto.getRandomValues`

### Requirement: Dual KV storage
The system SHALL store two entries in the `PVTCH_ACCOUNTS` KV namespace per user:
1. `twitch-data-{twitchId}` → JSON containing `{ id, login, display_name, token }`
2. `token-data-{token}` → the Twitch user ID as a plain string

#### Scenario: New user registration
- **WHEN** a user completes OAuth and no existing `twitch-data-{id}` entry exists
- **THEN** the system creates both KV entries with the generated token

#### Scenario: Returning user login
- **WHEN** a user completes OAuth and an existing `twitch-data-{id}` entry is found
- **THEN** the system reuses the existing token and updates the `token-data-{token}` entry, preserving the user's existing widget configurations

### Requirement: Session cookie
The system SHALL set a `pvtch_token` cookie after successful authentication. The cookie SHALL use `Path=/`, `SameSite=Lax`. In production, it SHALL include `Secure` and `Domain=pvtch.com`. After setting the cookie, the system redirects to `/welcome`.

#### Scenario: Cookie set on login
- **WHEN** a user successfully authenticates (new or returning)
- **THEN** a `pvtch_token` cookie is set via `Set-Cookie` header and the user is redirected to `/welcome`

#### Scenario: Localhost development
- **WHEN** the app domain is `localhost`
- **THEN** the cookie omits `Secure` and `Domain` attributes

### Requirement: Token validation
The system SHALL provide an `isValidToken` function that looks up `token-data-{token}` in KV and returns the associated Twitch user ID, or `undefined` if the token is invalid or missing.

#### Scenario: Valid token
- **WHEN** `isValidToken` is called with a token that exists in KV
- **THEN** it returns the associated Twitch user ID

#### Scenario: Invalid or missing token
- **WHEN** `isValidToken` is called with a token that does not exist in KV, or with `undefined`
- **THEN** it returns `undefined`

### Requirement: Account removal
The system SHALL allow users to remove their account by POSTing to `/auth/remove` with `{ username, token }` in the JSON body. The system SHALL verify the token is valid and the username matches before deleting both KV entries.

#### Scenario: Successful removal
- **WHEN** a valid token and matching username are provided
- **THEN** both `twitch-data-{id}` and `token-data-{token}` KV entries are deleted and the system returns `{ success: true }`

#### Scenario: Missing username or token
- **WHEN** the request body is missing `username` or `token`
- **THEN** the system returns HTTP 400 with an error message

#### Scenario: Username mismatch
- **WHEN** a valid token is provided but the username does not match (case-insensitive)
- **THEN** the system returns HTTP 400 with "Username does not match token"

### Requirement: Login UI component
The system SHALL provide a `TwitchLogin` component that renders a Twitch-branded login button when unauthenticated, and a logout button when authenticated. Login navigates to `/auth/start`. Logout removes the `pvtch_token` cookie and reloads the page.

#### Scenario: Unauthenticated user
- **WHEN** no `pvtch_token` cookie is present
- **THEN** the component renders a purple Twitch-branded "Login With Twitch" button linking to `/auth/start`

#### Scenario: Authenticated user
- **WHEN** a `pvtch_token` cookie is present
- **THEN** the component renders a "Logout" button that removes the cookie and reloads

### Requirement: Auth guard component
The system SHALL provide a `RequireTwitchLogin` component that displays a prompt to log in, embedding the `TwitchLogin` component. This is used on pages that require authentication.

#### Scenario: Protected page without auth
- **WHEN** a user visits a protected page without being logged in
- **THEN** the `RequireTwitchLogin` component renders with a login prompt and the Twitch login button

