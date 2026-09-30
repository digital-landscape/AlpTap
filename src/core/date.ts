const viennaFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit' });
export function viennaDate(instant: Date = new Date()): string {
  const parts = viennaFormatter.formatToParts(instant);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function dateOrdinal(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid calendar date');
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== date) throw new Error('Invalid calendar date');
  return Math.floor(ms / 86400000);
}
export function nextViennaRollover(date: string): string {
  // Search UTC instants for the first millisecond belonging to the next Vienna date.
  const midnightUTC = dateOrdinal(date) * 86400000;
  let low = midnightUTC, high = midnightUTC + 36 * 3600000;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (viennaDate(new Date(mid)) <= date) low = mid; else high = mid;
  }
  return new Date(high).toISOString();
}
