import pRetry from 'p-retry';

const extractResponse = (response: unknown): string | undefined => {
  if (!response || response === null) {
    return undefined;
  }

  if (typeof response !== 'object') {
    return undefined;
  }

  let extracted: string | undefined;

  if ('choices' in response) {
    const choices = (response as any).choices;
    if (
      Array.isArray(choices) &&
      choices.length > 0 &&
      'message' in choices[0] &&
      'content' in choices[0].message
    ) {
      // strip thinking block from quen-like models
      extracted = (choices[0].message.content as string).replace(
        /.+<\/think>/gim,
        ''
      );
    }
  }

  if ('response' in response) {
    const resp = (response as any).response;
    if (resp && typeof resp === 'string') {
      extracted = resp;
    }
  }

  if (!extracted) {
    return undefined;
  }

  // if it started with a <doctype or <html, it's probably an error page, return undefined
  if (/^\s*<\s*doctype/i.test(extracted) || /^\s*<\s*html/i.test(extracted)) {
    return undefined;
  }

  // clean up the response and return it
  return extracted.trim();
};

// strips URLs from the input string
const dropURLs = (string_: string) =>
  string_
    .trim()
    .replaceAll(/(^|\W)https?:\/\/\S+/gi, '') // links
    .trim();

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
      'Your final translation should be in the target language specified by the user, regardless of the detected language.',
      'You **MUST** return the translation without additional commentary.',
      '**IMPORTANT:** If no translation is needed, return the string `already_translated`.',
    ].join(' ');

    const llmResponse = await pRetry(
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
                role: 'assistant',
                content: 'What language am I translating to?',
              },
              {
                role: 'user',
                content: options.targetLanguage,
              },
              {
                role: 'assistant',
                content: 'Please provide the text to translate.',
              },
              {
                role: 'user',
                content: input,
              },
            ],
          }
        )) as Record<string, unknown>;

        return extractResponse(response);
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
