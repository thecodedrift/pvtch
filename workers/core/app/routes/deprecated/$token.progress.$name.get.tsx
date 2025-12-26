import type { Route } from './+types/$token.progress.$name.get';
import { cloudflareEnvironmentContext } from '@/context';
import { handleDeprecatedRoute } from '@/lib/deprecated-route';

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = context.get(cloudflareEnvironmentContext);
  return handleDeprecatedRoute(params.token, env);
}

export async function action({ params, context }: Route.ActionArgs) {
  const env = context.get(cloudflareEnvironmentContext);
  return handleDeprecatedRoute(params.token, env);
}
