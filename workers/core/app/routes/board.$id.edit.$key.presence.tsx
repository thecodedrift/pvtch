import { data } from 'react-router';
import type { Route } from './+types/board.$id.edit.$key.presence';
import { cloudflareEnvironmentContext } from '@/context';
import { parseBoardId } from '@/lib/board-id';

export async function action({ params, request, context }: Route.ActionArgs) {
  const parsed = parseBoardId(params.id);
  if (!parsed) {
    return data({ error: 'not_found' as const }, { status: 404 });
  }

  const env = context.get(cloudflareEnvironmentContext);
  const stub = env.PVTCH_USER.get(
    env.PVTCH_USER.idFromName(`twitch:${parsed.userId}`)
  );

  const formData = await request.formData();
  const sessionIdRaw = formData.get('sessionId');
  const nameRaw = formData.get('name');
  const sessionId = typeof sessionIdRaw === 'string' ? sessionIdRaw : '';
  const name = typeof nameRaw === 'string' ? nameRaw : '';

  // Cap sessionId at 32 chars and restrict to URL-safe characters. The
  // client generates 10-char nanoids, so a real session always fits well
  // within this limit; the cap exists to keep a misbehaving caller from
  // bloating per-board storage by submitting megabyte session IDs (the
  // value is the primary key of board_presence rows on the User DO).
  if (
    !sessionId ||
    sessionId.length > 32 ||
    !/^[A-Za-z0-9_-]+$/.test(sessionId)
  ) {
    return data({ error: 'bad_request' as const }, { status: 400 });
  }

  using boardPlugin = await stub.board();
  const result = await boardPlugin.heartbeat(
    parsed.slotId,
    params.key,
    sessionId,
    name
  );

  if ('error' in result) {
    if (result.error === 'forbidden') {
      return data({ error: 'forbidden' as const }, { status: 403 });
    }
    return data({ error: 'not_found' as const }, { status: 404 });
  }

  return data({ ok: true });
}
