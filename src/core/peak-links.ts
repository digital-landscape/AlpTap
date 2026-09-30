import type { Locale, Peak } from './types';
/** Prefer a real article in the interface language; never invent an article title. */
export function peakInfoLink(peak: Pick<Peak, 'id' | 'wikidata' | 'wikipedia'>, locale: Locale): {url:string; label:string} {
  for (const language of [...new Set([locale,'en','de','fr','it',...Object.keys(peak.wikipedia??{})])]) {
    const url=peak.wikipedia?.[language];
    if(url && /^https:\/\/[a-z-]+\.wikipedia\.org\/wiki\/.+/.test(url))return {url,label:`Wikipedia · ${language.toUpperCase()}`};
  }
  if(peak.wikidata && /^Q\d+$/.test(peak.wikidata))return {url:`https://www.wikidata.org/wiki/${peak.wikidata}`,label:'Wikidata'};
  return {url:`https://www.openstreetmap.org/node/${peak.id.split('/')[1]}`,label:'OpenStreetMap'};
}
export function peakBucket(id:string):number {
  const digits=id.match(/\d+$/)?.[0];
  if(!digits)throw new Error('Invalid peak identifier');
  return Number(digits)%64;
}
