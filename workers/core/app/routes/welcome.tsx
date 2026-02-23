import { Link, useLoaderData, data } from 'react-router';
import type { Route } from './+types/welcome';
import { cloudflareEnvironmentContext } from '@/context';
import {
  isValidToken,
  twitchDataKeyPrefix,
  type TwitchUserData,
} from '@/lib/twitch-data';
import RequireTwitchLogin from '@/components/require-twitch-login';

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [key, ...val] = c.trim().split('=');
      return [key, val.join('=')];
    }),
  );
}

export function meta(_args: Route.MetaArgs) {
  return [
    { title: 'Welcome to PVTCH' },
    {
      name: 'description',
      content: 'Welcome to PVTCH — free tools for Twitch streamers.',
    },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(cloudflareEnvironmentContext);
  const cookies = parseCookies(request.headers.get('Cookie'));
  const token = cookies['pvtch_token'];

  const userid = await isValidToken(token, env);
  if (!userid) {
    return data({ authenticated: false as const, displayName: '' });
  }

  const userData = await env.PVTCH_ACCOUNTS.get<TwitchUserData>(
    `${twitchDataKeyPrefix}${userid}`,
    'json',
  );

  return data({
    authenticated: true as const,
    displayName: userData?.display_name ?? '',
  });
}

export default function Welcome() {
  const { authenticated, displayName } = useLoaderData<typeof loader>();

  if (!authenticated) {
    return <RequireTwitchLogin />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {displayName ? `Welcome, ${displayName}!` : 'Welcome!'}
        </h1>
        <p className="mt-2 text-muted-foreground">
          PVTCH is a collection of free, open-source tools built for Twitch
          streamers. No ads, no tracking, no nonsense.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Get started</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            to="/widgets/progress"
            className="rounded-lg border border-border p-4 hover:bg-accent transition-colors"
          >
            <h3 className="font-medium">Progress Bar</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Customizable progress bars for OBS. Track sub goals, donations, or
              any metric with real-time updates.
            </p>
          </Link>
          <Link
            to="/helpers/lingo"
            className="rounded-lg border border-border p-4 hover:bg-accent transition-colors"
          >
            <h3 className="font-medium">Lingo</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Automatic chat translation powered by AI. Let your community speak
              any language and still be understood.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
