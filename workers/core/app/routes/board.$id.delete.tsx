import { data, redirect } from 'react-router';
import type { Route } from './+types/board.$id.delete';
import { cloudflareEnvironmentContext, userContext } from '@/context';
import { parseBoardId } from '@/lib/board-id';
import { authMiddleware } from '@/middleware/auth';

export const middleware: Route.MiddlewareFunction[] = [authMiddleware];

export async function action({ params, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    return data({ error: 'unauthorized' as const }, { status: 401 });
  }

  const parsed = parseBoardId(params.id);
  if (!parsed) {
    return data({ error: 'not_found' as const }, { status: 404 });
  }

  if (parsed.userId !== user.id) {
    return data({ error: 'forbidden' as const }, { status: 403 });
  }

  const env = context.get(cloudflareEnvironmentContext);
  const stub = env.PVTCH_USER.get(
    env.PVTCH_USER.idFromName(`twitch:${user.id}`)
  );

  using boardPlugin = await stub.board();
  await boardPlugin.delete(parsed.slotId);

  return redirect('/board');
}
