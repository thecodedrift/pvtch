import type { Route } from './+types/progress.$token.$name.get';
import { cloudflareEnvironmentContext } from '@/context';
import { isValidToken } from '@/lib/twitch-data';

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = context.get(cloudflareEnvironmentContext);
  const { token, name } = params;

  const userid = await isValidToken(token, env);

  if (!userid) {
    return Response.json({ error: 'Invalid token' }, { status: 400 });
  }

  const stub = env.PVTCH_USER.get(
    env.PVTCH_USER.idFromName(`twitch:${userid}`)
  );

  using progressPlugin = await stub.progress();
  const value = await progressPlugin.get(name);

  return Response.json({ _: value ?? '' });
}
