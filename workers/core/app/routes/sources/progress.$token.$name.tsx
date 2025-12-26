import { useEffect, useState } from 'react';
import { useLoaderData, useRevalidator, data } from 'react-router';
import type { Route } from './+types/progress.$token.$name';
import { cloudflareEnvironmentContext } from '@/context';
import { normalizeKey } from '@/lib/normalize-key';
import { isValidToken } from '@/lib/twitch-data';
import { BasicBar } from '@/components/progress-bar';
import { defaults as progressDefaults } from '@/components/progress-bar/options';

const POLL_INTERVAL = 3000; // ms

type ProgressConfig = {
  fg1: string;
  fg2: string;
  bg: string;
  goal: number;
  text: string;
  decimal: number;
  prefix: string;
};

const parseConfig = (configString?: string): ProgressConfig => {
  if (!configString || configString.length === 0) {
    return {
      fg1: progressDefaults.fg1,
      fg2: progressDefaults.fg2,
      bg: progressDefaults.bg,
      goal: progressDefaults.goal,
      text: progressDefaults.text ?? '',
      decimal: progressDefaults.decimal,
      prefix: progressDefaults.prefix ?? '',
    };
  }

  try {
    const parsed = JSON.parse(configString);
    return {
      fg1: parsed.fg1 ?? progressDefaults.fg1,
      fg2: parsed.fg2 ?? progressDefaults.fg2,
      bg: parsed.bg ?? progressDefaults.bg,
      goal: parsed.goal ?? progressDefaults.goal,
      text: parsed.text ?? progressDefaults.text ?? '',
      decimal: parsed.decimal ?? progressDefaults.decimal,
      prefix: parsed.prefix ?? progressDefaults.prefix ?? '',
    };
  } catch {
    return {
      fg1: progressDefaults.fg1,
      fg2: progressDefaults.fg2,
      bg: progressDefaults.bg,
      goal: progressDefaults.goal,
      text: progressDefaults.text ?? '',
      decimal: progressDefaults.decimal,
      prefix: progressDefaults.prefix ?? '',
    };
  }
};

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Progress: ${params.name}` }];
}

// Loader: fetch both config and current progress value from Durable Objects
export async function loader({ params, context }: Route.LoaderArgs) {
  const env = context.get(cloudflareEnvironmentContext);
  const { token, name } = params;

  // Validate token
  const userid = await isValidToken(token, env);
  if (!userid) {
    return data(
      { valid: false as const, error: 'Invalid token' },
      { status: 400 }
    );
  }

  const progressKey = `progress-${name}`;
  const configKey = `progress-${name}-config`;

  // Fetch config from Durable Object
  const configNormalizedKey = normalizeKey(token, configKey);
  const configCdo = env.PVTCH_BACKEND.idFromName(configNormalizedKey);
  const configStub = env.PVTCH_BACKEND.get(configCdo);
  const configString = await configStub.get();

  // Fetch current progress value from Durable Object
  const progressNormalizedKey = normalizeKey(token, progressKey);
  const progressCdo = env.PVTCH_BACKEND.idFromName(progressNormalizedKey);
  const progressStub = env.PVTCH_BACKEND.get(progressCdo);
  const progressString = await progressStub.get();

  const progress = parseFloat(progressString) || 0;
  const config = parseConfig(configString);

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
        revalidator.revalidate();
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
