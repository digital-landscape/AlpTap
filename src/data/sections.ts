import type { SectionFeature } from '../core/geography';
const cache = new Map<string, Promise<SectionFeature>>();
export async function loadSections(version: string, ids: string[]): Promise<SectionFeature[]> {
  if (!/^alps-[a-f0-9]{12}$/.test(version) || ids.some(id => !/^SZ\.([1-9]|[12]\d|3[0-6])$/.test(id))) throw new Error('Invalid section request');
  return Promise.all(ids.map(id => {
    const key = `${version}/${id}`;
    if (!cache.has(key)) {
      const request = fetch(`${import.meta.env.BASE_URL}data/${version}/sections/${id}.json`, { signal: AbortSignal.timeout(12000) }).then(async response => {
        if (!response.ok) throw new Error('Section geometry unavailable');
        const feature = await response.json() as SectionFeature;
        if (feature.type !== 'Feature' || feature.properties?.id !== id || !['Polygon','MultiPolygon'].includes(feature.geometry?.type) || !Array.isArray(feature.geometry.coordinates)) throw new Error('Invalid section geometry');
        return feature;
      }).catch(error => { cache.delete(key); throw error; });
      cache.set(key, request);
    }
    return cache.get(key)!;
  }));
}
