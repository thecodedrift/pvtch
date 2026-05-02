import { customAlphabet, nanoid } from 'nanoid';

const SLOT_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SLOT_LENGTH = 8;
const EDIT_KEY_LENGTH = 24;

const slotIdNanoid = customAlphabet(SLOT_ALPHABET, SLOT_LENGTH);

export function newSlotId(): string {
  return slotIdNanoid();
}

export function newEditKey(): string {
  return nanoid(EDIT_KEY_LENGTH);
}

export function composeBoardId(userId: string, slotId: string): string {
  return `${userId}-${slotId}`;
}

export interface ParsedBoardId {
  userId: string;
  slotId: string;
}

const USER_ID_RE = /^\d+$/;
const SLOT_ID_RE = /^[a-z0-9]{8}$/;

export function parseBoardId(boardId: string): ParsedBoardId | undefined {
  const dashIndex = boardId.lastIndexOf('-');
  if (dashIndex < 1 || dashIndex >= boardId.length - 1) return undefined;

  const userId = boardId.slice(0, dashIndex);
  const slotId = boardId.slice(dashIndex + 1);

  if (!USER_ID_RE.test(userId)) return undefined;
  if (!SLOT_ID_RE.test(slotId)) return undefined;

  return { userId, slotId };
}
