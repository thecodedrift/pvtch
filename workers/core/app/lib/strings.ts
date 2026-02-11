/**
 * Calculate the Levenshtein distance between two strings.
 * Returns the minimum number of single-character edits (insertions,
 * deletions, substitutions) needed to transform one string into the other.
 */
const levenshtein = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Use two rows instead of a full matrix
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[b.length];
};

/**
 * Check if two strings are similar above a given threshold.
 * Uses normalized Levenshtein distance: 1 - (distance / maxLength).
 * A threshold of 0.8 means the strings must be at least 80% similar.
 */
export const similar = (a: string, b: string, threshold: number): boolean => {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return true;
  const distance = levenshtein(na, nb);
  const similarity = 1 - distance / maxLen;
  return similarity >= threshold;
};
