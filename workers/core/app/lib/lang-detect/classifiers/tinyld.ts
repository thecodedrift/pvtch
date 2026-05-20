import { detectAll } from 'tinyld/heavy';
import { normalizeLanguage } from '@/lib/constants/languages';
import type { Classifier, ClassifierResult } from './types';

export const tinyldClassifier: Classifier = {
  name: 'tinyld',
  detect(input: string): ClassifierResult {
    try {
      const results = detectAll(input);
      const top = results[0];
      if (!top || !top.lang) return undefined;
      return {
        lang: normalizeLanguage(top.lang),
        confidence: top.accuracy,
      };
    } catch {
      return undefined;
    }
  },
};
