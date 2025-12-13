import pRetry from "p-retry";

export type TranslationResponse = {
  translated_text: string;
  detected_language: string;
  target_language: string;
};

type LLamaLikeResponse = {
  response: TranslationResponse;
};
function isLLamaLikeResponse(
  resp: GenericLLMResponse
): resp is LLamaLikeResponse {
  return (resp as LLamaLikeResponse).response !== undefined;
}

type QuenLikeResponse = {
  choices: {
    message: {
      content: string;
    };
  }[];
};
function isQuenLikeResponse(
  resp: GenericLLMResponse
): resp is QuenLikeResponse {
  return (resp as QuenLikeResponse).choices !== undefined;
}

type GenericLLMResponse = LLamaLikeResponse | QuenLikeResponse;

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
      chunk.segment.replaceAll(/[a-zA-Z][a-z0-9]+[0-9]*[A-Z][a-zA-Z0-9]+/g, "")
    );
  }

  return output.join("");
};

export const normalizeString = (str: string) => {
  const operations = [dropURLs, removeTwitchEmotes];
  let next = str;
  for (const op of operations) {
    next = op(next);
  }
  return next.trim();
};

type TranslateOptions = {
  targetLanguage: string;
  model?: keyof AiModels;
  env: Env;
};

export const translate = async (text: string, options: TranslateOptions) => {
  const input = normalizeString(text);

  try {
    const systemPrompt = [
      `You are a helpful translation assistant, translating to ${options.targetLanguage}.`,
      "Treat @usernames as literal names and preserve them.",
      "Ignore any kamojis, Twitch-style emotes, emoticons, or smiley faces in the text.",
      "Return the full name of the language you detected for the user's text.",
      `Return the full name of ${options.targetLanguage} as the target language.`,
      "Prefer natural translations over literal word-for-word translations.",
      "If multiple source languages for the user's text may be suitable, prefer the more common language.",
      "Return a translated_text without additional commentary.",
      "If the translated_text is already in the target language, return the original string.",
      "If you cannot detect the language, return the full name of the language as 'Unknown'.",
    ].join(" ");

    const llmResponse: TranslationResponse = await pRetry(
      async () => {
        const response = (await options.env.AI.run(
          (options.model ?? "@cf/qwen/qwen3-30b-a3b-fp8") as keyof AiModels,
          {
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              {
                role: "user",
                content: input,
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
                  detected_language: {
                    type: "string",
                  },
                  target_language: {
                    type: "string",
                  },
                },
                required: [
                  "translated_text",
                  "detected_language",
                  "target_language",
                ],
              },
            },
          }
        )) as GenericLLMResponse;

        // console.log(
        //   "Lingo translate response:",
        //   JSON.stringify(response, null, 2)
        // );

        let data: TranslationResponse | undefined;

        if (isQuenLikeResponse(response)) {
          const content = response.choices[0].message.content;
          try {
            data = JSON.parse(content) as TranslationResponse;
          } catch (e) {
            throw new Error(
              "Lingo translate failed to parse Quen-like response content as JSON:" +
                content
            );
          }
        } else if (isLLamaLikeResponse(response)) {
          data = response.response;
        }

        if (!data) {
          throw new Error(
            "Lingo translate unexpected response format:" +
              JSON.stringify(response)
          );
        }

        return data;
      },
      {
        retries: 3,
      }
    );

    return llmResponse;
  } catch (e) {
    console.error("Translate error:", e);
    return undefined;
  }
};
