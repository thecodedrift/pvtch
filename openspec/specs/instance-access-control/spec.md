# instance-access-control Specification

## Purpose

TBD - created by archiving change lock-instance. Update Purpose after archive.

## Requirements

### Requirement: ALLOWED_USERS environment variable

The system SHALL support an `ALLOWED_USERS` environment variable containing a comma-separated list of Twitch usernames. When set to a non-empty string, the instance SHALL operate in private mode. When empty or unset, the instance SHALL operate as an open instance with no access restrictions.

#### Scenario: Private instance with allowed users

- **WHEN** `ALLOWED_USERS` is set to `"alice,bob,charlie"`
- **THEN** the instance operates in private mode and only users with Twitch logins `alice`, `bob`, or `charlie` are authorized

#### Scenario: Open instance with empty string

- **WHEN** `ALLOWED_USERS` is set to `""`
- **THEN** the instance operates as an open instance with no access restrictions

#### Scenario: Case-insensitive username matching

- **WHEN** `ALLOWED_USERS` is set to `"Alice, BOB"` and a user logs in with Twitch login `alice`
- **THEN** the user is authorized (comparison is case-insensitive and whitespace is trimmed)

### Requirement: Widget editor access restriction

On a private instance, widget editor routes (`/widgets/*`) SHALL redirect unauthorized users to `/private`. An unauthorized user is one who is either not logged in or logged in but not on the allow list.

#### Scenario: Unauthorized user visits widget editor

- **WHEN** a user who is not on the allow list visits `/widgets/progress`
- **THEN** the system redirects to `/private`

#### Scenario: Unauthenticated user visits widget editor on private instance

- **WHEN** an unauthenticated user visits `/widgets/todo` on a private instance
- **THEN** the system redirects to `/private`

#### Scenario: Allowed user visits widget editor

- **WHEN** a user on the allow list visits `/widgets/progress`
- **THEN** the page renders normally

### Requirement: OBS source access restriction

On a private instance, OBS source routes (`/sources/*`) SHALL redirect unauthorized requests to `/private`. The system SHALL resolve the token in the URL to determine the owning user and check against the allow list.

#### Scenario: Source URL with unauthorized token

- **WHEN** an OBS source URL is loaded and the token's owner is not on the allow list
- **THEN** the system redirects to `/private`

#### Scenario: Source URL with authorized token

- **WHEN** an OBS source URL is loaded and the token's owner is on the allow list
- **THEN** the source renders normally

#### Scenario: Source URL with invalid token on private instance

- **WHEN** an OBS source URL is loaded with an invalid token on a private instance
- **THEN** the system redirects to `/private`

### Requirement: Private instance explanation page

The system SHALL provide a `/private` route that explains the instance is restricted. The page SHALL include a link to the deploy-your-own guide.

#### Scenario: User visits /private

- **WHEN** a user navigates to `/private`
- **THEN** the page displays a heading indicating this is a private instance, an explanation that access is restricted, and a link to `/howto/deploy-your-own`

### Requirement: Header UX for unauthorized users

On a private instance, when a user is logged in but not on the allow list, the header SHALL display an `X` icon instead of the Twitch icon. The username SHALL link to `/private` instead of opening a dropdown menu.

#### Scenario: Unauthorized logged-in user sees header

- **WHEN** a logged-in user who is not on the allow list views any page on a private instance
- **THEN** the header shows an `X` icon and their display name as a link to `/private`

#### Scenario: Authorized user sees normal header

- **WHEN** a logged-in user on the allow list views any page on a private instance
- **THEN** the header shows the normal Twitch icon and dropdown menu

### Requirement: Deploy guide lockdown section

The deploy-your-own guide SHALL include a section explaining how to lock down an instance using the `ALLOWED_USERS` environment variable.

#### Scenario: Deploy guide includes lockdown instructions

- **WHEN** a user visits `/howto/deploy-your-own`
- **THEN** the page includes instructions for setting `ALLOWED_USERS` with examples of comma-separated Twitch usernames
