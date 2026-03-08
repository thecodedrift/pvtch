import { z } from 'zod';
import { normalizeLanguage } from '@/lib/constants/languages';

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
- Make an informed attempt to identify the target language
- If the "input text" is already in the "target language", return it as-is with the detected language matching the target language
- Preserve @usernames exactly as-is. They are treated as someone's name
- Ignore kaomoji, Twitch emotes, emoticons, and smileys
- Prefer natural, fluent translations over literal word-for-word
- Return the base language name without regional variants (e.g. "Portuguese" not "Brazilian Portuguese", "Chinese" not "Mandarin Chinese")

## Output
Your output should be JSON formatted as follows:

\`\`\`
{
  "detected": "The base language name (e.g. English, Korean, Tagalog, Spanish)",
  "detectedCode": "The ISO 639-3 code (e.g. eng, kor, tgl, spa)",
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
  input: string,
  translationResponse: TranslationResponse
): boolean => {
  if (!translationResponse.success) {
    return true;
  }

  const target = normalizeLanguage(language);
  const detectedByName = normalizeLanguage(translationResponse.data.detected);
  const detectedByCode = normalizeLanguage(
    translationResponse.data.detectedCode
  );

  // Compare normalized names: handles "en" vs "eng" vs "English" → all become "english"
  if (target === detectedByName || target === detectedByCode) {
    return true;
  }

  // If the translation is identical to the input, there's nothing to show
  if (
    translationResponse.data.translation.trim().toLocaleLowerCase() ===
    input.trim().toLocaleLowerCase()
  ) {
    return true;
  }

  return false;
};
