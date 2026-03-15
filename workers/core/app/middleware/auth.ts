import type { RouterContextProvider } from 'react-router';
import {
  cloudflareEnvironmentContext,
  userContext,
  instanceAccessContext,
} from '@/context';
import {
  isValidToken,
  twitchDataKeyPrefix,
  type TwitchUserData,
} from '@/lib/twitch-data';

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [key, ...val] = c.trim().split('=');
      return [key, val.join('=')];
    })
  );
}

function parseAllowedUsers(envValue: string): string[] {
  if (!envValue || envValue.length === 0) return [];
  return envValue
    .split(',')
    .map((u) => u.trim().toLowerCase())
    .filter((u) => u.length > 0);
}

export async function authMiddleware(
  {
    request,
    context,
  }: { request: Request; context: Readonly<RouterContextProvider> },
  next: () => Promise<Response>
): Promise<Response | void> {
  const env = context.get(cloudflareEnvironmentContext);
  const cookies = parseCookies(request.headers.get('Cookie'));
  const token = cookies['pvtch_token'];

  // Resolve user from token
  let authenticatedUser: TwitchUserData | undefined;
  const twitchId = await isValidToken(token, env);
  if (twitchId && token) {
    const userData = await env.PVTCH_ACCOUNTS.get<TwitchUserData>(
      `${twitchDataKeyPrefix}${twitchId}`,
      'json'
    );
    if (userData) {
      authenticatedUser = userData;
      context.set(userContext, {
        id: userData.id,
        login: userData.login,
        displayName: userData.display_name,
        token: userData.token,
      });
    }
  }

  // Compute instance access
  const allowedUsers = parseAllowedUsers(env.ALLOWED_USERS);
  const isPrivate = allowedUsers.length > 0;
  const isAllowed =
    !isPrivate ||
    (!!authenticatedUser &&
      allowedUsers.includes(authenticatedUser.login.toLowerCase()));

  context.set(instanceAccessContext, { isPrivate, isAllowed });

  return next();
}
