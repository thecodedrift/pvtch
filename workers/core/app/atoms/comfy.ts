import type { ComfyJSInstance } from 'comfy.js';
import ComfyJS from 'comfy.js';
import { atom } from 'nanostores';

// twitch chat associated (for errors)
// store comfy object
// used by higher level hook to ensure comfy is singleton
export const $comfy = atom<ComfyJSInstance>(ComfyJS);

// store twitch chat associated with comfy instance
export const $comfyChat = atom<string | undefined>();
