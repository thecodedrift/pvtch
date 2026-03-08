import type { Route } from './+types/health';

export function loader(_args: Route.LoaderArgs) {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
