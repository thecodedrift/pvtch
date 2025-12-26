import { redirect } from 'react-router';
import type { Route } from './+types/start';
import { cloudflareEnvironmentContext } from '@/context';

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.get(cloudflareEnvironmentContext);

  const u = new URL('https://id.twitch.tv/oauth2/authorize');
  u.searchParams.set('client_id', env.TWITCH_CLIENT_ID ?? '');
  u.searchParams.set('response_type', 'code');
  u.searchParams.set(
    'redirect_uri',
    env.TWITCH_REDIRECT_URI ?? 'http://localhost:5173/auth/callback'
  );
  u.searchParams.set('scope', '');

  // TODO: state info? app you were on, csrf, etc

  return redirect(u.toString());
}
