export const TIERS = [
  { min: 0, name: 'Just Met', emoji: '👋' },
  { min: 25, name: 'Crush', emoji: '🥰' },
  { min: 100, name: 'Dating', emoji: '💑' },
  { min: 250, name: 'In Love', emoji: '❤️‍🔥' },
  { min: 500, name: 'Soulmate', emoji: '💞' },
];

export function tierFor(affection) {
  let current = TIERS[0];
  let next = null;
  for (let i = 0; i < TIERS.length; i++) {
    if (affection >= TIERS[i].min) {
      current = TIERS[i];
      next = TIERS[i + 1] || null;
    }
  }
  const progress = next
    ? (affection - current.min) / (next.min - current.min)
    : 1;
  return { current, next, progress: Math.min(1, progress) };
}
