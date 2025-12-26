import pRetry from 'p-retry';

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
const dropURLs = (string_: string) =>
  string_
    .trim()
    .replaceAll(/(^|\W)https?:\/\/\S+/gi, '') // links
    .trim();

const trimToLength = (string_: string, maxLength: number) => {
  const segmenter = new Intl.Segmenter('en-US', { granularity: 'grapheme' });
  const chunks = [...segmenter.segment(string_)];
  if (chunks.length <= maxLength) {
    return string_;
  }
  return chunks
    .slice(0, maxLength)
    .map((c) => c.segment)
    .join('');
};

// cannot segment https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter
// because we don't know the target language yet
// do our best attempt to remove twitch emotes while preserving usernames
const removeTwitchEmotes = (string_: string) => {
  const segmenter = new Intl.Segmenter('en-US', { granularity: 'word' });
  const chunks = [...segmenter.segment(string_)];
  let usernameFlag = false;
  const output: string[] = [];

  // walk through the segments. If we hit an @, then turn on the "username" flag
  // if we hit a word segment and the flag is set, continue
  // remove any twich emotes we know of, replace result
  // return the username flag to off
  for (const chunk of chunks) {
    if (chunk.segment === '@') {
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
      chunk.segment.replaceAll(/[a-zA-Z][a-z0-9]+[0-9]*[A-Z][a-zA-Z0-9]+/g, '')
    );
  }

  return output.join('');
};

export const normalizeString = (string_: string) => {
  const operations = [dropURLs, removeTwitchEmotes];
  let next = string_;
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
      "You are a helpful translation assistant, translating to the user's requested language.",
      'Treat @usernames as literal names and preserve them.',
      'Ignore any kamojis, Twitch-style emotes, emoticons, or smiley faces in the text.',
      'Prefer natural translations over literal word-for-word translations.',
      'When considering possible similar languages, prefer a more common language.',
      "Return the full name of the language you detected for the user's text as detected_language.",
      'Return the full name of the target language the user requested as target_language.',
      "If you cannot detect any language, return the full name of the language as 'Unknown'.",
      'Return the translation as translated_text without additional commentary.',
      'If the translated_text is already in the target language, return the original string.',
    ].join(' ');

    const llmResponse: TranslationResponse = await pRetry(
      async () => {
        const response = (await options.env.AI.run(
          (options.model ?? '@cf/qwen/qwen3-30b-a3b-fp8') as keyof AiModels,
          {
            messages: [
              {
                role: 'system',
                content: systemPrompt,
              },
              {
                role: 'user',
                content: `Translate this text to "${trimToLength(
                  options.targetLanguage,
                  60
                )}":\n\n${input}`,
              },
            ],
            response_format: {
              type: 'json_schema',
              json_schema: {
                type: 'object',
                properties: {
                  translated_text: {
                    type: 'string',
                  },
                  detected_language: {
                    type: 'string',
                  },
                  target_language: {
                    type: 'string',
                  },
                },
                required: [
                  'translated_text',
                  'detected_language',
                  'target_language',
                ],
              },
            },
          }
        )) as GenericLLMResponse;

        let data: TranslationResponse | undefined;

        if (isQuenLikeResponse(response)) {
          const content = response.choices[0].message.content;
          try {
            data = JSON.parse(content) as TranslationResponse;
          } catch {
            throw new Error(
              'Lingo translate failed to parse Quen-like response content as JSON:' +
                content
            );
          }
        } else if (isLLamaLikeResponse(response)) {
          data = response.response;
        }

        if (!data) {
          throw new Error(
            'Lingo translate unexpected response format:' +
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
  } catch (error) {
    console.error('Translate error:', error);
    return;
  }
};
