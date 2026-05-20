import { francAll } from 'franc-min';
import { normalizeLanguage } from '@/lib/constants/languages';
import type { Classifier, ClassifierResult } from './types';

// franc-min returns trigram-distance tuples sorted descending where the top
// result is normalized to 1.0. Confidence is derived from the gap between top
// and runner-up, then scaled by GAP_SCALE to bring it onto a roughly tinyld-
// comparable 0–1 range. Empirically, clean prose has gap ≈ 0.2–0.4 (related
// languages always trail close in trigram space, e.g. Scots and Dutch behind
// English), and a multiplier of 4 lands those cases above the skip threshold.
//
// francAll returns 'und' (undetermined) for inputs below its internal length
// minimum, which we treat as abstention.
const GAP_SCALE = 4;

export const francClassifier: Classifier = {
  name: 'franc-min',
  detect(input: string): ClassifierResult {
    try {
      const results = francAll(input);
      const top = results[0];
      if (!top || top[0] === 'und') return undefined;
      const second = results[1]?.[1] ?? 0;
      const gap = top[1] - second;
      const confidence = Math.max(0, Math.min(1, gap * GAP_SCALE));
      return {
        lang: normalizeLanguage(top[0]),
        confidence,
      };
    } catch {
      return undefined;
    }
  },
};
