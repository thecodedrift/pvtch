import { describe, it, expect } from 'vitest';
import {
  parseBoardId,
  composeBoardId,
  newSlotId,
  newEditKey,
} from '@/lib/board-id';

describe('parseBoardId', () => {
  it('parses a well-formed boardId', () => {
    expect(parseBoardId('12345-abcd1234')).toEqual({
      userId: '12345',
      slotId: 'abcd1234',
    });
  });

  it('returns null for missing slot portion', () => {
    expect(parseBoardId('12345')).toBeUndefined();
  });

  it('returns null for non-numeric userId', () => {
    expect(parseBoardId('abc-1234abcd')).toBeUndefined();
  });

  it('returns null for wrong-length slotId', () => {
    expect(parseBoardId('12345-abcd123')).toBeUndefined(); // 7 chars
    expect(parseBoardId('12345-abcd12345')).toBeUndefined(); // 9 chars
  });

  it('returns null for uppercase slotId', () => {
    expect(parseBoardId('12345-ABCD1234')).toBeUndefined();
  });

  it('returns null for empty string', () => {
    expect(parseBoardId('')).toBeUndefined();
  });

  it('returns null when leading dash', () => {
    expect(parseBoardId('-abcd1234')).toBeUndefined();
  });

  it('returns null when trailing dash', () => {
    expect(parseBoardId('12345-')).toBeUndefined();
  });
});

describe('composeBoardId', () => {
  it('joins userId and slotId with a dash', () => {
    expect(composeBoardId('12345', 'abcd1234')).toBe('12345-abcd1234');
  });
});

describe('newSlotId', () => {
  it('produces 8 lowercase alphanumeric characters', () => {
    for (let i = 0; i < 20; i++) {
      const id = newSlotId();
      expect(id).toMatch(/^[a-z0-9]{8}$/);
    }
  });
});

describe('newEditKey', () => {
  it('produces a 24-char nanoid-format string', () => {
    const key = newEditKey();
    expect(key).toMatch(/^[A-Za-z0-9_-]{24}$/);
  });
});
