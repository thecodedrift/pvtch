import type { Route } from './+types/lingo.test';
import { cloudflareEnvironmentContext } from '@/context';
import { translate } from '@/lib/translator';

const fixtures = [
  'galing na curlyg5Wow',
  'kumusta na tayo, @ohaiDrifty ? f0x64Marbie',
  "I shouldn't be translated thecod67Lol",
  'haiiiiii chelle!',
  "내 황홀에 취해, you can't look away",
] as const;
type Inputs = (typeof fixtures)[number];

const targetLanguage = 'English';

const models: Array<keyof AiModels> = [
  // $0.66 per M input tokens, $1.00 per M output tokens
  // '@cf/qwen/qwq-32b',

  // in AI models, but not in types yet
  // $0.051 per M input tokens, $0.34 per M output tokens
  '@cf/qwen/qwen3-30b-a3b-fp8' as keyof AiModels,

  // $0.27 per M input tokens, $0.85 per M output tokens
  '@cf/meta/llama-4-scout-17b-16e-instruct',
];

async function runTests(env: Env): Promise<Response> {
  if (env.DEVELOPMENT !== '1') {
    return new Response('Not found', { status: 404 });
  }

  const translations = new Map<
    Inputs,
    Record<
      keyof AiModels,
      {
        translated_text: string;
        target_language: string;
      }
    >
  >();

  const promises: Promise<unknown>[] = [];

  for (const fixture of fixtures) {
    translations.set(
      fixture,
      {} as Record<
        keyof AiModels,
        {
          translated_text: string;
          target_language: string;
        }
      >
    );

    for (const model of models) {
      const p = (async () => {
        const llmResponse = await translate(fixture, {
          targetLanguage: targetLanguage,
          model: model,
          env: env,
        });

        if (!llmResponse) {
          return;
        }

        const current = translations.get(fixture)!;
        current[model] = {
          translated_text: llmResponse || '',
          target_language: targetLanguage,
        };
      })();
      promises.push(p);
    }
  }

  await Promise.allSettled(promises);

  const output: string[] = [];
  for (const [input, translationResult] of translations.entries()) {
    output.push(`Input: ${input}`);
    for (const model of models) {
      const modelResult = translationResult[model];
      output.push(
        `Model: ${String(model)}\nTarget Language: ${modelResult.target_language}\nTranslation: ${modelResult.translated_text}\n`
      );
    }
    output.push('\n');
  }

  return new Response(output.join('\n'), {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.get(cloudflareEnvironmentContext);
  return runTests(env);
}

export async function action({ context }: Route.ActionArgs) {
  const env = context.get(cloudflareEnvironmentContext);
  return runTests(env);
}
