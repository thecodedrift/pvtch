import { normalizeLanguage } from '@/lib/constants/languages';
import { tinyldClassifier } from './classifiers/tinyld';
import { francClassifier } from './classifiers/franc';
import type { Classifier, ClassifierResult } from './classifiers/types';
import { preprocess, graphemeLength } from './preprocess';
import { detectScripts, isScriptDisjoint } from './script';
import { GIBBERISH_LENGTH, TAU_TRANSLATE, TAU_SKIP } from './thresholds';

export type DecisionAction =
  | 'TRANSLATE'
  | 'SKIP_GIBBERISH'
  | 'SKIP_SCRIPT_DISJOINT'
  | 'SKIP_TARGET'
  | 'SKIP_AMBIGUOUS';

export interface DecisionResult {
  action: DecisionAction;
  reason: string;
  cleaned: string;
  cleanedLength: number;
  scripts: string[];
  votes: Array<{ classifier: string; result: ClassifierResult }>;
}

export const DEFAULT_CLASSIFIERS: ReadonlyArray<Classifier> = [
  tinyldClassifier,
  francClassifier,
];

export function decide(
  input: string,
  target: string,
  classifiers: ReadonlyArray<Classifier> = DEFAULT_CLASSIFIERS
): DecisionResult {
  const cleaned = preprocess(input);
  const cleanedLength = graphemeLength(cleaned);
  const scripts = detectScripts(cleaned);

  if (cleanedLength < GIBBERISH_LENGTH) {
    return {
      action: 'SKIP_GIBBERISH',
      reason: `cleaned length ${cleanedLength} < ${GIBBERISH_LENGTH}`,
      cleaned,
      cleanedLength,
      scripts: [...scripts],
      votes: [],
    };
  }

  if (isScriptDisjoint(scripts, target)) {
    return {
      action: 'TRANSLATE',
      reason: 'script disjoint from target',
      cleaned,
      cleanedLength,
      scripts: [...scripts],
      votes: [],
    };
  }

  const targetNormalized = normalizeLanguage(target);
  const votes = classifiers.map((c) => ({
    classifier: c.name,
    result: c.detect(cleaned),
  }));

  let confidentNonTarget = 0;
  let confidentTarget = 0;
  for (const vote of votes) {
    const r = vote.result;
    if (!r) continue;
    if (r.lang === targetNormalized) {
      if (r.confidence >= TAU_SKIP) confidentTarget++;
    } else {
      if (r.confidence >= TAU_TRANSLATE) confidentNonTarget++;
    }
  }

  if (confidentNonTarget >= 1) {
    return {
      action: 'TRANSLATE',
      reason: `${confidentNonTarget} confident non-target vote(s)`,
      cleaned,
      cleanedLength,
      scripts: [...scripts],
      votes,
    };
  }

  if (confidentTarget >= 2) {
    return {
      action: 'SKIP_TARGET',
      reason: `${confidentTarget} confident target vote(s)`,
      cleaned,
      cleanedLength,
      scripts: [...scripts],
      votes,
    };
  }

  return {
    action: 'SKIP_AMBIGUOUS',
    reason: 'no decisive ensemble verdict',
    cleaned,
    cleanedLength,
    scripts: [...scripts],
    votes,
  };
}
