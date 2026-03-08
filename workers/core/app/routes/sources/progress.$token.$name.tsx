import { useEffect } from 'react';
import { useLoaderData, useRevalidator, data } from 'react-router';
import z from 'zod';
import type { Route } from './+types/progress.$token.$name';
import { cloudflareEnvironmentContext } from '@/context';
import { normalizeKey } from '@/lib/normalize-key';
import { isValidToken } from '@/lib/twitch-data';
import { BasicBar } from '@/components/progress-bar';

const POLL_INTERVAL = 3000; // ms

const DEFAULTS: {
  fg1: string;
  fg2: string;
  bg: string;
  goal: number;
  decimal: number;
  text: string;
  prefix: string;
} = {
  fg1: 'rgba(255, 255, 255, 1)',
  fg2: 'rgba(255, 255, 255, 1)',
  bg: 'rgba(0, 0, 0, 1)',
  goal: 100,
  decimal: 0,
  text: '',
  prefix: '',
};

const parameterParser = z
  .object({
    fg1: z.string().optional().default(DEFAULTS.fg1),
    fg2: z.string().optional().default(DEFAULTS.fg2),
    bg: z.string().optional().default(DEFAULTS.bg),
    goal: z
      .string()
      .optional()
      .default(`${DEFAULTS.goal}`)
      .transform((input) => {
        const value = Number.parseInt(input, 10);
        if (Number.isNaN(value) || value <= 0) {
          return DEFAULTS.goal;
        }
        return value;
      }),
    decimal: z
      .string()
      .optional()
      .default(`${DEFAULTS.decimal}`)
      .transform((input) => {
        const value = Number.parseInt(input, 10);
        if (Number.isNaN(value) || value < 0) {
          return DEFAULTS.decimal;
        }
        return value;
      }),
    text: z.string().optional().default(DEFAULTS.text),
    prefix: z.string().optional().default(DEFAULTS.prefix),
  })
  .optional()
  .default(DEFAULTS);

export { DEFAULTS };

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Progress: ${params.name}` }];
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const env = context.get(cloudflareEnvironmentContext);
  const { token, name } = params;

  const userid = await isValidToken(token, env);
  if (!userid) {
    return data(
      { valid: false as const, error: 'Invalid token' },
      { status: 400 }
    );
  }

  // Parse config from URL search params
  const url = new URL(request.url);
  const config = parameterParser.parse(
    Object.fromEntries(url.searchParams.entries())
  );

  // Fetch current progress value from Durable Object
  const progressKey = `progress-${name}`;
  const progressNormalizedKey = normalizeKey(token, progressKey);
  const progressCdo = env.PVTCH_BACKEND.idFromName(progressNormalizedKey);
  const progressStub = env.PVTCH_BACKEND.get(progressCdo);
  const progressString = await progressStub.get();

  const progress = Number.parseFloat(progressString) || 0;

  return data({
    valid: true as const,
    token,
    name,
    progressKey,
    config,
    progress,
  });
}

export default function ProgressSource() {
  const loaderData = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();

  // Poll for updates using revalidator
  useEffect(() => {
    if (!loaderData.valid) return;

    const interval = setInterval(() => {
      if (revalidator.state === 'idle') {
        void revalidator.revalidate();
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [loaderData.valid, revalidator]);

  if (!loaderData.valid) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-black text-white">
        <p>Invalid token</p>
      </div>
    );
  }

  const { config, progress } = loaderData;

  return (
    <div className="w-full h-screen bg-transparent">
      <BasicBar
        progress={progress}
        fg1={config.fg1}
        fg2={config.fg2}
        bg={config.bg}
        goal={config.goal}
        text={config.text}
        decimal={config.decimal}
        prefix={config.prefix}
      />
    </div>
  );
}
