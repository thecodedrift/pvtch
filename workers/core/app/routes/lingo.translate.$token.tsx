import type { Route } from './+types/lingo.translate.$token';
import { v4 } from 'uuid';
import { cloudflareEnvironmentContext } from '@/context';
import { isValidToken } from '@/lib/twitch-data';
import { normalizeKey } from '@/lib/normalize-key';
import { isSameLanguage, translate } from '@/lib/translator';
import { type LingoConfig } from '@/lib/constants/lingo';
import { knownBots } from '@/lib/known-bots';

const ALWAYS_IGNORED_USERS = new Set(knownBots.map((v) => v.toLowerCase()));

interface TranslateRequestContent {
  message?: string;
  user?: string;
}

async function handleTranslate(
  token: string,
  message: string,
  user: string,
  env: Env
): Promise<Response> {
  const LOG_ID = v4();
  const value = message.trim();
  const userTrimmed = user.trim();

  const log = (msg: string, data?: Record<string, unknown>) => {
    console.log(`[${LOG_ID}] ${msg}`, {
      ...data,
      user: userTrimmed,
      input: value,
    });
  };

  const error = (
    msg: string,
    data?: Record<string, unknown>,
    error?: unknown
  ) => {
    console.error(
      `[${LOG_ID}] ${msg}`,
      {
        ...data,
        user: userTrimmed,
        input: value,
      },
      error
    );
  };

  // skip always ignored users
  if (ALWAYS_IGNORED_USERS.has(userTrimmed.toLowerCase())) {
    log('User is in always ignored bots list');
    return new Response('', { status: 200 });
  }

  if (value.startsWith('!')) {
    log('Command detected, skipping translation');
    return new Response('', { status: 200 });
  }

  if (value.length === 0 || userTrimmed.length === 0) {
    log('Skipped, no message or user');
    return new Response('', { status: 200 });
  }

  if (value.toLowerCase().includes('imtyping')) {
    log('Translation Skip: imtyping');
    return new Response('', { status: 200 });
  }

  if (!value.includes(' ') && value.length <= 6) {
    log('Short single word message, skipping');
    return new Response('', { status: 200 });
  }

  const userid = await isValidToken(token, env);

  if (!userid) {
    log('Invalid token for lingo translate', { token });
    return new Response('', { status: 200 });
  }

  // fetch config from User DO
  const stub = env.PVTCH_USER.get(
    env.PVTCH_USER.idFromName(`twitch:${userid}`)
  );
  using lingoPlugin = await stub.lingo();
  let doConfig = await lingoPlugin.getConfig();

  // Temporary migration: pull from old DO if no config exists yet
  if (!doConfig) {
    try {
      const oldKey = normalizeKey(token, 'lingo-config');
      const oldStub = env.PVTCH_BACKEND.get(
        env.PVTCH_BACKEND.idFromName(oldKey)
      );
      const oldConfigString = await oldStub.get();
      if (oldConfigString && oldConfigString.length > 0) {
        const parsed = JSON.parse(oldConfigString) as {
          bots?: string[];
          language?: string;
        };
        const migrated = {
          bots: [parsed.bots ?? []].flat().filter((v) => v !== undefined),
          language: parsed.language ?? 'english',
        };
        await lingoPlugin.import(migrated);
        doConfig = migrated;
        log('Migrated config from old DO');
      }
    } catch (error_) {
      error('Failed to migrate from old DO', undefined, error_);
    }
  }

  if (!doConfig) {
    log('No lingo config found', { token });
    return new Response('', { status: 200 });
  }

  if (!doConfig.bots || !doConfig.language) {
    log('Incomplete lingo config', { token, doConfig });
    return new Response('', { status: 200 });
  }

  const config: LingoConfig = {
    bots: [...doConfig.bots]
      .filter((v) => v !== undefined)
      .map((v) => v.toLowerCase()),
    language: doConfig.language ?? 'english',
  };

  if (config.bots.includes(userTrimmed.toLowerCase())) {
    // dont reply to ignored bots / users
    log('User is in ignored bots list');
    return new Response('', { status: 200 });
  }

  log('Lingo translate config:', config);

  let result;

  try {
    result = await translate(value, {
      targetLanguage: config.language,
      env: env,
    });
  } catch (error_) {
    error('Lingo translate failed:', undefined, error_);
    return new Response('', { status: 200 });
  }

  if (!result || !result.success) {
    error('Lingo translate failed. No result');
    return new Response('', { status: 200 });
  }

  log('LLM Response:', { ...result });

  if (isSameLanguage(config.language, value, result)) {
    log('No translation needed. Language match');
    return new Response('', { status: 200 });
  }

  if (
    result.data.translation
      .replaceAll(/@[a-z0-9_]+?([^a-z0-9_]|$)/gi, '$1')
      .trim() === ''
  ) {
    log('Translation result is empty after removing usernames');
    return new Response('', { status: 200 });
  }

  const output = `ImTyping ${result.data.translation}`;

  return new Response(output, {
    status: 200,
  });
}

// GET request - params from query
export async function loader({ params, request, context }: Route.LoaderArgs) {
  const env = context.get(cloudflareEnvironmentContext);
  const { token } = params;

  const url = new URL(request.url);
  const message = url.searchParams.get('message') ?? '';
  const user = url.searchParams.get('user') ?? '';

  return handleTranslate(token, message, user, env);
}

// POST request - params from body
export async function action({ params, request, context }: Route.ActionArgs) {
  const env = context.get(cloudflareEnvironmentContext);
  const { token } = params;

  const content = (await request.json().catch(() => ({}))) as
    | TranslateRequestContent
    | undefined;
  const message = String(content?.message ?? '');
  const user = String(content?.user ?? '');

  return handleTranslate(token, message, user, env);
}
