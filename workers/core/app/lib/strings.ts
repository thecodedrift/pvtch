const segmenter = new Intl.Segmenter('en-US', { granularity: 'word' });

const toWords = (s: string): Set<string> => {
  const words = new Set<string>();
  for (const segment of segmenter.segment(s.toLowerCase().trim())) {
    if (segment.isWordLike) {
      words.add(segment.segment);
    }
  }
  return words;
};

/**
 * Check if two strings are similar above a given threshold using the
 * overlap coefficient on word sets: |intersection| / min(|A|, |B|).
 * Uses Intl.Segmenter to extract words, stripping punctuation so
 * "chelle!" and "Chelle" are treated as the same word.
 * A threshold of 0.5 means at least half of the smaller set's words
 * appear in the other set.
 */
export const similar = (a: string, b: string, threshold: number): boolean => {
  const wordsA = toWords(a);
  const wordsB = toWords(b);
  if (wordsA.size === 0 && wordsB.size === 0) return true;

  const minSize = Math.min(wordsA.size, wordsB.size);
  if (minSize === 0) return false;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }

  return intersection / minSize >= threshold;
};
