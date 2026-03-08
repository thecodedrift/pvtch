import { z } from 'zod';

const MODEL = '@cf/qwen/qwen3-30b-a3b-fp8' as const;

const LANGUAGE_TRANSLATOR = `
You are a translation assistant.

## Inputs
1. The "target language" that the user wants the text translated into
2. The "input text" that needs to be translated

## Instructions
1. Identify the language of the input text
2. Capture the ISO 639-3 three-letter code for the detected language
2. Translate the input text into the requested target language

Rules:
- Make an infomed attempt to identify the target language
- If the "input text" is already in the "target language", return it as-is with the detected language matching the target language
- Preserve @usernames exactly as-is. They are treated as someone's name
- Ignore kaomoji, Twitch emotes, emoticons, and smileys
- Prefer natural, fluent translations over literal word-for-word

## Output
Your output should be JSON formatted as follows:

\`\`\`
{
  "detected": "The detected language name (e.g. English, Korean, Tagalog, Spanish, etc)",
  "detectedCode": "The detected ISO 639-3 language code (e.g. eng, kor, tgl, esp, etc)",
  "translation": "The translated text"
}
\`\`\`
`.trim();

const LANGUAGE_TRANSLATOR_SCHEMA = z.object({
  detected: z.string(),
  detectedCode: z.string(),
  translation: z.string(),
});

const createConversation = ({
  targetLanguage,
  input,
}: {
  targetLanguage: string;
  input: string;
}): AiModels[typeof MODEL]['inputs'] => {
  return {
    response_format: {
      type: 'json_schema',
      json_schema: LANGUAGE_TRANSLATOR_SCHEMA.toJSONSchema(),
    },
    messages: [
      {
        role: 'system',
        content: LANGUAGE_TRANSLATOR,
      },
      {
        role: 'assistant',
        content: 'What is the requested target language?',
      },
      {
        role: 'user',
        content: targetLanguage,
      },
      {
        role: 'assistant',
        content: `What text should I translate?`,
      },
      {
        role: 'user',
        content: input,
      },
    ],
  };
};

type TranslateOptions = {
  env: Env;
  targetLanguage: string;
};

type TranslationResponse =
  | {
      success: true;
      data: z.infer<typeof LANGUAGE_TRANSLATOR_SCHEMA>;
      raw?: string;
    }
  | {
      success: false;
      error: string;
      details?: unknown;
      raw?: string;
    };

export const translate = async (
  input: string,
  options: TranslateOptions
): Promise<TranslationResponse> => {
  const { env, targetLanguage } = options;
  const response = (await env.AI.run(
    '@cf/qwen/qwen3-30b-a3b-fp8',
    createConversation({
      targetLanguage,
      input,
    })
  )) as Ai_Cf_Qwen_Qwen3_30B_A3B_Fp8_Chat_Completion_Response;

  // content location
  const rawData = response.choices?.[0]?.message?.content;
  let data: z.infer<typeof LANGUAGE_TRANSLATOR_SCHEMA> | undefined;

  try {
    data = LANGUAGE_TRANSLATOR_SCHEMA.parse(JSON.parse(rawData ?? ''));
  } catch (error) {
    return {
      success: false,
      error: 'Failed to parse translator response',
      details: error,
      raw: rawData,
    };
  }

  return {
    success: true,
    data,
    raw: rawData,
  };
};

export const isSameLanguage = (
  language: string,
  translationResponse: TranslationResponse
): boolean => {
  if (!translationResponse.success) {
    return true;
  }

  return (
    translationResponse.data.detected.toLocaleLowerCase() ===
    language.toLocaleLowerCase()
  );
};

export const languageCodeToAnnotation = (code: string): string => {
  const map = {
    a: 'ᵃ',
    b: 'ᵇ',
    c: 'ᶜ',
    d: 'ᵈ',
    e: 'ᵉ',
    f: 'ᶠ',
    g: 'ᵍ',
    h: 'ʰ',
    i: 'ⁱ',
    j: 'ʲ',
    k: 'ᵏ',
    l: 'ˡ',
    m: 'ᵐ',
    n: 'ⁿ',
    o: 'ᵒ',
    p: 'ᵖ',
    q: '۹',
    r: 'ʳ',
    s: 'ˢ',
    t: 'ᵗ',
    u: 'ᵘ',
    v: 'ᵛ',
    w: 'ʷ',
    x: 'ˣ',
    y: 'ʸ',
    z: 'ᶻ',
    A: 'ᴬ',
    B: 'ᴮ',
    C: 'ᑦ',
    D: 'ᴰ',
    E: 'ᴱ',
    F: 'ᶠ',
    G: 'ᴳ',
    H: 'ᴴ',
    I: 'ᴵ',
    J: 'ᴶ',
    K: 'ᴷ',
    L: 'ᴸ',
    M: 'ᴹ',
    N: 'ᴺ',
    O: 'ᴼ',
    P: 'ᴾ',
    Q: '۹',
    R: 'ᴿ',
    S: 'ˢ',
    T: 'ᵀ',
    U: 'ᵁ',
    V: 'ⱽ',
    W: 'ᵂ',
    X: 'ˣ',
    Y: 'ʸ',
    Z: 'ᶻ',
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
    '+': '⁺',
    '-': '⁻',
    '=': '⁼',
    '(': '⁽',
    ')': '⁾',
    // Note: Not all characters have a standard superscript Unicode equivalent.
  } as const;

  return [...code]
    .map((char) => {
      if (char in map) {
        return map[char as keyof typeof map];
      }
      return char;
    })
    .join('');
};
