export function getLevel(pct: number): string {
  if (pct >= 80) return 'Pre-Senior';
  if (pct >= 65) return 'Middle+';
  if (pct >= 50) return 'Middle';
  return 'Junior+';
}
