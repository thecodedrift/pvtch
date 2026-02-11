import type { Route } from './+types/lingo.translate.$token';
import { cloudflareEnvironmentContext } from '@/context';
import { normalizeKey } from '@/lib/normalize-key';
import { isValidToken } from '@/lib/twitch-data';
import MurmurHash3 from 'imurmurhash';
import { normalizeString, translate } from '@/lib/translator';
import { LINGO_KEY, type LingoConfig } from '@/lib/constants/lingo';
import { knownBots } from '@/lib/known-bots';

const CACHE_TIME = 60 * 60 * 24 * 3; // 3 days

// qwen 30b isn't in cf types but is supported
const CURRENT_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8' as keyof AiModels;

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
  const value = message.trim();
  const userTrimmed = user.trim();

  // skip always ignored users
  if (ALWAYS_IGNORED_USERS.has(userTrimmed.toLowerCase())) {
    console.log('User is in always ignored bots list', {
      user: userTrimmed,
      value,
    });
    return new Response('', { status: 200 });
  }

  if (value.startsWith('!')) {
    console.log('Command detected, skipping translation', {
      user: userTrimmed,
      value,
    });
    return new Response('', { status: 200 });
  }

  const normalized = normalizeString(value);
  console.log('incoming lingo translate:', { user: userTrimmed, normalized });

  if (normalized.length === 0 || userTrimmed.length === 0) {
    console.log('Skipped, no message or user', {
      user: userTrimmed,
      normalized,
    });
    return new Response('', { status: 200 });
  }

  if (value.toLowerCase().includes('imtyping')) {
    console.log('Translation Skip: imtyping', {
      user: userTrimmed,
      normalized,
    });
    return new Response('', { status: 200 });
  }

  if (value.toLowerCase().includes('megaphonez')) {
    console.log('Translation Skip: megaphonez', {
      user: userTrimmed,
      normalized,
    });
    return new Response('', { status: 200 });
  }

  if (!normalized.includes(' ')) {
    console.log('Single word message, skipping', {
      user: userTrimmed,
      normalized,
    });
    return new Response('', { status: 200 });
  }

  const userid = await isValidToken(token, env);

  if (!userid) {
    console.log('Invalid token for lingo translate', { token });
    return new Response('', { status: 200 });
  }

  // fetch kv as late as possible to avoid wasted work
  const kvName = normalizeKey(token, LINGO_KEY);
  const cdo: DurableObjectId = env.PVTCH_BACKEND.idFromName(kvName);
  const stub = env.PVTCH_BACKEND.get(cdo);
  const kvConfigString = await stub.get();

  let kvConfig: Partial<LingoConfig> | undefined;
  try {
    kvConfig = kvConfigString
      ? (JSON.parse(kvConfigString) as Partial<LingoConfig>)
      : undefined;
  } catch (error) {
    console.error('failed to parse lingo config:', error);
  }

  if (!kvConfig) {
    // no config, no translate
    console.log('No lingo config found', { token, kvName });
    return new Response('', { status: 200 });
  }

  if (!kvConfig.bots || !kvConfig.language) {
    // incomplete config, no translate
    console.log('Incomplete lingo config', { token, kvConfig });
    return new Response('', { status: 200 });
  }

  const config: LingoConfig = {
    bots: [...(kvConfig?.bots ?? [])]
      .filter((v) => v !== undefined)
      .map((v) => v.toLowerCase()),
    language: kvConfig?.language ?? 'en',
  };

  if (config.bots.includes(userTrimmed.toLowerCase())) {
    // dont reply to ignored bots / users
    console.log('User is in ignored bots list', {
      user: userTrimmed,
      normalized,
    });
    return new Response('', { status: 200 });
  }

  console.log('Lingo translate config:', config);

  const cacheKey = new MurmurHash3(
    normalized.toLowerCase() + '|' + config.language + '|' + CURRENT_MODEL
  )
    .result()
    .toString(16);

  const saveToCache = async (cacheValue: string) => {
    if (env.DISABLE_CACHE) {
      return;
    }

    try {
      await env.PVTCH_TRANSLATIONS.put(cacheKey, cacheValue, {
        expirationTtl: CACHE_TIME,
      });
      console.log('Saved translation to cache', {
        cacheKey,
        translatedText: cacheValue,
      });
    } catch (error) {
      console.error('Failed to save translation to cache', {
        cacheKey,
        translatedText: cacheValue,
        error: error,
      });
    }
  };

  const existing = await env.PVTCH_TRANSLATIONS.get(cacheKey);
  if (existing) {
    console.log('Found translation in cache', {
      cacheKey,
      translatedText: existing,
    });

    if (existing === '-') {
      // cached no-translate result
      return new Response('', { status: 200 });
    }

    return new Response(existing, { status: 200 });
  }

  let result;

  try {
    result = await translate(normalized, {
      targetLanguage: config.language,
      similarityThreshold: 0.5,
      model: CURRENT_MODEL,
      env: env,
    });
  } catch (error) {
    console.error('Lingo translate failed:', error);
    return new Response('', { status: 200 });
  }

  if (!result) {
    console.error('Lingo translate failed');
    return new Response('', { status: 200 });
  }

  console.log('LLM Response:', {
    input: normalized,
    output: result.translation,
    detectedLanguage: result.detectedLanguage,
    noop: result.noop,
    noopReason: result.noopReason,
  });

  if (result.noop) {
    console.log('No translation needed:', result.noopReason);
    await saveToCache('-'); // cache no-translate result
    return new Response('', { status: 200 });
  }

  if (
    result.translation
      .replaceAll(/@[a-z0-9_]+?([^a-z0-9_]|$)/gi, '$1')
      .trim() === ''
  ) {
    console.log('Translation result is empty after removing usernames');
    await saveToCache('-'); // cache no-translate result
    return new Response('', { status: 200 });
  }

  // safety net: never output NOOP to the user
  if (/^\W*NOOP\W*$/i.test(result.translation.trim())) {
    console.log('Caught escaped NOOP in final output');
    await saveToCache('-');
    return new Response('', { status: 200 });
  }

  const output = `ImTyping ${result.translation}`;

  await saveToCache(output);

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
