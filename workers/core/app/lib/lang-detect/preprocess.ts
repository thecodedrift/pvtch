const URL_RE = /https?:\/\/\S+/gi;
const MENTION_RE = /@[a-z0-9_]{1,25}/gi;

// A token looks like a Twitch-style emote if it has either:
//   - 3+ consecutive uppercase letters (LULW, KEKW, OMEGALUL), or
//   - an internal capital transition (PogChamp, monkaW, peepoSad, 4Head)
// A single leading capital (Hello, World) is NOT treated as an emote so normal
// sentence-initial words survive the gibberish gate.
const EMOTE_ALL_CAPS_RE = /^[A-Z][A-Z0-9]{2,}$/;
const EMOTE_INTERNAL_CAP_RE = /[a-z0-9][A-Z]/;

function isEmoteToken(token: string): boolean {
  if (EMOTE_ALL_CAPS_RE.test(token)) return true;
  if (EMOTE_INTERNAL_CAP_RE.test(token)) return true;
  return false;
}

export function preprocess(input: string): string {
  const stripped = input.replaceAll(URL_RE, ' ').replaceAll(MENTION_RE, ' ');
  const kept: string[] = [];
  for (const token of stripped.split(/\s+/)) {
    if (token.length === 0) continue;
    if (isEmoteToken(token)) continue;
    kept.push(token);
  }
  return kept.join(' ').trim();
}

const GRAPHEME_SEGMENTER = new Intl.Segmenter(undefined, {
  granularity: 'grapheme',
});

export function graphemeLength(input: string): number {
  let count = 0;
  for (const _ of GRAPHEME_SEGMENTER.segment(input)) count++;
  return count;
}
