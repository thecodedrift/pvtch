import { createContext } from 'react-router';

/**
 * Context for Cloudflare environment bindings.
 * Set in the request handler, accessible in loaders/actions/middleware.
 */
export const cloudflareEnvironmentContext = createContext<Env>();

/**
 * Context for Cloudflare execution context.
 * Set in the request handler, accessible in loaders/actions/middleware.
 */
export const cloudflareExecutionContext = createContext<ExecutionContext>();

/**
 * Context for storing authenticated user data from Twitch.
 * Use context.get(userContext) in loaders/actions to access the authenticated user.
 */
export interface TwitchUser {
  id: string;
  login: string;
  displayName: string;
  token: string;
}

export const userContext = createContext<TwitchUser | null>(null);

/**
 * Context for instance-level access control.
 * Set in auth middleware, accessible in loaders/actions.
 */
export interface InstanceAccess {
  isPrivate: boolean; // ALLOWED_USERS is set and non-empty
  isAllowed: boolean; // user is on the allow list (or instance is open)
}

export const instanceAccessContext = createContext<InstanceAccess>();
