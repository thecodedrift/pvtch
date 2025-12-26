import type { Route } from './+types/progress.$token.$name.get';
import { cloudflareEnvironmentContext } from '@/context';
import { normalizeKey } from '@/lib/normalize-key';
import { isValidToken } from '@/lib/twitch-data';
import { PROGRESS_KEY } from '@/lib/constants/progress';

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = context.get(cloudflareEnvironmentContext);
  const { token, name } = params;

  const userid = await isValidToken(token, env);

  if (!userid) {
    return Response.json({ error: 'Invalid token' }, { status: 400 });
  }

  const fqn = `${PROGRESS_KEY}::${name}`;
  const normalizedKey = normalizeKey(token, fqn);
  const cdo: DurableObjectId = env.PVTCH_BACKEND.idFromName(normalizedKey);
  const stub = env.PVTCH_BACKEND.get(cdo);

  const value = await stub.get();

  return Response.json({ _: value });
}
