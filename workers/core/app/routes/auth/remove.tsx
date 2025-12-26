import type { Route } from './+types/remove';
import { cloudflareEnvironmentContext } from '@/context';
import {
  type TokenData,
  tokenDataKeyPrefix,
  twitchDataKeyPrefix,
  type TwitchUserData,
} from '@/lib/twitch-data';

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.get(cloudflareEnvironmentContext);

  const content = (await request.json()) as
    | { username?: string; token?: string }
    | undefined;
  const username = content?.username;
  const token = content?.token;

  if (!username) {
    return Response.json({ error: 'No username provided' }, { status: 400 });
  }

  if (!token) {
    return Response.json({ error: 'No token provided' }, { status: 400 });
  }

  const tokenKey = `${tokenDataKeyPrefix}${token}`;
  const tokenLookup = await env.PVTCH_ACCOUNTS.get<TokenData>(tokenKey);

  if (!tokenLookup) {
    return Response.json({ error: 'Invalid token' }, { status: 400 });
  }

  const twitchDataKey = `${twitchDataKeyPrefix}${tokenLookup}`;
  const twitchData = await env.PVTCH_ACCOUNTS.get<TwitchUserData>(
    twitchDataKey,
    'json'
  );

  if (
    !twitchData ||
    twitchData.login.toLocaleLowerCase() !== username.toLocaleLowerCase()
  ) {
    return Response.json(
      { error: 'Username does not match token' },
      { status: 400 }
    );
  }

  // delete both entries
  await env.PVTCH_ACCOUNTS.delete(tokenKey);
  await env.PVTCH_ACCOUNTS.delete(twitchDataKey);

  return Response.json({ success: true, message: 'Authentication removed' });
}
