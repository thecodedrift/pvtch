import { IRequest, text, RequestHandler } from "itty-router";
import { translate } from "@/lib/translator";

const fixtures = [
  // "@curlygirlbabs ノ( ゜-゜ノ)",
  // "jag vet inte",
  // "Cheer42 здравствуйте товарищи",
  // "내 황홀에 취해, you can't look away",
  // "hej",
  // "Soy fría thecod67Lost",
  // "Blad is blad",
  "galing na curlyg5Wow",
  "kumusta na tayo, @ohaiDrifty ? f0x64Marbie",
  "I shouldn't be translated thecod67Lol",
  // "chelle! hai!",
] as const;
type Inputs = (typeof fixtures)[number];

const targetLanguage = "English";

const models: Array<keyof AiModels> = [
  // no pricing (yet)
  // "@hf/mistral/mistral-7b-instruct-v0.2", // no json schema support

  // $0.35 per M input tokens, $0.75 per M output tokens
  // "@cf/openai/gpt-oss-120b", // no json schema support

  // $0.66 per M input tokens, $1.00 per M output tokens
  "@cf/qwen/qwq-32b",

  // in AI models, but not in types yet
  // $0.051 per M input tokens, $0.34 per M output tokens
  "@cf/qwen/qwen3-30b-a3b-fp8" as keyof AiModels,

  // $0.29 per M input tokens, $2.25 per M output tokens
  // "@cf/meta/llama-3.3-70b-instruct-fp8-fast",

  // $0.27 per M input tokens, $0.85 per M output tokens
  "@cf/meta/llama-4-scout-17b-16e-instruct",
];

export const tokenLingoTest: RequestHandler<IRequest, [Env]> = async (
  request,
  env
) => {
  if (env.DEVELOPMENT !== "1") {
    return text("Not found", {
      status: 404,
    });
  }

  const translations = new Map<
    Inputs,
    Record<
      keyof AiModels,
      {
        translated_text: string;
        detected_language: string;
        target_language: string;
      }
    >
  >();

  const promises: Promise<unknown>[] = [];

  for (const text of fixtures) {
    translations.set(text, {} as any);

    for (const model of models) {
      const p = (async () => {
        const llmResponse = await translate(text, {
          targetLanguage: targetLanguage,
          model: model,
          env: env,
        });

        if (!llmResponse) {
          return;
        }

        const current = translations.get(text)!;
        current[model] = {
          translated_text: llmResponse?.translated_text || "",
          detected_language: llmResponse?.detected_language || "Unknown",
          target_language: llmResponse?.target_language || "Unknown",
        };
      })();
      promises.push(p);
    }
  }

  await Promise.allSettled(promises);

  const output: string[] = [];
  for (const [input, result] of translations.entries()) {
    output.push(`Input: ${input}`);
    for (const model of models) {
      const res = result[model];
      output.push(
        `Model: ${model}\nDetected Language: ${res.detected_language}\nTarget Language: ${res.target_language}\nTranslation: ${res.translated_text}\n`
      );
    }
    output.push("\n");
  }

  return text(output.join("\n"));
};
