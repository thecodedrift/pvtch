import { redirect } from 'react-router';
import type { Route } from './+types/board.new';
import {
  cloudflareEnvironmentContext,
  instanceAccessContext,
  userContext,
} from '@/context';
import { composeBoardId } from '@/lib/board-id';
import { authMiddleware } from '@/middleware/auth';

export const middleware: Route.MiddlewareFunction[] = [authMiddleware];

export async function action({ context }: Route.ActionArgs) {
  const access = context.get(instanceAccessContext);
  if (access?.isPrivate && !access?.isAllowed) {
    return redirect('/private');
  }

  const user = context.get(userContext);
  if (!user) {
    return redirect('/board');
  }

  const env = context.get(cloudflareEnvironmentContext);
  const stub = env.PVTCH_USER.get(
    env.PVTCH_USER.idFromName(`twitch:${user.id}`)
  );

  using boardPlugin = await stub.board();
  const result = await boardPlugin.create();

  if ('error' in result) {
    return redirect('/board');
  }

  const boardId = composeBoardId(user.id, result.slotId);
  return redirect(`/board/${boardId}/edit/${result.editKey}`);
}

export function loader() {
  // Direct GET to /board/new isn't a useful surface; bounce to the list.
  return redirect('/board');
}
