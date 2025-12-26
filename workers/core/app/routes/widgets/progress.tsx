import { useState, useMemo } from 'react';
import { useFetcher, useLoaderData, data } from 'react-router';
import { useForm, useStore } from '@tanstack/react-form';
import { toast } from 'sonner';
import type { Route } from './+types/progress';
import { cloudflareEnvironmentContext } from '@/context';
import { normalizeKey } from '@/lib/normalize-key';
import { isValidToken } from '@/lib/twitch-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field';
import { BasicBar } from '@/components/progress-bar';
import RequireTwitchLogin from '@/components/require-twitch-login';
import { cn } from '@/lib/utils';
import type { TTLOptions } from '@@/do/backend';

// Helper to parse cookies from request
function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [key, ...val] = c.trim().split('=');
      return [key, val.join('=')];
    })
  );
}

const defaults = {
  fg1: '#ffffff',
  fg2: '#ffffff',
  bg: '#000000',
  goal: 100,
  text: '',
  decimal: 0,
  prefix: '',
};

type ProgressConfig = typeof defaults;

const parseConfig = (configString?: string): ProgressConfig => {
  if (!configString || configString.length === 0) {
    return defaults;
  }

  let parsed: Partial<ProgressConfig> = {};
  try {
    parsed = JSON.parse(configString);
  } catch {
    // ignore parse errors
  }

  return {
    fg1: parsed.fg1 ?? defaults.fg1,
    fg2: parsed.fg2 ?? defaults.fg2,
    bg: parsed.bg ?? defaults.bg,
    goal: parsed.goal ?? defaults.goal,
    text: parsed.text ?? defaults.text,
    decimal: parsed.decimal ?? defaults.decimal,
    prefix: parsed.prefix ?? defaults.prefix,
  };
};

export function meta(_args: Route.MetaArgs) {
  return [
    { title: 'Progress Bar - PVTCH' },
    { name: 'description', content: 'Configure your OBS progress bar' },
  ];
}

// Loader: fetch config from Durable Object using token from cookie
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(cloudflareEnvironmentContext);
  const cookies = parseCookies(request.headers.get('Cookie'));
  const token = cookies['pvtch_token'];

  // If no token, return unauthenticated state
  if (!token) {
    return data({ authenticated: false as const });
  }

  // Validate token
  const userid = await isValidToken(token, env);
  if (!userid) {
    return data({ authenticated: false as const });
  }

  // Get the progress ID from URL search params (default to 'default')
  const url = new URL(request.url);
  const id = url.searchParams.get('id') ?? 'default';
  const configKey = `progress-${id}-config`;

  // Fetch config from Durable Object
  const normalizedKey = normalizeKey(token, configKey);
  const cdo = env.PVTCH_BACKEND.idFromName(normalizedKey);
  const stub = env.PVTCH_BACKEND.get(cdo);
  const configString = await stub.get();

  return data({
    authenticated: true as const,
    token,
    id,
    configKey,
    config: parseConfig(configString),
  });
}

// Action: save config to Durable Object
export async function action({ request, context }: Route.ActionArgs) {
  const env = context.get(cloudflareEnvironmentContext);
  const cookies = parseCookies(request.headers.get('Cookie'));
  const token = cookies['pvtch_token'];

  if (!token) {
    return data(
      { success: false, error: 'Not authenticated' },
      { status: 401 }
    );
  }

  const userid = await isValidToken(token, env);
  if (!userid) {
    return data({ success: false, error: 'Invalid token' }, { status: 400 });
  }

  const formData = await request.formData();
  const id = (formData.get('id') as string) ?? 'default';
  const configKey = `progress-${id}-config`;
  const configValue = formData.get('config') as string;

  // Save to Durable Object with extended TTL for config
  const ttlOptions: TTLOptions = {
    strategy: 'PRESERVE_ON_FETCH',
    ttlMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  };

  const normalizedKey = normalizeKey(token, configKey);
  const cdo = env.PVTCH_BACKEND.idFromName(normalizedKey);
  const stub = env.PVTCH_BACKEND.get(cdo);
  await stub.set(configValue, ttlOptions);

  return data({ success: true });
}

export default function WidgetsProgress() {
  const loaderData = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [tempId, setTempId] = useState('default');
  const [changingId, setChangingId] = useState(false);

  // Get current ID from loader data or default
  const currentId = loaderData.authenticated ? loaderData.id : 'default';

  // Parse config from loader
  const config = useMemo(() => {
    if (!loaderData.authenticated) return defaults;
    return loaderData.config;
  }, [loaderData]);

  const form = useForm({
    defaultValues: config,
    onSubmit: async ({ value }) => {
      if (!loaderData.authenticated) return;

      const formData = new FormData();
      formData.append('id', currentId);
      formData.append('config', JSON.stringify(value));

      fetcher.submit(formData, { method: 'POST' });
      toast.success('Progress bar configuration saved!');
    },
  });

  const formState = useStore(form.store, (s) => s.values);

  // Not authenticated - show login prompt
  if (!loaderData.authenticated) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Progress Bar</h1>
        <RequireTwitchLogin />
      </div>
    );
  }

  // Generate URLs for display
  const progressUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/sources/progress/${loaderData.token}/${currentId}`
      : '';
  const updateUrl = `https://www.pvtch.com/progress/${loaderData.token}/${currentId}/set?value=UPDATEME`;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Progress Bar</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        {/* ID Selector */}
        <div className="flex flex-row gap-2 pb-4">
          <Input
            value={changingId ? tempId : currentId}
            name="id-selector"
            readOnly={!changingId}
            className={!changingId ? 'pointer-events-none opacity-50' : ''}
            onChange={(e) => setTempId(e.target.value)}
          />
          {changingId ? (
            <>
              <Button
                variant="default"
                type="button"
                onClick={() => {
                  setTempId(currentId);
                  setChangingId(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="action"
                type="button"
                onClick={() => {
                  // Navigate to new ID (triggers loader refetch)
                  window.location.search = `?id=${tempId}`;
                }}
              >
                Load
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => {
                  setTempId(currentId);
                  setChangingId(true);
                }}
                variant="default"
                type="button"
              >
                Switch
              </Button>
              <Button
                variant="action"
                type="submit"
                disabled={fetcher.state !== 'idle'}
              >
                {fetcher.state !== 'idle' ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
        </div>

        {/* Live Preview (sticky) */}
        <div className="sticky top-16 z-10 bg-background py-2">
          <div className="relative h-12 w-full rounded overflow-hidden">
            <BasicBar
              bg={formState.bg}
              fg1={formState.fg1}
              fg2={formState.fg2}
              goal={formState.goal}
              text={formState.text}
              decimal={formState.decimal}
              prefix={formState.prefix}
              progress={64}
              embedded
            />
          </div>
        </div>

        {/* Form Fields */}
        <div
          className={cn(
            'flex flex-col gap-6 pt-4',
            changingId ? 'pointer-events-none opacity-50' : ''
          )}
        >
          <form.Field
            name="bg"
            children={(field) => (
              <Field>
                <FieldLabel htmlFor="bg">Bar Background</FieldLabel>
                <Input
                  id="bg"
                  autoComplete="off"
                  placeholder="#000000"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  readOnly={changingId}
                />
                <FieldDescription>
                  The color for the uncompleted part of the bar
                </FieldDescription>
              </Field>
            )}
          />
          <form.Field
            name="fg1"
            children={(field) => (
              <Field>
                <FieldLabel htmlFor="fg1">Filled Background 1</FieldLabel>
                <Input
                  id="fg1"
                  autoComplete="off"
                  placeholder="#990000"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  readOnly={changingId}
                />
                <FieldDescription>
                  The color for the completed part of the bar
                </FieldDescription>
              </Field>
            )}
          />
          <form.Field
            name="fg2"
            children={(field) => (
              <Field>
                <FieldLabel htmlFor="fg2">Filled Background 2</FieldLabel>
                <Input
                  id="fg2"
                  autoComplete="off"
                  placeholder="#aa0000"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  readOnly={changingId}
                />
                <FieldDescription>
                  The second color for the completed bar, make it slightly
                  brighter for a cool gradient effect
                </FieldDescription>
              </Field>
            )}
          />
          <form.Field
            name="goal"
            children={(field) => (
              <Field>
                <FieldLabel htmlFor="goal">Goal Amount</FieldLabel>
                <Input
                  id="goal"
                  autoComplete="off"
                  placeholder="100"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) =>
                    field.handleChange(parseInt(e.target.value, 10) || 0)
                  }
                  readOnly={changingId}
                />
                <FieldDescription>
                  Your arbitrary goal amount. You got this!
                </FieldDescription>
              </Field>
            )}
          />
          <form.Field
            name="text"
            children={(field) => (
              <Field>
                <FieldLabel htmlFor="text">Goal Text</FieldLabel>
                <Input
                  id="text"
                  autoComplete="off"
                  placeholder="My Goal Name"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  readOnly={changingId}
                />
                <FieldDescription>
                  Name your goal, or leave it blank if you'd rather do it in OBS
                </FieldDescription>
              </Field>
            )}
          />
          <form.Field
            name="prefix"
            children={(field) => (
              <Field>
                <FieldLabel htmlFor="prefix">Prefix</FieldLabel>
                <Input
                  id="prefix"
                  autoComplete="off"
                  placeholder=""
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  readOnly={changingId}
                />
                <FieldDescription>
                  Add a prefix before Progress and Goal numbers, e.g. "$" or
                  "Level "
                </FieldDescription>
              </Field>
            )}
          />
          <form.Field
            name="decimal"
            children={(field) => (
              <Field>
                <FieldLabel htmlFor="decimal">Round Progress Places</FieldLabel>
                <Input
                  id="decimal"
                  autoComplete="off"
                  placeholder="0"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) =>
                    field.handleChange(parseInt(e.target.value, 10) || 0)
                  }
                  readOnly={changingId}
                />
                <FieldDescription>
                  Round the progress number to this many decimal places, great
                  if you're doing a bunch of math in your bot
                </FieldDescription>
              </Field>
            )}
          />
        </div>
      </form>

      {/* URLs Section */}
      <div className="mt-8 space-y-4">
        <div>
          <h3 className="font-semibold mb-2">OBS Browser Source URL</h3>
          <code className="block p-2 bg-muted rounded text-sm break-all">
            {progressUrl}
          </code>
        </div>
        <div>
          <h3 className="font-semibold mb-2">Update API URL</h3>
          <code className="block p-2 bg-muted rounded text-sm break-all">
            {updateUrl}
          </code>
        </div>
      </div>
    </div>
  );
}
