import { useState, useMemo, useEffect, useRef } from 'react';
import { useFetcher, useLoaderData, data } from 'react-router';
import { useForm, useStore } from '@tanstack/react-form';
import { toast } from 'sonner';
import { RgbaStringColorPicker } from 'react-colorful';
import type { Route } from './+types/progress';
import { cloudflareEnvironmentContext } from '@/context';
import { normalizeKey } from '@/lib/normalize-key';
import { isValidToken, DEV_TOKEN } from '@/lib/twitch-data';
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

function ColorPicker({
  color,
  onChange,
  label,
}: {
  color: string;
  onChange: (color: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-md border px-3 py-2 not-prose"
      >
        <div
          className="h-5 w-5 rounded-sm border"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm">{label}</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-2 rounded-lg border bg-background p-3 shadow-lg not-prose">
          <RgbaStringColorPicker color={color} onChange={onChange} />
          <Input
            className="mt-2 font-mono text-xs"
            value={color}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

const defaults = {
  fg1: 'rgba(255, 255, 255, 1)',
  fg2: 'rgba(255, 255, 255, 1)',
  bg: 'rgba(0, 0, 0, 1)',
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
    { title: 'Progress Bar Widget for OBS & Twitch Streams - PVTCH' },
    {
      name: 'description',
      content:
        'Create customizable progress bars for your Twitch stream. Track sub goals, donations, or any metric with real-time OBS browser source overlays. Free and open source.',
    },
    {
      property: 'og:title',
      content: 'Progress Bar Widget for OBS & Twitch Streams',
    },
    {
      property: 'og:description',
      content:
        'Create customizable progress bars for your Twitch stream. Track sub goals, donations, or any metric with real-time OBS overlays.',
    },
  ];
}

// Loader: fetch config from Durable Object using token from cookie
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(cloudflareEnvironmentContext);
  const cookies = parseCookies(request.headers.get('Cookie'));
  const token =
    cookies['pvtch_token'] || (env.DEV_TWITCH_USER_ID ? DEV_TOKEN : undefined);

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
  const token =
    cookies['pvtch_token'] || (env.DEV_TWITCH_USER_ID ? DEV_TOKEN : undefined);

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
    <div className="prose dark:prose-invert max-w-none">
      <h1>Progress Bar</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        {/* ID Selector */}
        <div className="flex flex-row gap-2 pb-4 not-prose">
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
        <div className="sticky top-16 z-10 bg-background py-2 not-prose">
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
            'flex flex-col gap-6 pt-4 not-prose',
            changingId ? 'pointer-events-none opacity-50' : ''
          )}
        >
          <div className="flex flex-wrap gap-4">
            <form.Field
              name="bg"
              children={(field) => (
                <ColorPicker
                  color={field.state.value}
                  onChange={(c) => field.handleChange(c)}
                  label="Background"
                />
              )}
            />
            <form.Field
              name="fg1"
              children={(field) => (
                <ColorPicker
                  color={field.state.value}
                  onChange={(c) => field.handleChange(c)}
                  label="Fill 1"
                />
              )}
            />
            <form.Field
              name="fg2"
              children={(field) => (
                <ColorPicker
                  color={field.state.value}
                  onChange={(c) => field.handleChange(c)}
                  label="Fill 2"
                />
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <form.Field
              name="goal"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor="goal">Goal Amount</FieldLabel>
                  <Input
                    id="goal"
                    type="number"
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
                    Your arbitrary goal amount
                  </FieldDescription>
                </Field>
              )}
            />
            <form.Field
              name="decimal"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor="decimal">Decimal Places</FieldLabel>
                  <Input
                    id="decimal"
                    type="number"
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
                    Round progress to N places
                  </FieldDescription>
                </Field>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
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
                  <FieldDescription>Name your goal</FieldDescription>
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
                    placeholder="$"
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    readOnly={changingId}
                  />
                  <FieldDescription>e.g. "$" or "Level "</FieldDescription>
                </Field>
              )}
            />
          </div>
        </div>
      </form>

      {/* URLs Section */}
      <div className="mt-8 space-y-4 not-prose">
        <Field>
          <FieldLabel>OBS Browser Source URL</FieldLabel>
          <Input type="password" readOnly value={progressUrl} />
        </Field>
        <Field>
          <FieldLabel>Update API URL</FieldLabel>
          <Input type="password" readOnly value={updateUrl} />
        </Field>
      </div>

      {/* How to Use Guide */}
      <div className="mt-10 space-y-6">
        <h2>How to Use</h2>

        <div>
          <h3>1. Add to OBS</h3>
          <p className="text-muted-foreground">
            In OBS, add a <strong>Browser Source</strong> and paste the OBS
            Browser Source URL above. The bar automatically scales its text up
            or down to fit your source size, so pick whatever dimensions work
            for your layout.
          </p>
        </div>

        <div>
          <h3>2. Update Progress</h3>
          <p className="text-muted-foreground">
            Use the Update API URL to set the current progress value. Replace{' '}
            <code>UPDATEME</code> with a number and hit the URL from your bot,
            StreamerBot, MixItUp, Firebot, or any tool that can make HTTP
            requests. Think of this widget as a progress{' '}
            <strong>displayer</strong> &mdash; keep the value in whatever system
            makes sense for you.
          </p>
        </div>

        <div>
          <h3>3. Tips</h3>
          <ul className="text-muted-foreground list-disc ml-4 space-y-1">
            <li>
              Use two slightly different fill colors for a gradient effect on
              the completed portion of the bar
            </li>
            <li>
              To resize, set new height and width in the browser source
              properties &mdash; dragging and resizing inside OBS stretches
              pixels like an image, resulting in fuzzy text. Change the
              height/width and you&apos;ll get a beautiful widget every time.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
