import type { Locale, Peak } from './types';
export function getPeakName(peak: Pick<Peak, 'id' | 'name' | 'names' | 'aliases'>, locale: string): string {
  const language = locale.toLowerCase().split('-')[0];
  return peak.names[language]?.trim() || peak.name?.trim() || Object.entries(peak.names).sort(([a],[b]) => a.localeCompare(b)).find(([,name]) => name?.trim())?.[1] || peak.aliases.find(name => name?.trim()) || peak.id;
}
export function alternativeNames(peak: Peak, locale: Locale): string[] {
  const primary = getPeakName(peak, locale);
  return [...new Set([peak.name, ...['de', 'fr', 'it', 'en'].map(lang => peak.names[lang]), ...peak.aliases].filter(Boolean))].filter(name => name !== primary).slice(0, 4);
}
