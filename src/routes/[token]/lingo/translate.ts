import { eld } from "eld";
import { IRequest, RequestHandler, text } from "itty-router";
import {
  LANGUAGE_THRESHOLD,
  LingoConfig,
  lingoConfigKey,
} from "../../../kv/lingoConfig";
import { normalizeKey } from "@/fn/normalizeKey";
import { isValidToken } from "@/kv/twitchData";
import pRetry from "p-retry";

type LLamaTranslateResponse = {
  translated_text?: string;
  detected_language_code?: string;
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

const isMeaningfulString = (str: string) => {
  return (
    normalizeString(str)
      .replace(/(^|\W)@\w+/gi, "") // usernames
      .trim().length > 0
  );
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

  // what language is this?
  const detected = eld.detect(next);

  // eld abort logic
  // 1. only language over threshold & is our target language
  // 2. all scores is empty (zero scores)
  const allScores = Object.entries(detected.getScores());
  const goodScores = allScores.filter(
    ([_, score]) => score >= LANGUAGE_THRESHOLD
  );

  // scores are [string,number][]
  // sort the list and filter to only the top scores, including ties
  allScores.sort((a, b) => b[1] - a[1]);
  const highestScore = allScores[0];
  const bestScores = allScores.filter(
    ([_, score]) => score === highestScore[1]
  );
  const likelySameLanguage = bestScores.some(
    ([lang, _]) => lang === config.language
  );

  if (likelySameLanguage) {
    console.log(`Message is already in target language`, {
      goodScores,
      language: config.language,
    });
    return text("", { status: 200 });
  }

  console.log("ELD detected languages:", { allScores, goodScores });

  const hasLowConfidence = goodScores.length === 0;

  // Llama is okay at twitch emojis, but we want to strip emoticons and smileys from the text
  const userInput = next; // TODO: further cleaning?

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
                content: `Translate the user's text to ${config.language}. Ignore anything which looks like a twitch emoji. Treat @usernames as literal names. Do not create line breaks.`,
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
                },
                required: ["translated_text", "detected_language_code"],
              },
            },
          }
        )) as {
          response?: LLamaTranslateResponse;
        };

        // safeguard against missing fields
        if (
          !response.response?.translated_text ||
          !response.response?.detected_language_code
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

  // did we translate into our own language by mistake?
  if (llmResponse.detected_language_code === config.language) {
    console.log("Detected language is target language, skipping", {
      detected_language_code: llmResponse.detected_language_code,
      target_language: config.language,
    });
    return text("", { status: 200 });
  }

  console.log("Finished: ", {
    input: normalizeString(userInput),
    rawResponse: llmResponse?.translated_text,
    meaningful: isMeaningfulString(llmResponse?.translated_text ?? ""),
  });

  // not a meaningful translation (unicode symbols like a flip)
  if (!isMeaningfulString(llmResponse?.translated_text ?? "")) {
    console.log("Translation is not meaningful", {
      translated_text: llmResponse?.translated_text,
    });
    return text("", { status: 200 });
  }

  // more than 2 char = undefined
  if (
    llmResponse.detected_language_code?.length &&
    llmResponse.detected_language_code.length > 2
  ) {
    console.log("Invalid detected language code length", {
      detected_language_code: llmResponse.detected_language_code,
    });
    return text("", { status: 200 });
  }

  const translatedText = (llmResponse.translated_text ?? "").trim();

  return text(
    `[${llmResponse.detected_language_code}${
      hasLowConfidence ? "?" : ""
    }] ${translatedText}`,
    { status: 200 }
  );
};
