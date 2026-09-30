import type { Feature, MultiPolygon, Polygon, Position as Coordinate } from 'geojson';
import type { Position } from './types';
export type SectionFeature = Feature<Polygon | MultiPolygon, { id: string; name: string }>;
// Boundary-inclusive winding test: shared section edges qualify; hole interiors do not.
function inRing(point: Position, ring: Coordinate[]): 'inside' | 'outside' | 'boundary' {
  // GeoJSON may store a dateline-crossing ring without splitting it at ±180°.
  if(ring.some((p,i)=>i>0&&Math.abs(p[0]-ring[i-1][0])>180&&Math.abs(p[0]-ring[i-1][0])<360-1e-10)) {
    const unwrapped:Coordinate[]=[];
    for(const p of ring){const anchor=unwrapped.at(-1)?.[0]??p[0];unwrapped.push([anchor+((p[0]-anchor+540)%360+360)%360-180,p[1]]);}
    const anchor=unwrapped.reduce((sum,p)=>sum+p[0],0)/unwrapped.length;
    point={...point,lon:anchor+((point.lon-anchor+540)%360+360)%360-180};ring=unwrapped;
  }
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j], [bx, by] = ring[i];
    const cross = (point.lon - ax) * (by - ay) - (point.lat - ay) * (bx - ax);
    if (Math.abs(cross) <= 1e-10 && point.lon >= Math.min(ax,bx) - 1e-10 && point.lon <= Math.max(ax,bx) + 1e-10 && point.lat >= Math.min(ay,by) - 1e-10 && point.lat <= Math.max(ay,by) + 1e-10) return 'boundary';
    if ((ay > point.lat) !== (by > point.lat) && point.lon < (bx - ax) * (point.lat - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside ? 'inside' : 'outside';
}
export function sectionCovers(section: SectionFeature, point: Position): boolean {
  const polygons = section.geometry.type === 'Polygon' ? [section.geometry.coordinates] : section.geometry.coordinates;
  return polygons.some(rings => {
    const exterior = inRing(point, rings[0]);
    if (exterior === 'outside') return false;
    if (exterior === 'boundary') return true;
    for (const hole of rings.slice(1)) { const hit = inRing(point, hole); if (hit === 'boundary') return true; if (hit === 'inside') return false; }
    return true;
  });
}
export function matchingSections(point: Position, sections: SectionFeature[]): string[] {
  return sections.filter(section => sectionCovers(section, point)).map(section => section.properties.id).sort();
}
