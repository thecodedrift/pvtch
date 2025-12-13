import { IRequest, RequestHandler, text } from "itty-router";
import { LingoConfig, lingoConfigKey } from "../../../kv/lingoConfig";
import { normalizeKey } from "@/fn/normalizeKey";
import { isValidToken } from "@/kv/twitchData";
import MurmurHash3 from "imurmurhash";
import { translate } from "@/lib/translator";

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

// strips URLs from the input string
const dropURLs = (str: string) =>
  str
    .trim()
    .replace(/(^|\W)https?:\/\/\S+/gi, "") // links
    .trim();

// cannot segment https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter
// because we don't know the target language yet
// do our best attempt to remove twitch emotes while preserving usernames
const removeTwitchEmotes = (str: string) => {
  const segmenter = new Intl.Segmenter("en-US", { granularity: "word" });
  const chunks = Array.from(segmenter.segment(str));
  let usernameFlag = false;
  const output: string[] = [];

  // walk through the segments. If we hit an @, then turn on the "username" flag
  // if we hit a word segment and the flag is set, continue
  // remove any twich emotes we know of, replace result
  // return the username flag to off
  for (const chunk of chunks) {
    if (chunk.segment === "@") {
      usernameFlag = true;
      output.push(chunk.segment);
      continue;
    }

    if (usernameFlag && chunk.isWordLike) {
      output.push(chunk.segment);
      usernameFlag = false;
      continue;
    }

    if (!chunk.isWordLike) {
      output.push(chunk.segment);
      continue;
    }

    output.push(
      chunk.segment.replace(/[a-zA-Z][a-z0-9]+[0-9]*[A-Z][a-zA-Z0-9]+/g, "")
    );
  }

  return output.join("");
};

const normalizeString = (str: string) => {
  const operations = [dropURLs, removeTwitchEmotes];
  let next = str;
  for (const op of operations) {
    next = op(next);
  }
  return next.trim();
};

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

  if (normalized.toLowerCase().includes("imtyping")) {
    console.log("Translation Skip: imtyping", { user, normalized });
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

  const llmResponse = await translate(normalized, {
    targetLanguage: config.language,
    model: CURRENT_MODEL,
    env: env,
  });

  if (!llmResponse) {
    console.error("Lingo translate failed");
    return text("", { status: 200 });
  }

  console.log("LLM Response:", { input: normalized, output: llmResponse });

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
