import { IRequest, RequestHandler, text } from "itty-router";
import { LingoConfig, lingoConfigKey } from "../../../kv/lingoConfig";
import { normalizeKey } from "@/fn/normalizeKey";
import { isValidToken } from "@/kv/twitchData";
import MurmurHash3 from "imurmurhash";
import {
  normalizeString,
  translate,
  TranslationResponse,
} from "@/lib/translator";

const CACHE_TIME = 60 * 60 * 24 * 3; // 3 days

// qwen 30b isn't in cf types but is supported
const CURRENT_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8" as keyof AiModels;

const ALWAYS_IGNORED_USERS = [
  "streamelements",
  "streamlabs",
  "nightbot",
  "moobot",
  "wizebot",
  "phantombot",
  "sery_bot",
  "coebot",
  "ankhbot",
  "fossabot",
  "twitch",
].map((v) => v.toLowerCase());

export const tokenLingoTranslate: RequestHandler<IRequest, [Env]> = async (
  request,
  env
) => {
  const { token } = request.params as { token: string };
  const value: string = [
    request.content?.message ?? request.query?.message ?? "",
  ]
    .flat()[0]
    .trim();
  const user: string = [request.content?.user ?? request.query?.user ?? ""]
    .flat()[0]
    .trim();

  // skip always ignored users
  if (ALWAYS_IGNORED_USERS.includes(user.toLowerCase())) {
    console.log("User is in always ignored bots list", { user, value });
    return text("", { status: 200 });
  }

  if (value.startsWith("!")) {
    console.log("Command detected, skipping translation", { user, value });
    return text("", { status: 200 });
  }

  const normalized = normalizeString(value);
  console.log("incoming lingo translate:", { user, normalized });

  if (normalized.length === 0 || user.length === 0) {
    console.log("Skipped, no message or user", { user, normalized });
    return text("", { status: 200 });
  }

  if (value.toLowerCase().includes("imtyping")) {
    console.log("Translation Skip: imtyping", { user, normalized });
    return text("", { status: 200 });
  }

  if (!normalized.includes(" ")) {
    console.log("Single word message, skipping", { user, normalized });
    return text("", { status: 200 });
  }

  const userid = await isValidToken(token, env);

  if (!userid) {
    console.log("Invalid token for lingo translate", { token });
    return text("", { status: 200 });
  }

  // fetch kv as late as possible to avoid wasted work
  const kvName = normalizeKey(token, lingoConfigKey);
  const cdo: DurableObjectId = env.PVTCH_BACKEND.idFromName(kvName);
  const stub = env.PVTCH_BACKEND.get(cdo);
  const kvConfigString = await stub.get();

  let kvConfig: Partial<LingoConfig> | undefined;
  try {
    kvConfig = kvConfigString ? JSON.parse(kvConfigString) : undefined;
  } catch (e) {
    console.error("failed to parse lingo config:", e);
  }

  if (!kvConfig) {
    // no config, no translate
    console.log("No lingo config found", { token, kvName });
    return text("", { status: 200 });
  }

  if (!kvConfig.bots || !kvConfig.language) {
    // incomplete config, no translate
    console.log("Incomplete lingo config", { token, kvConfig });
    return text("", { status: 200 });
  }

  const config: LingoConfig = {
    bots: (
      [...(kvConfig?.bots ?? [])].filter((v) => v !== undefined) as string[]
    ).map((v) => v.toLowerCase()),
    language: kvConfig?.language ?? "en",
  };

  if (config.bots.includes(user.toLowerCase())) {
    // dont reply to ignored bots / users
    console.log("User is in ignored bots list", { user, normalized });
    return text("", { status: 200 });
  }

  console.log("Lingo translate config:", config);

  // gartic and other guessing games are single word posts, skip those
  // if (!normalized.includes(" ")) {
  //   console.log("Single word message, skipping", { user, normalized });
  //   return text("", { status: 200 });
  // }

  const cacheKey = new MurmurHash3(
    normalized.toLowerCase() + "|" + config.language + "|" + CURRENT_MODEL
  )
    .result()
    .toString(16);

  const saveToCache = async (value: string) => {
    if (env.DISABLE_CACHE) {
      return;
    }

    try {
      await env.PVTCH_TRANSLATIONS.put(cacheKey, value, {
        expirationTtl: CACHE_TIME,
      });
      console.log("Saved translation to cache", {
        cacheKey,
        translatedText: value,
      });
    } catch (e) {
      console.error("Failed to save translation to cache", {
        cacheKey,
        translatedText: value,
        error: e,
      });
    }
  };

  const existing = await env.PVTCH_TRANSLATIONS.get(cacheKey);
  if (existing) {
    console.log("Found translation in cache", {
      cacheKey,
      translatedText: existing,
    });

    if (existing === "-") {
      // cached no-translate result
      return text("", { status: 200 });
    }

    return text(existing, { status: 200 });
  }

  let llmResponse: TranslationResponse | undefined;

  try {
    llmResponse = await translate(normalized, {
      targetLanguage: config.language,
      model: CURRENT_MODEL,
      env: env,
    });
  } catch (e) {
    console.error("Lingo translate failed:", e);
    return text("", { status: 200 });
  }

  if (!llmResponse) {
    console.error("Lingo translate failed");
    return text("", { status: 200 });
  }

  console.log("LLM Response:", { input: normalized, output: llmResponse });

  const identical = (str1: string, str2: string) => {
    return (
      normalizeString(str1).toLowerCase().trim() ===
      normalizeString(str2).toLowerCase().trim()
    );
  };

  if (identical(llmResponse.translated_text, normalized)) {
    console.log("Translation result is identical to input");
    await saveToCache("-"); // cache no-translate result
    return text("", { status: 200 });
  }

  if (identical(llmResponse.detected_language, llmResponse.target_language)) {
    console.log("Detected language is the same as target language");
    await saveToCache("-"); // cache no-translate result
    return text("", { status: 200 });
  }

  // did we translate into our own language by mistake?
  if (identical(llmResponse.detected_language, "unknown")) {
    await saveToCache("-"); // cache no-translate result
    return text("", { status: 200 });
  }

  // did we translate into our own language by mistake?
  if (llmResponse.translated_text === normalized) {
    await saveToCache("-"); // cache no-translate result
    return text("", { status: 200 });
  }

  if (
    llmResponse.translated_text
      .replaceAll(/@[a-z0-9_]+?([^a-z0-9_]|$)/gi, "$1")
      .trim() === ""
  ) {
    console.log("Translation result is empty after removing usernames");
    await saveToCache("-"); // cache no-translate result
    return text("", { status: 200 });
  }

  const output = `ImTyping [${llmResponse.detected_language}] ${llmResponse.translated_text}`;

  await saveToCache(output);

  return text(output, {
    status: 200,
  });
};
