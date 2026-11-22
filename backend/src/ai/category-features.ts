export const labels = ['benefits', 'free-courses', 'grants', 'clubs', 'general'] as const;
export const dimensions = 2048;
export const modelVersion = 1;

export function categoryFeatures(query: string): number[] {
  const normalized = query.normalize('NFC').toLowerCase()
    .replace(/\S+@\S+|(?:https?:\/\/|www\.)\S+/gu, ' ')
    .replace(/[^\p{L}\p{M}]+/gu, ' ').trim();
  if (!normalized) return [];
  const text = '^' + normalized + '$';
  const features = new Set<number>();
  // Signed/position-specific features are unnecessary for this small vocabulary.
  for (let start = 0; start < text.length; start++) {
    let hash = 2166136261;
    for (let size = 1; size <= 5 && start + size <= text.length; size++) {
      hash = Math.imul(hash ^ text.charCodeAt(start + size - 1), 16777619);
      if (size >= 3) features.add((hash >>> 0) % dimensions);
    }
  }
  return [...features];
}

export function probabilities(features: number[], weights: readonly (readonly number[])[], bias: readonly number[]): number[] {
  const scale = 1 / Math.sqrt(Math.max(1, features.length));
  const logits = weights.map((row, index) =>
    bias[index]! + scale * features.reduce((sum, feature) => sum + row[feature]!, 0));
  const maximum = Math.max(...logits);
  const scores = logits.map(value => Math.exp(value - maximum));
  const total = scores.reduce((sum, value) => sum + value, 0);
  return scores.map(value => value / total);
}
