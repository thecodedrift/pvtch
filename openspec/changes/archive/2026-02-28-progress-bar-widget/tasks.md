## 1. Data Types & Validation

- [x] 1.1 Create `app/components/progress-bar/options.ts` with `Options` type and default values
- [x] 1.2 Create `app/lib/constants/progress.ts` with Zod validation schema for progress values

## 2. Progress Bar Component

- [x] 2.1 Create `app/components/progress-bar/index.tsx` with `BasicBar` component rendering gradient fill, goal text, and progress numbers
- [x] 2.2 Implement ResizeObserver-based text repositioning that swaps alignment and colors when text overflows the filled area
- [x] 2.3 Support both embedded (dashboard preview) and full-screen (OBS source) modes via `embedded` prop

## 3. Configuration Dashboard

- [x] 3.1 Create `app/routes/widgets/progress.tsx` with loader that reads config from Durable Object using cookie-based auth
- [x] 3.2 Implement action handler that saves config to Durable Object with PRESERVE_ON_FETCH TTL (30 days)
- [x] 3.3 Build TanStack Form-based configuration UI with fields for bg, fg1, fg2, goal, text, prefix, decimal
- [x] 3.4 Add sticky live preview that updates as form values change
- [x] 3.5 Add ID selector for switching between named progress bars
- [x] 3.6 Display OBS source URL and API update URL in password-masked fields
- [x] 3.7 Gate page behind authentication with RequireTwitchLogin fallback

## 4. OBS Browser Source

- [x] 4.1 Create `app/routes/sources/progress.$token.$name.tsx` that loads config and progress value from Durable Objects
- [x] 4.2 Implement 3-second polling via React Router revalidator for live updates
- [x] 4.3 Handle invalid tokens with error display

## 5. REST API

- [x] 5.1 Create `app/routes/progress.$token.$name.get.tsx` with loader returning current progress value as JSON
- [x] 5.2 Create `app/routes/progress.$token.$name.set.tsx` with GET (query param) and POST (JSON body) support for setting values
- [x] 5.3 Add Zod validation to reject non-numeric progress values with HTTP 400
- [x] 5.4 Validate token on all API routes, returning HTTP 400 for invalid tokens
