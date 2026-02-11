import pRetry from 'p-retry';
import { similar } from '@/lib/strings';

const systemPrompt = `You are a translation assistant.

First, identify the language of the input text.
Then, translate it to the requested target language.

Rules:
- Preserve @usernames exactly as-is
- Ignore kaomoji, Twitch emotes, emoticons, and smileys
- Prefer natural, fluent translations over literal word-for-word
- Do NOT correct grammar, spelling, or punctuation — only translate

You MUST respond in EXACTLY this format (two lines):
Line 1: The detected language name (e.g. English, Korean, Tagalog, Spanish)
Line 2: The translated text OR the single word NOOP if the text is already in the target language

Example — needs translation:
Korean
Drunk on my ecstasy, you can't look away

Example — no translation needed:
English
NOOP
/no_think`;

const extractResponse = (response: unknown): string | undefined => {
  if (!response || response === null) {
    return undefined;
  }

  if (typeof response !== 'object') {
    return undefined;
  }

  let extracted: string | undefined;

  // qwen-like respones have a choices array
  if ('choices' in response && Array.isArray(response.choices)) {
    const choices = response.choices as
      | { message?: { role?: string; content?: string } }[]
      | undefined;
    const content = choices?.[0]?.message?.content;
    if (content) {
      // strip thinking block from qwen-like models
      // eslint-disable-next-line unicorn/prefer-string-replace-all
      extracted = content.replace(/.+<\/think>/gim, '');
    }
  }

  // older llama models have a response property
  if ('response' in response && typeof response.response === 'string') {
    extracted = response.response;
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
  similarityThreshold?: number;
  model?: keyof AiModels;
  env: Env;
};

export type TranslateResult = {
  detectedLanguage: string | undefined;
  translation: string;
  raw: string;
  noop: boolean;
  noopReason: 'language_match' | 'similarity' | 'model_noop' | undefined;
};

export const translate = async (
  text: string,
  options: TranslateOptions
): Promise<TranslateResult | undefined> => {
  const input = normalizeString(text);

  try {
    const rawResponse = await pRetry(
      async () => {
        const response = (await options.env.AI.run(
          options.model ?? '@cf/qwen/qwen3-30b-a3b-fp8',
          {
            messages: [
              {
                role: 'system',
                content: systemPrompt,
              },
              {
                role: 'user',
                content: `Translate to ${options.targetLanguage}:\n${input}`,
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

    if (!rawResponse) {
      return;
    }

    // parse two-line format: "DetectedLanguage\nTranslation"
    const newlineIndex = rawResponse.indexOf('\n');
    let detectedLanguage: string | undefined;
    let llmResponse: string;

    if (newlineIndex > 0) {
      detectedLanguage = rawResponse.slice(0, newlineIndex).trim();
      llmResponse = rawResponse.slice(newlineIndex + 1).trim();
    } else {
      // model didn't follow format — treat entire response as translation
      llmResponse = rawResponse;
    }

    const result: TranslateResult = {
      detectedLanguage,
      translation: llmResponse,
      raw: rawResponse,
      noop: false,
      noopReason: undefined,
    };

    // if the model explicitly returned NOOP
    if (llmResponse.trim().toUpperCase() === 'NOOP') {
      result.noop = true;
      result.noopReason = 'model_noop';
      return result;
    }

    // if the detected language matches the target, force NOOP
    if (
      detectedLanguage &&
      detectedLanguage.toLowerCase() === options.targetLanguage.toLowerCase()
    ) {
      result.noop = true;
      result.noopReason = 'language_match';
      return result;
    }

    // fallback: similarity check for short messages where language
    // detection is unreliable, or when detection didn't produce a result
    const wordCount = input.split(/\s+/).length;
    if (
      (!detectedLanguage || wordCount <= 3) &&
      options.similarityThreshold !== undefined &&
      similar(normalizeString(llmResponse), input, options.similarityThreshold)
    ) {
      result.noop = true;
      result.noopReason = 'similarity';
      return result;
    }

    return result;
  } catch (error) {
    console.error('Translate error:', error);
    return;
  }
};
