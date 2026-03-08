import type { Route } from './+types/lingo.config.$token.set';
import { cloudflareEnvironmentContext } from '@/context';
import { isValidToken } from '@/lib/twitch-data';
import { lingoConfig } from '@/lib/constants/lingo';

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

  const value =
    typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue);

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

  const parsed = JSON.parse(value) as { bots: string[]; language: string };
  const stub = env.PVTCH_USER.get(
    env.PVTCH_USER.idFromName(`twitch:${userid}`)
  );
  using lingoPlugin = await stub.lingo();
  await lingoPlugin.setConfig(parsed);

  return Response.json(parsed);
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
