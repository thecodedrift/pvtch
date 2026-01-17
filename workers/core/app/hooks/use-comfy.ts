import { $comfyChat, $comfy } from '@/atoms/comfy';
import type { ComfyJSInstance } from 'comfy.js';
import EE from 'eventemitter3';

// types exposed in event emitter
export interface ComfyEvents {
  chat: ComfyJSInstance['onChat'];
  command: ComfyJSInstance['onCommand'];
  error: ComfyJSInstance['onError'];
  whisper: ComfyJSInstance['onWhisper'];
  messageDeleted: ComfyJSInstance['onMessageDeleted'];
  join: ComfyJSInstance['onJoin'];
  part: ComfyJSInstance['onPart'];
  hosted: ComfyJSInstance['onHosted'];
  raid: ComfyJSInstance['onRaid'];
  sub: ComfyJSInstance['onSub'];
  resub: ComfyJSInstance['onResub'];
  subGift: ComfyJSInstance['onSubGift'];
  subMysteryGift: ComfyJSInstance['onSubMysteryGift'];
  giftSubContinue: ComfyJSInstance['onGiftSubContinue'];
  cheer: ComfyJSInstance['onCheer'];
  chatMode: ComfyJSInstance['onChatMode'];
  reward: ComfyJSInstance['onReward'];
  connected: ComfyJSInstance['onConnected'];
  reconnect: ComfyJSInstance['onReconnect'];
}

// attach EE to comfy
type ComfyWithEvents = ComfyJSInstance & {
  events: EE<ComfyEvents>;
};

// make the existing methods readonly to prevent overwriting
type ReadOnlyComfyNativeEvents = ComfyJSInstance & {
  onCommand: Readonly<ComfyJSInstance['onCommand']>;
};

export const useComfy = (
  twitchChat: string
): ComfyWithEvents & ReadOnlyComfyNativeEvents => {
  const currentChat = $comfyChat.get();
  const requestedChat = twitchChat.trim().toLocaleLowerCase();

  if (currentChat && currentChat !== requestedChat) {
    throw new Error(
      `Comfy instance is already associated with chat ${currentChat}, cannot associate with ${twitchChat}`
    );
  }

  if (currentChat === requestedChat) {
    return $comfy.get() as ComfyWithEvents & ReadOnlyComfyNativeEvents;
  }

  const ee = new EE<ComfyEvents>();
  const comfy = $comfy.get();
  comfy.Init(requestedChat);
  (comfy as ComfyWithEvents).events = ee;

  comfy.onCommand = (...args) => {
    ee.emit('command', ...args);
  };
  comfy.onJoin = (...args) => {
    ee.emit('join', ...args);
  };
  comfy.onChat = (...args) => {
    ee.emit('chat', ...args);
  };
  comfy.onWhisper = (...args) => {
    ee.emit('whisper', ...args);
  };
  comfy.onError = (...args) => {
    ee.emit('error', ...args);
  };
  comfy.onMessageDeleted = (...args) => {
    ee.emit('messageDeleted', ...args);
  };
  comfy.onPart = (...args) => {
    ee.emit('part', ...args);
  };
  comfy.onHosted = (...args) => {
    ee.emit('hosted', ...args);
  };
  comfy.onRaid = (...args) => {
    ee.emit('raid', ...args);
  };
  comfy.onSub = (...args) => {
    ee.emit('sub', ...args);
  };
  comfy.onResub = (...args) => {
    ee.emit('resub', ...args);
  };
  comfy.onSubGift = (...args) => {
    ee.emit('subGift', ...args);
  };
  comfy.onSubMysteryGift = (...args) => {
    ee.emit('subMysteryGift', ...args);
  };
  comfy.onGiftSubContinue = (...args) => {
    ee.emit('giftSubContinue', ...args);
  };
  comfy.onCheer = (...args) => {
    ee.emit('cheer', ...args);
  };
  comfy.onChatMode = (...args) => {
    ee.emit('chatMode', ...args);
  };
  comfy.onReward = (...args) => {
    ee.emit('reward', ...args);
  };
  comfy.onConnected = (...args) => {
    ee.emit('connected', ...args);
  };
  comfy.onReconnect = (...args) => {
    ee.emit('reconnect', ...args);
  };

  if (!currentChat) {
    $comfyChat.set(requestedChat);
  }

  return comfy as ComfyWithEvents & ReadOnlyComfyNativeEvents;
};
