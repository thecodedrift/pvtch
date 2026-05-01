import type { Route } from './+types/lingo.config.$token.set';
import { v4 } from 'uuid';
import { cloudflareEnvironmentContext } from '@/context';
import { resolveTokenUser } from '@/lib/twitch-data';
import { lingoConfig } from '@/lib/constants/lingo';
import { createLogger } from '@/lib/logger';

async function handleConfigSet(
  token: string,
  rawValue: string,
  env: Env
): Promise<Response> {
  const logger = createLogger({
    feature: 'lingo:config',
    requestId: v4(),
    redactTokens: [token],
  });

  const resolved = await resolveTokenUser(token, env);

  if (!resolved) {
    logger.warn('Invalid token for lingo config set');
    return Response.json(
      { op: 'token.lingo.config.set', error: 'Invalid token' },
      { status: 400 }
    );
  }

  const log = logger
    .withTag(`uid:${resolved.userId}`)
    .withTag(resolved.displayName ? `@${resolved.displayName}` : '');

  const value =
    typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue);

  try {
    const result = lingoConfig.safeParse(JSON.parse(value) as unknown);
    if (!result.success) {
      log.warn('Invalid lingo config set attempt', {
        errors: result.error,
      });
      return Response.json(
        { op: 'token.lingo.config.set', error: 'Invalid lingo config' },
        { status: 400 }
      );
    }
  } catch (error) {
    log.warn('Error parsing lingo config set attempt', { error });
    return Response.json(
      { op: 'token.lingo.config.set', error: 'Invalid lingo config' },
      { status: 400 }
    );
  }

  const parsed = JSON.parse(value) as { bots: string[]; language: string };
  const stub = env.PVTCH_USER.get(
    env.PVTCH_USER.idFromName(`twitch:${resolved.userId}`)
  );
  using lingoPlugin = await stub.lingo();
  await lingoPlugin.setConfig(parsed);

  log.info('Lingo config updated', { config: parsed });

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
