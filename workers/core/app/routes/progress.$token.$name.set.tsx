import type { Route } from './+types/progress.$token.$name.set';
import { cloudflareEnvironmentContext } from '@/context';
import { normalizeKey } from '@/lib/normalize-key';
import { isValidToken } from '@/lib/twitch-data';
import { PROGRESS_KEY, progressValue } from '@/lib/constants/progress';

async function handleProgressSet(
  token: string,
  name: string,
  rawValue: string,
  env: Env
): Promise<Response> {
  const userid = await isValidToken(token, env);

  if (!userid) {
    return Response.json({ error: 'Invalid token' }, { status: 400 });
  }

  const fqn = `${PROGRESS_KEY}::${name}`;
  const normalizedKey = normalizeKey(token, fqn);
  const value =
    typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue);
  const cdo: DurableObjectId = env.PVTCH_BACKEND.idFromName(normalizedKey);
  const stub = env.PVTCH_BACKEND.get(cdo);

  const parsed = progressValue.safeParse(Number(value));
  if (!parsed.success) {
    console.log('Invalid progress value set attempt', { errors: parsed.error });
    return Response.json({ error: 'Invalid progress value' }, { status: 400 });
  }

  // stubs hold their own storage per stub via sqlite
  await stub.set(value);

  return Response.json({ _: value });
}

// GET request - value from query params
export async function loader({ params, request, context }: Route.LoaderArgs) {
  const env = context.get(cloudflareEnvironmentContext);
  const { token, name } = params;

  const url = new URL(request.url);
  const rawValue = url.searchParams.get('value') ?? '';

  return handleProgressSet(token, name, rawValue, env);
}

// POST request - value from body
export async function action({ params, request, context }: Route.ActionArgs) {
  const env = context.get(cloudflareEnvironmentContext);
  const { token, name } = params;

  const content = (await request.json().catch(() => ({}))) as
    | { value?: string }
    | undefined;
  const rawValue = content?.value ?? '';

  return handleProgressSet(token, name, rawValue, env);
}
