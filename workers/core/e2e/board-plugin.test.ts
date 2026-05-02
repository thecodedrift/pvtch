import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getPlatformProxy } from 'wrangler';

// Mirrors constants in do/plugins/board.ts; keep in sync.
const MAX_BOARDS_PER_USER = 5;
const MAX_CONTENT_BYTES = 5120;

let env: Env;
let dispose: () => Promise<void>;

const TEST_USER_ID = 'e2e-board-plugin-user';

async function withBoard<T>(
  fn: (board: Awaited<ReturnType<typeof getPlugin>>) => Promise<T>
): Promise<T> {
  const board = await getPlugin();
  try {
    return await fn(board);
  } finally {
    if (board && Symbol.dispose in board) {
      (board as unknown as { [Symbol.dispose](): void })[Symbol.dispose]();
    }
  }
}

async function getPlugin() {
  const stub = env.PVTCH_USER.get(
    env.PVTCH_USER.idFromName(`twitch:${TEST_USER_ID}`)
  );
  return await stub.board();
}

beforeAll(async () => {
  const proxy = await getPlatformProxy<Env>({
    configPath: './wrangler.jsonc',
  });
  env = proxy.env;
  dispose = proxy.dispose;
});

afterAll(async () => {
  await dispose();
});

beforeEach(async () => {
  // Clean slate before each test: delete all boards on the test user's DO
  await withBoard(async (board) => {
    const list = await board.list();
    for (const row of list) {
      await board.delete(row.slotId);
    }
  });
});

describe('board plugin: create + read + save', () => {
  it('creates a board, saves content, and reads it back', async () => {
    await withBoard(async (board) => {
      const created = await board.create('My board');
      expect('error' in created).toBe(false);
      if ('error' in created) return;

      const initial = await board.read(created.slotId);
      expect(initial?.content).toBe('');
      expect(initial?.version).toBe(0);
      expect(initial?.name).toBe('My board');

      const saved = await board.save(
        created.slotId,
        created.editKey,
        '# Hello',
        0,
        'Tester'
      );
      expect('error' in saved).toBe(false);
      if ('error' in saved) return;
      expect(saved.version).toBe(1);

      const after = await board.read(created.slotId);
      expect(after?.content).toBe('# Hello');
      expect(after?.version).toBe(1);
    });
  });
});

describe('board plugin: optimistic concurrency', () => {
  it('rejects a save with a stale baseVersion (409)', async () => {
    await withBoard(async (board) => {
      const created = await board.create();
      if ('error' in created) throw new Error('create failed');

      // First save: version 0 → 1
      await board.save(created.slotId, created.editKey, 'first', 0, 'AliceA');

      // Second save with stale baseVersion 0: should conflict
      const result = await board.save(
        created.slotId,
        created.editKey,
        'second',
        0,
        'BobB'
      );
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toBe('conflict');
        if (result.error === 'conflict') {
          expect(result.currentVersion).toBe(1);
          expect(result.currentContent).toBe('first');
        }
      }
    });
  });
});

describe('board plugin: edit key check', () => {
  it('returns forbidden for a wrong edit key on save', async () => {
    await withBoard(async (board) => {
      const created = await board.create();
      if ('error' in created) throw new Error('create failed');

      const result = await board.save(
        created.slotId,
        'wrong-edit-key',
        'content',
        0,
        'Eve'
      );
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toBe('forbidden');
      }
    });
  });

  it('returns forbidden for a wrong edit key on readForEdit', async () => {
    await withBoard(async (board) => {
      const created = await board.create();
      if ('error' in created) throw new Error('create failed');

      const result = await board.readForEdit(created.slotId, 'wrong');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toBe('forbidden');
      }
    });
  });
});

describe('board plugin: 5-board cap', () => {
  it('enforces MAX_BOARDS_PER_USER on create', async () => {
    await withBoard(async (board) => {
      for (let i = 0; i < MAX_BOARDS_PER_USER; i++) {
        const r = await board.create(`Board ${i}`);
        expect('error' in r).toBe(false);
      }
      const overflow = await board.create('one too many');
      expect('error' in overflow).toBe(true);
      if ('error' in overflow) {
        expect(overflow.error).toBe('cap_reached');
      }
    });
  });
});

describe('board plugin: history and revert', () => {
  it('appends a new history entry on revert (does not rewrite existing)', async () => {
    await withBoard(async (board) => {
      const created = await board.create();
      if ('error' in created) throw new Error('create failed');

      // Three saves to build history
      await board.save(created.slotId, created.editKey, 'v1', 0, 'A');
      await board.save(created.slotId, created.editKey, 'v2', 1, 'A');
      await board.save(created.slotId, created.editKey, 'v3', 2, 'A');

      const historyBefore = await board.getHistory(
        created.slotId,
        created.editKey
      );
      expect('error' in historyBefore).toBe(false);
      if ('error' in historyBefore) return;
      expect(historyBefore.length).toBe(3);

      // Revert to the oldest entry (v1)
      const oldest = historyBefore.at(-1);
      if (!oldest) throw new Error('expected an oldest history entry');
      const revertResult = await board.revert(
        created.slotId,
        created.editKey,
        oldest.id,
        3,
        'A'
      );
      expect('error' in revertResult).toBe(false);

      const historyAfter = await board.getHistory(
        created.slotId,
        created.editKey
      );
      if ('error' in historyAfter) return;
      // Original entries still there + one new one
      expect(historyAfter.length).toBe(4);
      // Existing IDs remain — no rewrite
      const existingIds = new Set(historyBefore.map((h) => h.id));
      const stillThere = historyAfter.filter((h) => existingIds.has(h.id));
      expect(stillThere.length).toBe(3);

      // Board content was reverted
      const after = await board.read(created.slotId);
      expect(after?.content).toBe('v1');
      expect(after?.version).toBe(4);
    });
  });

  it('trims history to 10 most recent entries', async () => {
    await withBoard(async (board) => {
      const created = await board.create();
      if ('error' in created) throw new Error('create failed');

      // 12 saves
      for (let v = 0; v < 12; v++) {
        await board.save(created.slotId, created.editKey, `v${v + 1}`, v, 'A');
      }

      const history = await board.getHistory(created.slotId, created.editKey);
      if ('error' in history) throw new Error('history error');
      expect(history.length).toBe(10);
      // Most recent first
      const newest = history[0];
      const oldest = history.at(-1);
      if (!oldest) throw new Error('expected at least one history entry');
      expect(newest.ts).toBeGreaterThanOrEqual(oldest.ts);
    });
  });
});

describe('board plugin: rotate edit key', () => {
  it('invalidates the prior edit key', async () => {
    await withBoard(async (board) => {
      const created = await board.create();
      if ('error' in created) throw new Error('create failed');

      const rotated = await board.rotateEditKey(created.slotId);
      expect('error' in rotated).toBe(false);
      if ('error' in rotated) return;
      expect(rotated.editKey).not.toBe(created.editKey);

      // Old key rejected
      const oldKeyResult = await board.save(
        created.slotId,
        created.editKey,
        'should fail',
        0,
        'A'
      );
      expect('error' in oldKeyResult).toBe(true);
      if ('error' in oldKeyResult) {
        expect(oldKeyResult.error).toBe('forbidden');
      }

      // New key works
      const newKeyResult = await board.save(
        created.slotId,
        rotated.editKey,
        'works',
        0,
        'A'
      );
      expect('error' in newKeyResult).toBe(false);
    });
  });
});

describe('board plugin: presence', () => {
  it('records and returns active sessions', async () => {
    await withBoard(async (board) => {
      const created = await board.create();
      if ('error' in created) throw new Error('create failed');

      await board.heartbeat(
        created.slotId,
        created.editKey,
        'session-1',
        'Alice'
      );
      await board.heartbeat(
        created.slotId,
        created.editKey,
        'session-2',
        'Bob'
      );

      const presence = await board.getPresence(created.slotId);
      expect(presence.length).toBe(2);
      const names = new Set(presence.map((p) => p.name));
      expect(names).toEqual(new Set(['Alice', 'Bob']));
    });
  });

  it('rejects heartbeat with wrong edit key', async () => {
    await withBoard(async (board) => {
      const created = await board.create();
      if ('error' in created) throw new Error('create failed');

      const result = await board.heartbeat(
        created.slotId,
        'wrong-key',
        's1',
        'A'
      );
      expect('error' in result).toBe(true);
      if ('error' in result) expect(result.error).toBe('forbidden');
    });
  });
});

describe('board plugin: delete', () => {
  it('removes the board and history; subsequent reads return undefined', async () => {
    await withBoard(async (board) => {
      const created = await board.create();
      if ('error' in created) throw new Error('create failed');

      await board.save(created.slotId, created.editKey, 'content', 0, 'A');

      const result = await board.delete(created.slotId);
      expect(result.ok).toBe(true);

      const read = await board.read(created.slotId);
      expect(read).toBeUndefined();

      const history = await board.getHistory(created.slotId, created.editKey);
      expect('error' in history).toBe(true);
    });
  });
});

describe('board plugin: size limit', () => {
  it('rejects saves over MAX_CONTENT_BYTES', async () => {
    await withBoard(async (board) => {
      const created = await board.create();
      if ('error' in created) throw new Error('create failed');

      const tooLarge = 'x'.repeat(MAX_CONTENT_BYTES + 1);
      const result = await board.save(
        created.slotId,
        created.editKey,
        tooLarge,
        0,
        'A'
      );
      expect('error' in result).toBe(true);
      if ('error' in result) expect(result.error).toBe('too_large');
    });
  });

  it('accepts saves at exactly MAX_CONTENT_BYTES', async () => {
    await withBoard(async (board) => {
      const created = await board.create();
      if ('error' in created) throw new Error('create failed');

      const exact = 'x'.repeat(MAX_CONTENT_BYTES);
      const result = await board.save(
        created.slotId,
        created.editKey,
        exact,
        0,
        'A'
      );
      expect('error' in result).toBe(false);
    });
  });
});
