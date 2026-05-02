import { data } from 'react-router';
import type { Route } from './+types/board.$id.edit.$key.revert';
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
  const historyIdRaw = formData.get('historyId');
  const baseVersionRaw = formData.get('baseVersion');
  const editorNameRaw = formData.get('editorName');
  const historyId = Number(
    typeof historyIdRaw === 'string' ? historyIdRaw : '0'
  );
  const baseVersion = Number(
    typeof baseVersionRaw === 'string' ? baseVersionRaw : '0'
  );
  const editorName = typeof editorNameRaw === 'string' ? editorNameRaw : '';

  if (!historyId || !Number.isFinite(historyId)) {
    return data({ error: 'bad_request' as const }, { status: 400 });
  }

  using boardPlugin = await stub.board();
  const result = await boardPlugin.revert(
    parsed.slotId,
    params.key,
    historyId,
    baseVersion,
    editorName
  );

  if ('error' in result) {
    if (result.error === 'forbidden') {
      return data({ error: 'forbidden' as const }, { status: 403 });
    }
    if (result.error === 'conflict') {
      return data(
        {
          error: 'conflict' as const,
          currentContent: result.currentContent,
          currentVersion: result.currentVersion,
        },
        { status: 409 }
      );
    }
    return data({ error: 'not_found' as const }, { status: 404 });
  }

  // Re-read so the client can replace its local textarea state with the
  // content that was just restored from history.
  const updated = await boardPlugin.read(parsed.slotId);
  return data({
    ok: true as const,
    version: result.version,
    content: updated?.content ?? '',
  });
}
