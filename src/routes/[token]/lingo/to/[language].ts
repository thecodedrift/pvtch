import { normalizeKey } from "@/fn/normalizeKey";
import {
  LANGUAGE_THRESHOLD,
  LingoConfig,
  lingoConfigKey,
} from "@/kv/lingoConfig";
import { isValidToken } from "@/kv/twitchData";
import { eld } from "eld";
import { IRequest, RequestHandler, text } from "itty-router";

export const tokenLingoToLanguage: RequestHandler<IRequest, [Env]> = async (
  request,
  env
) => {
  const { token, language } = request.params as {
    token: string;
    language: string;
  };
  const value: string = [
    request.content?.message ?? request.query?.message ?? "",
  ].flat()[0];

  if (language.trim().length !== 2) {
    return text("", { status: 200 });
  }

  const next = value
    .trim()
    .replace(/^!.*/g, "") // commands
    .replace(/\b@[a-z0-9_]+\b/gi, "") // usernames
    .replace(/\b[a-z0-9]+[\d]*[A-Z][a-zA-Z0-9]+\b/g, "") // most emotes
    .trim();

  console.log("lingo translate:", { next });

  if (next.length === 0) {
    return text("", { status: 200 });
  }

  const userid = await isValidToken(token, env);

  if (!userid) {
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
    return text("", { status: 200 });
  }

  if (!kvConfig.language) {
    // incomplete config, no translate
    return text("", { status: 200 });
  }

  // what language is this?
  const detected = eld.detect(next);
  const scores = Object.entries(detected.getScores())
    .filter(([_, score]) => score >= LANGUAGE_THRESHOLD) // only over threshold
    .filter(([lang, _]) => lang !== language) // remove target language
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
          content: `Translate the user's text to ${language}, ignore anything which looks like a twitch emoji`,
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
    `[${response.response.detected_language_code} ⇒ ${language}] ${response.response.translated_text}`,
    { status: 200 }
  );
};
