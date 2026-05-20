/**
 * A single classifier's verdict on an input. `lang` is the canonical lowercase
 * language name (matching `normalizeLanguage()` output). `confidence` is on a
 * normalized 0–1 scale. `undefined` means the classifier abstained (input was
 * too short to score, init failed, or any other reason it cannot answer).
 */
export type ClassifierResult = { lang: string; confidence: number } | undefined;

export interface Classifier {
  readonly name: string;
  detect(input: string): ClassifierResult;
}
