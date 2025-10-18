import { eld } from "eld";
import { IRequest, RequestHandler, text } from "itty-router";
import { LingoConfig } from "../../../kv/lingoConfig";
import { normalizeKey } from "@/fn/normalizeKey";

const LANGUAGE_THRESHOLD = 0.2;

/**
 * Filtering information:
 * 1. Remove command prefixed values starting with !
 * 2. Remove usernames
 * 3. Remove twitch emotes (best attempt)
 * 4. Trim and check length
 *
 * test strings:
 * - hello thecod67Heart how is everyone? UwU \@curlygirlbabs
 * - Yo fui a la store to buy las uvas
 * - 내 황홀에 취해, you can't look away
 * - yo soy :3
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

  const next = value
    .trim()
    .replace(/^!.*/g, "") // commands
    .replace(/\b@[a-z0-9_]+\b/gi, "") // usernames
    .replace(/\b[a-z][a-z0-9]+[\d]*[A-Z][a-zA-Z0-9]+\b/g, "") // most emotes
    .trim();

  console.log("lingo translate:", { user, next });

  if (next.length === 0 || user.length === 0) {
    return text("", { status: 200 });
  }

  const kvName = normalizeKey(token, "lingo_config");
  const kvConfig = await env.PVTCH_KV.get<Partial<LingoConfig>>(kvName, "json");
  // const kvConfig: Partial<LingoConfig> = {
  //   ignoreUsers: ["ohaiDrifty"],
  //   language: "en",
  // };

  if (!kvConfig) {
    // no config, no translate
    return text("", { status: 200 });
  }

  const config: LingoConfig = {
    ignoreUsers: kvConfig?.ignoreUsers ?? [],
    language: kvConfig?.language ?? "en",
  };

  if (
    config.ignoreUsers.map((v) => v.toLowerCase()).includes(user.toLowerCase())
  ) {
    return text("", { status: 200 });
  }

  // what language is this?
  const detected = eld.detect(next);
  const scores = Object.entries(detected.getScores())
    .filter(([_, score]) => score >= LANGUAGE_THRESHOLD) // only over threshold
    .filter(([lang, _]) => lang !== config.language) // remove target language
    .sort((a, b) => b[1] - a[1]);

  // no scores left after filtering
  if (scores.length === 0) {
    return text("", { status: 200 });
  }

  // Llama is okay at twitch emojis, but we want to strip emoticons and smileys from the text
  const userInput = value
    .replace(/[:;x=][-o]?[)(D3Pp\\\/]/g, "") // remove smileys
    .replace(/\p{Emoji}/gu, "");

  const response = (await env.AI.run(
    "@cf/meta/llama-4-scout-17b-16e-instruct",
    {
      messages: [
        {
          role: "system",
          content: `Translate the user's text to to ${config.language}, ignore anything which looks like a twitch emoji`,
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
    response?: {
      translated_text?: string;
      detected_language_code?: string;
    };
  };

  // safeguard against missing fields
  if (
    !response.response?.translated_text ||
    !response.response?.detected_language_code
  ) {
    return text("", { status: 200 });
  }

  return text(
    `[${response.response.detected_language_code}] ${response.response.translated_text}`,
    { status: 200 }
  );
};
