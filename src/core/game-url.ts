import {decodePolygon,encodePolygon,type Ring} from './custom';
import type {RegionId} from './types';
export type PlayMode='alpine-peaks'|'world-peaks'|'custom';
export interface GameRoute {mode:PlayMode;region:RegionId;catalog?:string;polygon?:Ring}
export const catalogPattern=/^catalog-[a-f0-9]{16}$/;
export function readGameRoute(search:string,defaults:GameRoute):GameRoute {
  const p=new URLSearchParams(search);
  for(const key of ['mode','region','catalog','poly','v'])if(p.getAll(key).length>1)throw new Error('link');
  const mode=p.get('mode')??defaults.mode;
  if(!['alpine-peaks','world-peaks','custom'].includes(mode)||(p.has('v')&&p.get('v')!=='1'))throw new Error('link');
  const region=p.get('region')??(p.has('mode')?'alps':defaults.region);
  if(!['alps','western-alps','eastern-alps'].includes(region)||(mode!=='alpine-peaks'&&p.has('region')))throw new Error('link');
  const catalog=p.get('catalog')??undefined;
  if(catalog&&!catalogPattern.test(catalog))throw new Error('link');
  if(p.has('catalog')&&!catalog)throw new Error('link');
  if(mode==='custom'&&(!catalog||p.get('v')!=='1'||!p.get('poly')))throw new Error('link');
  if(mode!=='custom'&&p.has('poly'))throw new Error('link');
  return {mode:mode as PlayMode,region:region as RegionId,catalog,polygon:mode==='custom'?decodePolygon(p.get('poly')!):undefined};
}
export function gameURL(base:string,route:GameRoute):string {
  const url=new URL(base);url.search='';url.hash='';url.searchParams.set('mode',route.mode);
  if(route.mode==='alpine-peaks'&&route.region!=='alps')url.searchParams.set('region',route.region);
  if(route.catalog){url.searchParams.set('v','1');url.searchParams.set('catalog',route.catalog);}
  if(route.mode==='custom'){if(!route.polygon||!route.catalog)throw new Error('link');url.searchParams.set('poly',encodePolygon(route.polygon));}
  return url.href;
}
