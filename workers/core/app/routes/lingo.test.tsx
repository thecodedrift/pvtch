import type { Route } from './+types/lingo.test';
import { cloudflareEnvironmentContext } from '@/context';
import { translate } from '@/lib/translator';

type Fixture = {
  input: string;
  detectedLanguage: string | undefined;
  noop: boolean;
};

const fixtures: Fixture[] = [
  {
    input: "Don't mind nanopanther, he's got a case of the drifties",
    detectedLanguage: 'English',
    noop: true,
  },
  {
    input:
      'Added Quote 101: "I never interrupt Mommy-.. I mean Cortana" - @saintnoble [Halo: The Master Chief Collection] [11/02/2026]',
    detectedLanguage: 'English',
    noop: true,
  },
  {
    input: 'galing na curlyg5Wow',
    detectedLanguage: 'Tagalog',
    noop: false,
  },
  {
    input: 'kumusta na tayo, @ohaiDrifty ? f0x64Marbie',
    detectedLanguage: 'Tagalog',
    noop: false,
  },
  {
    input: "I shouldn't be translated thecod67Lol",
    detectedLanguage: 'English',
    noop: true,
  },
  {
    input: 'haiiiiii chelle!',
    detectedLanguage: 'English',
    noop: true,
  },
  {
    input: "내 황홀에 취해, you can't look away",
    detectedLanguage: 'Korean',
    noop: false,
  },
  {
    input:
      'Yeah relaunching provides completely different data. Things are randomized to ensure you sstay anonymous with each browser launch in Mullvad',
    detectedLanguage: 'English',
    noop: true,
  },
  {
    input: 'I should get 2/3rds of that payout, yeah?',
    detectedLanguage: 'English',
    noop: true,
  },
  {
    input: 'heya kaph',
    detectedLanguage: 'English',
    noop: true,
  },
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
  // '@cf/meta/llama-4-scout-17b-16e-instruct',
];

async function runTests(env: Env): Promise<Response> {
  if (env.DEVELOPMENT !== '1') {
    return new Response('Not found', { status: 404 });
  }

  const results = new Map<
    Inputs,
    Record<keyof AiModels, Awaited<ReturnType<typeof translate>> | undefined>
  >();

  const promises: Promise<unknown>[] = [];

  for (const fixture of fixtures) {
    results.set(
      fixture,
      {} as Record<
        keyof AiModels,
        Awaited<ReturnType<typeof translate>> | undefined
      >
    );
    for (const model of models) {
      const p = (async () => {
        const result = await translate(fixture.input, {
          targetLanguage: targetLanguage,
          similarityThreshold: 0.5,
          model: model,
          env: env,
        });

        results.get(fixture)![model] = result;
      })();
      promises.push(p);
    }
  }

  await Promise.allSettled(promises);

  const output: string[] = [];
  for (const [input, modelResults] of results.entries()) {
    output.push(`Input: ${input.input}`);
    for (const model of models) {
      const r = modelResults[model];
      if (!r) {
        output.push(`Model: ${String(model)}\nResult: ERROR`);
        continue;
      }
      if (input.noop !== r.noop) {
        output.push(
          `Model: ${String(model)}\n` +
            `Expected NOOP: ${input.noop}\n` +
            `Actual NOOP: ${r.noop}\n` +
            `Detected Language: ${r.detectedLanguage ?? '(none)'}\n` +
            `Translation: ${r.translation}\n` +
            `Raw: ${r.raw}`
        );
        continue;
      }
    }
    output.push('\n');
  }

  return new Response(output.join('\n'), {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
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
