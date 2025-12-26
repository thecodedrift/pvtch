import { useMemo, useEffect } from 'react';
import { useFetcher, useLoaderData, data } from 'react-router';
import { useForm } from '@tanstack/react-form';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import type { Route } from './+types/lingo';
import { cloudflareEnvironmentContext } from '@/context';
import { normalizeKey } from '@/lib/normalize-key';
import { isValidToken } from '@/lib/twitch-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import RequireTwitchLogin from '@/components/require-twitch-login';
import type { TTLOptions } from '@@/do/backend';

// Firebot setup images
import firebotCreateEvent from './_lingo-assets/firebot/create_event.png';
import firebotHttpRequest from './_lingo-assets/firebot/http_request.png';
import firebotConditional from './_lingo-assets/firebot/conditional.png';
import firebotChat from './_lingo-assets/firebot/chat.png';

// MixItUp setup images
import mixitupChatReceived from './_lingo-assets/mixitup/chat_received.png';
import mixitupSpecialIdentifier from './_lingo-assets/mixitup/special_identifier.png';
import mixitupWebRequest from './_lingo-assets/mixitup/web_request.png';
import mixitupConditionalChat from './_lingo-assets/mixitup/conditional_chat.png';

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
    { title: 'Lingo - Chat Translator for Twitch Streams - PVTCH' },
    {
      name: 'description',
      content:
        'Translate Twitch chat messages in real-time with well-establlished language models. Connect global audiences by auto-translating foreign language messages. Works with Firebot, MixItUp, and more.',
    },
    {
      property: 'og:title',
      content: 'Lingo - Chat Translator for Twitch Streams',
    },
    {
      property: 'og:description',
      content:
        'Translate Twitch chat messages in real-time. Connect global audiences by auto-translating foreign language messages.',
    },
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
  const configKey = 'lingo-config';
  const botsRaw = (formData.get('bots') as string) ?? '';
  const languageRaw = (formData.get('language') as string) ?? 'en';

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
  const translateAllUrl = `https://www.pvtch.com/lingo/translate/${loaderData.token}?user=SENDINGUSER&message=MESSAGEHERE`;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Lingo Translator</h1>
      <p className="text-muted-foreground mb-6">
        Configure your translation settings here.
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
                  Any bots or users you want to ignore. Messages from these
                  users will never be translated. Separate names with commas.
                  (max 15)
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
                  placeholder="english"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldDescription>
                  A two-letter language code (like "en" for English, "es" for
                  Spanish, etc) or the full name of the language you speak. This
                  is what you'll get replies in.
                </FieldDescription>
              </Field>
            )}
          />
          <div className="flex flex-row items-center justify-end">
            <Button
              variant="action"
              type="submit"
              disabled={fetcher.state !== 'idle'}
            >
              {fetcher.state !== 'idle' ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </form>

      {/* URLs Section */}
      <div className="mt-8 space-y-4">
        <Field>
          <FieldLabel>Translate All URL</FieldLabel>
          <div className="flex gap-2">
            <Input
              type="password"
              readOnly
              value={translateAllUrl}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(translateAllUrl);
                toast.success('URL copied to clipboard');
              }}
            >
              <Copy className="size-4" />
            </Button>
          </div>
          <FieldDescription>
            Translates a message to your configured language (only if it's in a
            different language)
          </FieldDescription>
        </Field>
      </div>

      {/* Setup Guide Section */}
      <SetupGuide translateUrl={translateAllUrl} />
    </div>
  );
}

function SetupGuide({ translateUrl }: { translateUrl: string }) {
  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold mb-4">Setup Guide</h2>
      <div>
        <p className="text-muted-foreground mb-4">
          When translating messages from chat, you'll send the entire message
          along with the sender's username. If the language is different from
          your target language, you'll get back a translated version.
        </p>

        <div className="bg-muted p-3 rounded-md mb-6 font-mono text-sm">
          [nl] This is translated text from Dutch (nl) to English (en)
        </div>

        <Tabs defaultValue="firebot">
          <TabsList className="mb-4">
            <TabsTrigger value="firebot">Firebot</TabsTrigger>
            <TabsTrigger value="streamerbot">Streamer.bot</TabsTrigger>
            <TabsTrigger value="mixitup">MixItUp</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>

          <TabsContent value="firebot" className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Create a new Event</h3>
              <p className="text-muted-foreground mb-3">
                In the Firebot app, go to the <strong>Events</strong> section
                and create a new event associated with{' '}
                <code className="bg-muted px-1 rounded">
                  Chat Message (Twitch)
                </code>
              </p>
              <img
                src={firebotCreateEvent}
                alt="Creating a new Firebot Event"
                className="border rounded-lg shadow-md"
              />
            </div>

            <div>
              <h3 className="font-semibold mb-2">The Three Event Effects</h3>
              <p className="text-muted-foreground mb-2">
                Your Firebot Event will have three effects:
              </p>
              <ol className="list-decimal list-inside text-muted-foreground mb-3 space-y-1">
                <li>HTTP Request (send the message to Lingo)</li>
                <li>
                  Conditional Effects (chat only if there is a translation)
                </li>
                <li>
                  Conditional Effect → Chat (send translation to your channel)
                </li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold mb-2">1. HTTP Request Effect</h3>
              <p className="text-muted-foreground mb-2">
                In the HTTP Request effect, set it up as follows:
              </p>
              <p className="text-muted-foreground mb-2">
                <strong>URL:</strong> Use this URL with Firebot variables:
              </p>
              <div className="bg-muted p-2 rounded-md mb-2 font-mono text-xs break-all">
                {translateUrl
                  .replace('SENDINGUSER', '$user')
                  .replace('MESSAGEHERE', '$encodeForUrl[$chatMessage]')}
              </div>
              <p className="text-muted-foreground mb-3">
                <strong>Method:</strong> GET
              </p>
              <img
                src={firebotHttpRequest}
                alt="Firebot HTTP Request Effect Setup"
                className="border rounded-lg shadow-md"
              />
            </div>

            <div>
              <h3 className="font-semibold mb-2">2. Conditional Effects</h3>
              <p className="text-muted-foreground mb-2">
                Add a Conditional Effect to check if the response got data back.
              </p>
              <p className="text-muted-foreground mb-3">
                <strong>Condition (all):</strong>{' '}
                <code className="bg-muted px-1 rounded">
                  $effectOutput[httpResponse]
                </code>{' '}
                is not blank
              </p>
              <img
                src={firebotConditional}
                alt="Firebot Conditional Effect Setup"
                className="border rounded-lg shadow-md"
              />
            </div>

            <div>
              <h3 className="font-semibold mb-2">
                3. Chat Effect (in conditional)
              </h3>
              <p className="text-muted-foreground mb-2">
                In the Chat effect, reply to the original poster:
              </p>
              <ul className="text-muted-foreground mb-3 space-y-1">
                <li>
                  <strong>Chat as:</strong> Bot
                </li>
                <li>
                  <strong>Message:</strong>{' '}
                  <code className="bg-muted px-1 rounded">
                    $effectOutput[httpResponse]
                  </code>
                </li>
                <li>
                  <strong>Send as reply:</strong> Yes
                </li>
              </ul>
              <img
                src={firebotChat}
                alt="Firebot Chat Effect Setup"
                className="border rounded-lg shadow-md"
              />
            </div>
          </TabsContent>

          <TabsContent value="streamerbot">
            <p className="text-muted-foreground">
              Coming soon. If you'd like to write this guide, please reach out
              on{' '}
              <a
                href="https://github.com/jakobo/pvtch"
                className="text-primary underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
              !
            </p>
          </TabsContent>

          <TabsContent value="mixitup" className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">
                Create a new Chat Message Received Event
              </h3>
              <p className="text-muted-foreground mb-3">
                The Chat Message Received event triggers whenever a message is
                sent in your chat. Find the event under{' '}
                <strong>Events → Chat</strong> (not Twitch).
              </p>
              <img
                src={mixitupChatReceived}
                alt="Creating a Chat Received Event in MixItUp"
                className="border rounded-lg shadow-md"
              />
            </div>

            <div>
              <h3 className="font-semibold mb-2">The Three Event Actions</h3>
              <ol className="list-decimal list-inside text-muted-foreground mb-3 space-y-1">
                <li>Special Identifier Action - prepare the message</li>
                <li>Web Request Action - send the message to PVTCH</li>
                <li>Conditional + Chat Action - send translation to channel</li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold mb-2">
                1. Special Identifier Action
              </h3>
              <ul className="text-muted-foreground mb-3 space-y-1">
                <li>
                  <strong>Name:</strong>{' '}
                  <code className="bg-muted px-1 rounded">encodedMessage</code>
                </li>
                <li>
                  <strong>Value:</strong>{' '}
                  <code className="bg-muted px-1 rounded">
                    uriescape($message)
                  </code>
                </li>
              </ul>
              <img
                src={mixitupSpecialIdentifier}
                alt="Setting Up the MixItUp Special Identifier"
                className="border rounded-lg shadow-md"
              />
            </div>

            <div>
              <h3 className="font-semibold mb-2">2. Web Request Action</h3>
              <p className="text-muted-foreground mb-2">
                <strong>URL:</strong> Use this URL with MixItUp variables:
              </p>
              <div className="bg-muted p-2 rounded-md mb-2 font-mono text-xs break-all">
                {translateUrl
                  .replace('SENDINGUSER', '$user')
                  .replace('MESSAGEHERE', '$encodedMessage')}
              </div>
              <p className="text-muted-foreground mb-3">
                <strong>Response Processing Type:</strong> Plain Text
              </p>
              <img
                src={mixitupWebRequest}
                alt="The MixItUp Web Request Action"
                className="border rounded-lg shadow-md"
              />
            </div>

            <div>
              <h3 className="font-semibold mb-2">
                3. Conditional and Chat Actions
              </h3>
              <p className="text-muted-foreground mb-2">
                Add a Conditional Action to check if PVTCH returned data:
              </p>
              <ul className="text-muted-foreground mb-3 space-y-1">
                <li>
                  <strong>First Value:</strong>{' '}
                  <code className="bg-muted px-1 rounded">
                    $webrequestresult
                  </code>
                </li>
                <li>
                  <strong>Compare:</strong>{' '}
                  <code className="bg-muted px-1 rounded">{'<>'}</code>
                </li>
                <li>
                  <strong>Second Value:</strong> (blank)
                </li>
              </ul>
              <p className="text-muted-foreground mb-2">
                <strong>Chat Message:</strong>{' '}
                <code className="bg-muted px-1 rounded">
                  @$user $webrequestresult
                </code>
              </p>
              <img
                src={mixitupConditionalChat}
                alt="MixItUp Conditional Action Setup"
                className="border rounded-lg shadow-md"
              />
            </div>
          </TabsContent>

          <TabsContent value="custom">
            <p className="text-muted-foreground">
              Coming soon. If you'd like to write this guide, please reach out
              on{' '}
              <a
                href="https://github.com/jakobo/pvtch"
                className="text-primary underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
              !
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
