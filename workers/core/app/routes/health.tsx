import type { Route } from './+types/health';

export async function loader({}: Route.LoaderArgs) {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
