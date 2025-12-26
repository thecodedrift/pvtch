import type { Route } from './+types/lingo.config.$token.set';
import { cloudflareEnvironmentContext } from '@/context';
import { normalizeKey } from '@/lib/normalize-key';
import { isValidToken } from '@/lib/twitch-data';
import type { TTLOptions } from '@@/do/backend';
import { lingoConfig } from '@/lib/constants/lingo';

const ID = 'lingo-config';
const TTL_OPTIONS: TTLOptions = {
  strategy: 'PRESERVE_ON_FETCH',
  ttlMs: 30 * 24 * 60 * 60 * 1000, // 30 days
};

async function handleConfigSet(
  token: string,
  rawValue: string,
  env: Env
): Promise<Response> {
  const userid = await isValidToken(token, env);

  if (!userid) {
    return Response.json(
      { op: 'token.lingo.config.set', error: 'Invalid token' },
      { status: 400 }
    );
  }

  const normalizedKey = normalizeKey(token, ID);
  const value =
    typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue);
  const cdo: DurableObjectId = env.PVTCH_BACKEND.idFromName(normalizedKey);
  const stub = env.PVTCH_BACKEND.get(cdo);

  try {
    const result = lingoConfig.safeParse(JSON.parse(value) as unknown);
    if (!result.success) {
      console.log('Invalid lingo config set attempt', { errors: result.error });
      return Response.json(
        { op: 'token.lingo.config.set', error: 'Invalid lingo config' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.log('Error parsing lingo config set attempt', { error: error });
    return Response.json(
      { op: 'token.lingo.config.set', error: 'Invalid lingo config' },
      { status: 400 }
    );
  }

  // stubs hold their own storage per stub via sqlite
  await stub.set(value, TTL_OPTIONS);

  return Response.json(JSON.parse(value) as unknown);
}

// GET request - value from query params
export async function loader({ params, request, context }: Route.LoaderArgs) {
  const env = context.get(cloudflareEnvironmentContext);
  const { token } = params;

  const url = new URL(request.url);
  const rawValue = url.searchParams.get('value') ?? '';

  return handleConfigSet(token, rawValue, env);
}

// POST request - value from body
export async function action({ params, request, context }: Route.ActionArgs) {
  const env = context.get(cloudflareEnvironmentContext);
  const { token } = params;

  const content = (await request.json().catch(() => ({}))) as
    | { value?: string }
    | undefined;
  const rawValue = content?.value ?? '';

  return handleConfigSet(token, rawValue, env);
}
