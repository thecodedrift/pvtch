import { useState } from 'react';
import { data, redirect, useLoaderData, useFetcher, Form } from 'react-router';
import type { Route } from './+types/board._index';
import {
  cloudflareEnvironmentContext,
  instanceAccessContext,
  userContext,
} from '@/context';
import { composeBoardId, parseBoardId } from '@/lib/board-id';
import {
  MAX_BOARDS_PER_USER,
  MAX_BOARD_NAME_LENGTH,
} from '@/lib/board-constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SecretCopy } from '@/components/secret-copy';
import { AuthGate } from '@/components/auth-gate';

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Boards - PVTCH' }];
}

interface BoardListEntry {
  boardId: string;
  name: string;
  updatedAt: number;
  publicUrl: string;
  editUrl: string;
}

export async function action({ context, request }: Route.ActionArgs) {
  const access = context.get(instanceAccessContext);
  if (access?.isPrivate && !access?.isAllowed) {
    return data({ error: 'forbidden' as const }, { status: 403 });
  }

  const user = context.get(userContext);
  if (!user) {
    return data({ error: 'unauthorized' as const }, { status: 401 });
  }

  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'rename') {
    const boardId = formData.get('boardId');
    const name = formData.get('name');
    if (typeof boardId !== 'string' || typeof name !== 'string') {
      return data({ error: 'bad_request' as const }, { status: 400 });
    }
    const parsed = parseBoardId(boardId);
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
    const result = await boardPlugin.rename(parsed.slotId, name);
    if ('error' in result) {
      return data(
        { error: result.error },
        { status: result.error === 'not_found' ? 404 : 400 }
      );
    }
    return redirect('/board');
  }

  return data({ error: 'bad_request' as const }, { status: 400 });
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const access = context.get(instanceAccessContext);
  if (access?.isPrivate && !access?.isAllowed) {
    return redirect('/private');
  }

  const user = context.get(userContext);
  if (!user) {
    return data({ authenticated: false as const });
  }

  const env = context.get(cloudflareEnvironmentContext);
  const stub = env.PVTCH_USER.get(
    env.PVTCH_USER.idFromName(`twitch:${user.id}`)
  );

  using boardPlugin = await stub.board();
  const rows = await boardPlugin.list();

  const origin = new URL(request.url).origin;
  const boards: BoardListEntry[] = rows.map((row) => {
    const boardId = composeBoardId(user.id, row.slotId);
    return {
      boardId,
      name: row.name,
      updatedAt: row.updatedAt,
      publicUrl: `${origin}/board/${boardId}`,
      editUrl: `${origin}/board/${boardId}/edit/${row.editKey}`,
    };
  });

  return data({
    authenticated: true as const,
    boards,
    capReached: boards.length >= MAX_BOARDS_PER_USER,
  });
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function BoardIndex() {
  const loaderData = useLoaderData<typeof loader>();
  const deleteFetcher = useFetcher();
  const rotateFetcher = useFetcher();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Boards</h1>
          <p className="text-sm text-muted-foreground">
            Markdown info cards for your stream. Up to {MAX_BOARDS_PER_USER}{' '}
            boards · 5 KB per board · last 10 saves kept as history.
          </p>
        </div>
        {loaderData.authenticated && !loaderData.capReached && (
          <Form method="POST" action="/board/new">
            <Button type="submit" variant="action">
              + New board
            </Button>
          </Form>
        )}
      </div>

      <AuthGate
        authenticated={loaderData.authenticated}
        reason={
          <>
            <span className="font-semibold text-foreground">
              Requires login
            </span>
            . Boards are owned by your Twitch account.
          </>
        }
      >
        {loaderData.authenticated && loaderData.boards.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
            No boards yet. Click &ldquo;+ New board&rdquo; above to create your
            first one.
          </div>
        )}

        {loaderData.authenticated && loaderData.capReached && (
          <p className="mb-4 text-sm text-amber-700 dark:text-amber-300">
            You&apos;ve reached the {MAX_BOARDS_PER_USER}-board limit. Delete
            one to create another.
          </p>
        )}

        {loaderData.authenticated && (
          <ul className="flex flex-col gap-3">
            {loaderData.boards.map((b) => (
              <li
                key={b.boardId}
                className="rounded-lg border border-border bg-muted/30 p-4 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <BoardNameEditor boardId={b.boardId} name={b.name} />
                  <span className="text-xs text-muted-foreground">
                    Updated {formatRelative(b.updatedAt)}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Public URL (use in OBS browser source)
                    </p>
                    <SecretCopy value={b.publicUrl} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Edit URL (share with mods)
                    </p>
                    <SecretCopy value={b.editUrl} />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <rotateFetcher.Form
                    method="POST"
                    action={`/board/${b.boardId}/rotate`}
                  >
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      disabled={rotateFetcher.state !== 'idle'}
                    >
                      Rotate edit key
                    </Button>
                  </rotateFetcher.Form>
                  <deleteFetcher.Form
                    method="POST"
                    action={`/board/${b.boardId}/delete`}
                    onSubmit={(e) => {
                      if (
                        !globalThis.confirm(
                          `Delete board "${b.name}"? This cannot be undone.`
                        )
                      ) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <Button
                      type="submit"
                      size="sm"
                      variant="destructive"
                      disabled={deleteFetcher.state !== 'idle'}
                    >
                      Delete
                    </Button>
                  </deleteFetcher.Form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AuthGate>
    </div>
  );
}

function BoardNameEditor({ boardId, name }: { boardId: string; name: string }) {
  const fetcher = useFetcher();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const isSubmitting = fetcher.state !== 'idle';

  if (!editing) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <h2 className="font-semibold truncate">{name}</h2>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
        >
          Rename
        </Button>
      </div>
    );
  }

  return (
    <fetcher.Form
      method="POST"
      action="/board"
      className="flex items-center gap-2 min-w-0 flex-1"
      onSubmit={() => setEditing(false)}
    >
      <input type="hidden" name="intent" value="rename" />
      <input type="hidden" name="boardId" value={boardId} />
      <Input
        name="name"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={MAX_BOARD_NAME_LENGTH}
        autoFocus
        className="h-8 max-w-xs"
      />
      <Button type="submit" size="sm" disabled={isSubmitting}>
        Save
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setEditing(false)}
      >
        Cancel
      </Button>
    </fetcher.Form>
  );
}
