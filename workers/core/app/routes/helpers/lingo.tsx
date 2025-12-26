import { useMemo, useEffect } from 'react';
import { useFetcher, useLoaderData, data } from 'react-router';
import { useForm } from '@tanstack/react-form';
import { toast } from 'sonner';
import type { Route } from './+types/lingo';
import { cloudflareEnvironmentContext } from '@/context';
import { normalizeKey } from '@/lib/normalize-key';
import { isValidToken } from '@/lib/twitch-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field';
import RequireTwitchLogin from '@/components/require-twitch-login';
import type { TTLOptions } from '@@/do/backend';

// Helper to parse cookies from request
function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [key, ...val] = c.trim().split('=');
      return [key, val.join('=')];
    }),
  );
}

const defaults = {
  bots: [] as string[],
  language: 'en',
};

type LingoConfig = typeof defaults;

const trimToLength = (str: string, maxLength: number) => {
  const segmenter = new Intl.Segmenter('en-US', { granularity: 'grapheme' });
  const chunks = Array.from(segmenter.segment(str));
  if (chunks.length <= maxLength) {
    return str;
  }
  return chunks
    .slice(0, maxLength)
    .map((c) => c.segment)
    .join('');
};

const parseConfig = (configString?: string): LingoConfig => {
  if (!configString || configString.length === 0) {
    return defaults;
  }

  let parsed: Partial<LingoConfig> = {};
  try {
    parsed = JSON.parse(configString);
  } catch {
    // ignore parse errors
  }

  return {
    bots: [parsed.bots ?? defaults.bots].flat().filter((v) => v !== undefined),
    language: parsed.language ?? defaults.language,
  };
};

export function meta(_args: Route.MetaArgs) {
  return [
    { title: 'Lingo Translator - PVTCH' },
    { name: 'description', content: 'Configure Lingo translation settings' },
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

  const configKey = 'lingo-config';

  // Fetch config from Durable Object
  const normalizedKey = normalizeKey(token, configKey);
  const cdo = env.PVTCH_BACKEND.idFromName(normalizedKey);
  const stub = env.PVTCH_BACKEND.get(cdo);
  const configString = await stub.get();

  return data({
    authenticated: true as const,
    token,
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
    return data({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const userid = await isValidToken(token, env);
  if (!userid) {
    return data({ success: false, error: 'Invalid token' }, { status: 400 });
  }

  const formData = await request.formData();
  const configKey = 'lingo-config';
  const botsRaw = formData.get('bots') as string ?? '';
  const languageRaw = formData.get('language') as string ?? 'en';

  // Process bots list
  const bots = botsRaw
    .split(',')
    .map((b) => b.trim())
    .filter((b) => b.length > 0 && b.length < 64)
    .slice(0, 15);

  const language = trimToLength(languageRaw, 60);

  const configValue = JSON.stringify({ bots, language });

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

export default function HelpersLingo() {
  const loaderData = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  // Parse config from loader
  const config = useMemo(() => {
    if (!loaderData.authenticated) return defaults;
    return loaderData.config;
  }, [loaderData]);

  const form = useForm({
    defaultValues: {
      bots: config.bots.join(', '),
      language: config.language,
    },
    onSubmit: async ({ value }) => {
      if (!loaderData.authenticated) return;

      const formData = new FormData();
      formData.append('bots', value.bots);
      formData.append('language', value.language);

      fetcher.submit(formData, { method: 'POST' });
      toast.success('Lingo configuration saved!');
    },
  });

  // Reset form when config changes (loader refetch)
  useEffect(() => {
    form.reset({
      bots: config.bots.join(', '),
      language: config.language,
    });
  }, [config]);

  // Not authenticated - show login prompt
  if (!loaderData.authenticated) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Lingo Translator</h1>
        <RequireTwitchLogin />
      </div>
    );
  }

  // Generate URLs for display
  const translateAllUrl = `https://api.pvtch.com/${loaderData.token}/lingo/translate?user=SENDINGUSER&message=MESSAGEHERE`;
  const translateTargetUrl = `https://api.pvtch.com/${loaderData.token}/lingo/to/XX?user=SENDINGUSER&message=MESSAGEHERE`;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Lingo Translator</h1>
      <p className="text-muted-foreground mb-6">
        Configure your AI-powered translation settings here.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <div className="flex flex-col gap-6">
          <form.Field
            name="bots"
            children={(field) => (
              <Field>
                <FieldLabel htmlFor="bots">Ignored Bots &amp; Users</FieldLabel>
                <Input
                  id="bots"
                  autoComplete="off"
                  placeholder="yourbot, anotherbot, yetanotherbot"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldDescription>
                  Any bots or users you want to ignore. Messages from these users will
                  never be translated. Separate names with commas. (max 15)
                </FieldDescription>
              </Field>
            )}
          />
          <form.Field
            name="language"
            children={(field) => (
              <Field>
                <FieldLabel htmlFor="language">Your Language</FieldLabel>
                <Input
                  id="language"
                  autoComplete="off"
                  placeholder="en"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldDescription>
                  A two-letter language code (like "en" for English, "es" for Spanish,
                  etc) or the full name of the language you speak. This is what you'll
                  get replies in.
                </FieldDescription>
              </Field>
            )}
          />
          <div className="flex flex-row items-center justify-end">
            <Button variant="action" type="submit" disabled={fetcher.state !== 'idle'}>
              {fetcher.state !== 'idle' ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </form>

      {/* URLs Section */}
      <div className="mt-8 space-y-4">
        <div>
          <h3 className="font-semibold mb-2">Translate All URL</h3>
          <p className="text-sm text-muted-foreground mb-2">
            Translates a message to your configured language (only if it's in a different language)
          </p>
          <code className="block p-2 bg-muted rounded text-sm break-all">
            {translateAllUrl}
          </code>
        </div>
        <div>
          <h3 className="font-semibold mb-2">Translate to Specific Language URL</h3>
          <p className="text-sm text-muted-foreground mb-2">
            Replace XX with a language code (like "es", "fr", "de")
          </p>
          <code className="block p-2 bg-muted rounded text-sm break-all">
            {translateTargetUrl}
          </code>
        </div>
      </div>
    </div>
  );
}
