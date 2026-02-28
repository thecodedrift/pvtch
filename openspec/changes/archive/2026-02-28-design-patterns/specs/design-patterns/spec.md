## ADDED Requirements

### Requirement: Route categorization
The system SHALL organize routes into four categories: (1) Dashboard pages under a shared app layout with sidebar, (2) OBS sources without layout wrapper, (3) API endpoints with loader/action only (no component), (4) Auth routes with loader only. Route definitions SHALL be centralized in `app/routes.ts`.

#### Scenario: Dashboard page with layout
- **WHEN** a new dashboard page is added (e.g., `/widgets/newwidget`)
- **THEN** it is nested inside the `app-layout.tsx` layout route and receives the sidebar, header, and navigation

#### Scenario: OBS source without layout
- **WHEN** a new OBS source is added (e.g., `/sources/newwidget/:channel`)
- **THEN** it is defined outside the layout route and renders minimal HTML suitable for OBS browser sources

#### Scenario: API endpoint
- **WHEN** a new API endpoint is added (e.g., `/widget/:token/action`)
- **THEN** it exports only loader/action functions with no default component export

### Requirement: Dual GET/POST API support
API endpoints SHALL support both GET requests (values via query parameters) and POST requests (values via JSON body). A shared handler function SHALL process both methods identically to maximize chatbot compatibility.

#### Scenario: GET request with query params
- **WHEN** a chatbot sends a GET request with values in query parameters
- **THEN** the endpoint processes the request identically to a POST with the same values

#### Scenario: POST request with JSON body
- **WHEN** a client sends a POST request with a JSON body
- **THEN** the endpoint processes the request identically to a GET with the same values as query params

### Requirement: Token-in-URL API authentication
All API endpoints that access user data SHALL include the user's PVTCH token directly in the URL path. The token SHALL be validated against the KV namespace on every request. Invalid tokens SHALL return HTTP 400.

#### Scenario: Valid token in API call
- **WHEN** an API request includes a valid token in the URL path
- **THEN** the request is processed and the appropriate data is returned

#### Scenario: Invalid token in API call
- **WHEN** an API request includes an invalid or missing token
- **THEN** the endpoint returns HTTP 400 with an error message

### Requirement: Fail-safe API responses
API endpoints called by chatbots SHALL return HTTP 200 with an empty body on all error paths. Error details SHALL be logged server-side via `console.error` or `console.log` but SHALL NOT be returned to the client.

#### Scenario: Internal error during API call
- **WHEN** an error occurs while processing a chatbot API request
- **THEN** the endpoint returns HTTP 200 with an empty response body

### Requirement: UI component library conventions
The system SHALL use Radix UI primitives wrapped with TailwindCSS styling via CVA (class-variance-authority). The `cn()` utility (combining `clsx` and `tailwind-merge`) SHALL be used for conditional class composition. The Button component SHALL include an `action` variant using the brand color. Components SHALL support an `asChild` pattern via Radix Slot where applicable.

#### Scenario: Button with brand variant
- **WHEN** a call-to-action button is needed (e.g., "Save")
- **THEN** the `action` variant is used, rendering with the brand color

#### Scenario: Conditional classes
- **WHEN** component styles need to be conditionally applied
- **THEN** the `cn()` utility is used to merge classes with proper Tailwind conflict resolution

### Requirement: App layout structure
Dashboard pages SHALL share a layout providing: (1) a sticky header with logo, GitHub link, theme toggle, and Twitch login button, (2) a collapsible sidebar with categorized navigation sections (Widgets, Helpers, Support), (3) responsive behavior with mobile overlay sidebar. The main content area SHALL be constrained to `max-w-4xl`.

#### Scenario: Desktop navigation
- **WHEN** a user views a dashboard page on desktop
- **THEN** the sidebar is visible alongside the main content

#### Scenario: Mobile navigation
- **WHEN** a user views a dashboard page on mobile
- **THEN** the sidebar is hidden behind a hamburger menu with a backdrop overlay

### Requirement: Theme system
The system SHALL use `next-themes` for class-based dark/light mode switching with dark as the default theme. System theme detection SHALL be enabled. OBS source pages SHALL use the `useNoTheme` hook to disable theme switching and render without theme classes.

#### Scenario: Theme toggle
- **WHEN** a user clicks the theme toggle button
- **THEN** the application switches between dark and light mode

#### Scenario: OBS source rendering
- **WHEN** an OBS source page loads
- **THEN** theme switching is disabled and the page renders without theme classes

### Requirement: Form handling pattern
Dashboard configuration forms SHALL use TanStack React Form for state management combined with React Router's `useFetcher` for submission. The pattern SHALL be: `useForm` for state → `form.handleSubmit` on submit → `fetcher.submit(formData)` for the HTTP request → route action for server-side processing → Durable Object for persistence. Sonner toast notifications SHALL confirm save success.

#### Scenario: Save configuration
- **WHEN** a user submits a configuration form
- **THEN** the form data is serialized, submitted via fetcher, saved to a Durable Object, and a success toast is displayed

### Requirement: Deprecated route handling
Deprecated API routes that have been superseded SHALL return HTTP 410 (Gone) rather than 404, signaling to consumers that the endpoint previously existed but has been replaced.

#### Scenario: Request to deprecated endpoint
- **WHEN** a client requests a deprecated API route
- **THEN** the system returns HTTP 410 Gone

### Requirement: SEO meta tags
Dashboard pages SHALL include structured meta tags: `title`, `description`, `og:title`, and `og:description` via React Router's `meta` export. OBS source pages SHALL include only a minimal title.

#### Scenario: Dashboard page meta
- **WHEN** a search engine or social media platform fetches a dashboard page
- **THEN** the page includes title, description, and Open Graph meta tags
