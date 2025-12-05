import { detectAll } from "tinyld";
import { IRequest, RequestHandler, text } from "itty-router";
import { LingoConfig, lingoConfigKey } from "../../../kv/lingoConfig";
import { normalizeKey } from "@/fn/normalizeKey";
import { isValidToken } from "@/kv/twitchData";
import pRetry from "p-retry";
import MurmurHash3 from "imurmurhash";

type LLamaTranslateResponse = {
  translated_text?: string;
  detected_language_code?: string;
  detected_language_name?: string;
  confidence?: number;
};

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

const normalizeString = (str: string) =>
  str
    .trim()
    .replace(/^!.*/g, "") // commands
    .replace(/(^|\W)https?:\/\/\S+/gi, "") // links
    .trim();

// cannot segment https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter
// because we don't know the target language yet
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
      chunk.segment.replace(/[a-z][a-z0-9]+[0-9]*[A-Z][a-zA-Z0-9]+/g, "")
    );
  }

  return output.join("");
};

/**
 * Filtering information:
 * 1. Remove command prefixed values starting with !
 * 2. Remove usernames
 * 3. Remove twitch emotes (best attempt)
 * 4. Trim and check length
 *
 * test strings:
 * - hello thecod67Heart how is everyone? UwU \@curlygirlbabs
 * - Yo fui a la store to buy las uvas LUL
 * - 내 황홀에 취해, you can't look away soltLaugh
 * - yo soy :3 thecod67Coffee
 *
 * Then if we still have a message, make a KV fetch for config.
 * This ensures we're only doing language detection and AI calls when needed
 * and aren't including the user's bots or other ignored users.
 *
 * 1. Abort if it's an ignored user
 *
 * At this point, we think we **should** translate, so use eld and see what language it is.
 *
 * 1. If there is no good scoring languages (over the threshold) abort
 * 2. If the only good scoring language is the target language, abort
 *
 * We can now attempt a translation.
 *
 * 1. Strip emoticons and smileys from the text, as they interfere with llama's understanding
 * 2. Call AI with system prompt to translate to target language, ignoring twitch emojis
 * 3. Return translated text with detected language code prefix
 */
export const tokenLingoTranslate: RequestHandler<IRequest, [Env]> = async (
  request,
  env
) => {
  const { token } = request.params as { token: string };
  const value: string = [
    request.content?.message ?? request.query?.message ?? "",
  ].flat()[0];
  const user: string = [request.content?.user ?? request.query?.user ?? ""]
    .flat()[0]
    .trim();

  // skip always ignored users
  if (ALWAYS_IGNORED_USERS.includes(user.toLowerCase())) {
    console.log("User is in always ignored bots list", { user, value });
    return text("", { status: 200 });
  }

  const next = normalizeString(value);
  console.log("incoming lingo translate:", { user, next });

  if (next.length === 0 || user.length === 0) {
    console.log("Skipped, no message or user", { user, next });
    return text("", { status: 200 });
  }

  const userid = await isValidToken(token, env);

  if (!userid) {
    console.log("Invalid token for lingo translate", { token });
    return text("", { status: 200 });
  }

  const kvName = normalizeKey(token, lingoConfigKey);
  const cdo: DurableObjectId = env.PVTCH_BACKEND.idFromName(kvName);
  const stub = env.PVTCH_BACKEND.get(cdo);
  const kvConfigString = await stub.get();

  let kvConfig: Partial<LingoConfig> | null = null;
  try {
    kvConfig = kvConfigString ? JSON.parse(kvConfigString) : null;
  } catch (e) {
    console.error("failed to parse lingo config:", e);
    kvConfig = null;
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
    console.log("User is in ignored bots list", { user, next });
    return text("", { status: 200 });
  }

  let performTranslation = true;
  let saveToCache = false;
  const cacheKey = new MurmurHash3(
    next.toLowerCase().replaceAll(/\s+/g, " ").trim()
  )
    .result()
    .toString(16);
  const guesses = detectAll(next).sort((a, b) => b.accuracy - a.accuracy);
  let identifiedLanguage: string | undefined = undefined;

  console.log("TinyLD language guesses:", next, { guesses });
  console.log("Cache key for message:", { next, cacheKey });

  // optimizations: Try to avoid translation calls if possible
  if (guesses.length === 1 && guesses[0].accuracy === 1) {
    performTranslation = guesses[0].lang !== config.language;
    identifiedLanguage = guesses[0].lang;
  } else {
    if (next.length < 16) {
      // below 16 characters, tinyld is less than 90% accurate
      // try a kv call to see if this is a cached translation
      const existing = await env.PVTCH_TRANSLATIONS.get(cacheKey);
      if (existing) {
        console.log("Found cached translation, returning", {
          cacheKey,
          existing,
        });
        return text(existing, { status: 200 });
      }

      saveToCache = true;
      performTranslation = true; // definitely try
    } else {
      // accuracy is between 90-95% for most languages in the 16-24 range
      // high accuracy on the detection +95% > 24 characters
      performTranslation = guesses[0].lang !== config.language;
      identifiedLanguage = guesses[0].lang;
    }
  }

  // early abort if we think translation is not needed
  if (!performTranslation) {
    console.log("TinyLD indicates no translation needed", {
      identifiedLanguage,
      targetLanguage: config.language,
      guesses,
    });
    return text("", { status: 200 });
  }

  // Llama is okay at twitch emojis, but we want to strip emoticons and smileys from the text
  const userInput = removeTwitchEmotes(next).trim();

  if (userInput.length === 0) {
    console.log("No meaningful text after removing twitch emotes", {
      user,
      next,
      userInput,
    });
    return text("", { status: 200 });
  }

  console.log(`Planned translation: ${userInput}`);

  let llmResponse: LLamaTranslateResponse | undefined = undefined;
  try {
    llmResponse = await pRetry(
      async () => {
        const response = (await env.AI.run(
          "@cf/meta/llama-4-scout-17b-16e-instruct",
          {
            messages: [
              {
                role: "system",
                content: [
                  `Translate the user's text to ${config.language}.`,
                  "Treat @usernames as literal names and preserve them.",
                  "Do not create line breaks.",
                  `Identify the language's name and it's 2 letter ISO code.`,
                  "Return the confidence of the translation as a float between 0 and 1.",
                ].join(" "),
              },
              {
                role: "user",
                content: userInput,
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                type: "object",
                properties: {
                  translated_text: {
                    type: "string",
                  },
                  detected_language_code: {
                    type: "string",
                  },
                  detected_language_name: {
                    type: "string",
                  },
                  confidence: {
                    type: "number",
                  },
                },
                required: [
                  "translated_text",
                  "detected_language_code",
                  "detected_language_name",
                  "confidence",
                ],
              },
            },
          }
        )) as {
          response?: LLamaTranslateResponse;
        };

        // safeguard against missing fields
        if (
          response.response?.translated_text === undefined ||
          response.response?.detected_language_code === undefined ||
          response.response?.detected_language_name === undefined ||
          response.response?.confidence === undefined
        ) {
          throw new Error(
            "Lingo translate missing fields:" +
              JSON.stringify({
                response: response?.response,
              })
          );
        }

        return response.response;
      },
      {
        retries: 3,
      }
    );
  } catch (e) {
    console.error("Lingo translate failed after retries:", e);
    return text("", { status: 200 });
  }

  console.log("LLM Response:", { input: userInput, llmResponse });

  // did we translate into our own language by mistake?
  if (llmResponse.detected_language_code === config.language) {
    console.log("Detected language is target language, skipping", {
      detected_language_code: llmResponse.detected_language_code,
      target_language: config.language,
    });
    return text("", { status: 200 });
  }

  // not a meaningful translation (unicode symbols like a flip)
  if ((llmResponse.confidence ?? 0) < 0.5) {
    console.log("Not confident in the LLM translation, skipping", {
      detected_language_code: llmResponse.detected_language_code,
      translated_text: llmResponse.translated_text,
    });
    return text("", { status: 200 });
  }

  const translatedText = (llmResponse.translated_text ?? "").trim();

  if (saveToCache && translatedText.length > 0) {
    // save to kv cache for next time
    try {
      await env.PVTCH_TRANSLATIONS.put(cacheKey, translatedText, {
        expirationTtl: 60 * 60 * 24, // 24 hours
      });
      console.log("Saved translation to cache", { cacheKey, translatedText });
    } catch (e) {
      console.error("Failed to save translation to cache", {
        cacheKey,
        translatedText,
        error: e,
      });
    }
  }

  return text(`[${llmResponse.detected_language_name}] ${translatedText}`, {
    status: 200,
  });
};
