import clipping from 'polygon-clipping';
import type {MultiPolygon, Polygon} from 'geojson';
import {sectionCovers} from './geography';
import {shuffle} from './challenge';
import {dateOrdinal} from './date';
import type {Difficulty, Position} from './types';

export type Vertex = [number, number];
export type Ring = Vertex[]; // Open ring, rounded to five decimal places.
export interface Candidate {id:string; difficulty:Difficulty; position:Position}
export const MAX_VERTICES = 64;
const scale = 100000;
const wrap = (x:number) => ((x + 180) % 360 + 360) % 360 - 180;
const cross = (a:Vertex,b:Vertex,c:Vertex) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const equal = (a:Vertex,b:Vertex) => a[0]===b[0] && a[1]===b[1];
export function unwrap(ring:Ring):Ring {
  const out:Ring=[];
  for(const [x,y] of ring){const anchor=out.at(-1)?.[0]??x;out.push([anchor+wrap(x-anchor),y]);}
  return out;
}
function onSegment(a:Vertex,b:Vertex,c:Vertex){return Math.abs(cross(a,b,c))<1e-10 && c[0]>=Math.min(a[0],b[0])-1e-10 && c[0]<=Math.max(a[0],b[0])+1e-10 && c[1]>=Math.min(a[1],b[1])-1e-10 && c[1]<=Math.max(a[1],b[1])+1e-10;}
function intersects(a:Vertex,b:Vertex,c:Vertex,d:Vertex){
  return (cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0) || onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);
}
export function normalizePolygon(input:Ring):Ring {
  if(!Array.isArray(input)||input.length>MAX_VERTICES+1||input.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>90))throw new Error('polygon');
  let ring:Ring=input.map(([x,y])=>{const lon=Math.round(wrap(x)*scale);return [lon===180*scale?-180:lon/scale,Math.round(y*scale)/scale];});
  if(ring.length>1&&equal(ring[0],ring.at(-1)!))ring.pop();
  if(ring.length<3||ring.length>MAX_VERTICES||new Set(ring.map(p=>p.join(','))).size!==ring.length)throw new Error('polygon');
  // Choose one representation regardless of start vertex or winding direction.
  const first=ring.reduce((best,p,i)=>p[0]<ring[best][0]||(p[0]===ring[best][0]&&p[1]<ring[best][1])?i:best,0);
  ring=[...ring.slice(first),...ring.slice(0,first)];
  const reverse=[ring[0],...ring.slice(1).reverse()];
  if(reverse[1][0]<ring[1][0]||(reverse[1][0]===ring[1][0]&&reverse[1][1]<ring[1][1]))ring=reverse;
  const points=unwrap([...ring,ring[0]]);
  // A ring that winds around a pole needs a different drawing model.
  if(Math.abs(points.at(-1)![0]-points[0][0])>1e-7)throw new Error('polygon');
  for(let i=0;i<ring.length;i++){
    if(Math.abs(points[i+1][0]-points[i][0])>=180)throw new Error('polygon');
    // Reject a backtracking adjacent edge as well as non-adjacent crossings.
    const prev=points[(i+ring.length-1)%ring.length],a=points[i],b=points[i+1];
    if(Math.abs(cross(prev,a,b))<1e-10&&((prev[0]-a[0])*(b[0]-a[0])+(prev[1]-a[1])*(b[1]-a[1]))>0)throw new Error('polygon');
    for(let j=i+2;j<ring.length;j++)if(!(i===0&&j===ring.length-1)&&intersects(a,b,points[j],points[j+1]))throw new Error('polygon');
  }
  if(geographicArea([[points]])<1e-14)throw new Error('polygon');
  return ring;
}
export function polygonGeometry(ring:Ring):Polygon {const r=unwrap([...ring,ring[0]]);return {type:'Polygon',coordinates:[r]};}
export function polygonBounds(ring:Ring):[number,number,number,number]{const r=unwrap(ring);return [Math.min(...r.map(p=>p[0])),Math.min(...r.map(p=>p[1])),Math.max(...r.map(p=>p[0])),Math.max(...r.map(p=>p[1]))];}
// Spherical area in units of R², integrating longitude against sin(latitude).
// Longitudes must be continuous across the date line before clipping or measuring.
export function geographicArea(polygons:number[][][][]):number {
  const rad=Math.PI/180;
  return polygons.reduce((total,polygon)=>total+Math.max(0,polygon.reduce((sum,ring,i)=>{
    let area=0;for(let j=1;j<ring.length;j++)area+=(ring[j][0]-ring[j-1][0])*rad*(Math.sin(ring[j][1]*rad)+Math.sin(ring[j-1][1]*rad))/2;
    return sum+(i===0?1:-1)*Math.abs(area);
  },0)),0);
}
export function alpineOverlap(ring:Ring,boundary:Polygon|MultiPolygon):number {
  const polygon=polygonGeometry(ring).coordinates as clipping.Polygon;
  const anchor=polygonBounds(ring)[0];
  const parts=boundary.type==='Polygon'?[boundary.coordinates]:boundary.coordinates;
  const aligned=parts.map(p=>p.map(r=>{const unwrapped=unwrap(r as Ring);const offset=360*Math.round((anchor-unwrapped[0][0])/360);return unwrapped.map(([x,y])=>[x+offset,y] as Vertex);}));
  // Include neighboring world copies, since a wide polygon can straddle either copy.
  const copies=[-360,0,360].flatMap(offset=>aligned.map(p=>p.map(r=>r.map(([x,y])=>[x+offset,y] as Vertex))));
  const overlap=geographicArea(clipping.intersection(polygon,copies));
  return Math.max(0,Math.min(1,overlap/geographicArea([polygon])));
}
export const databaseForOverlap=(ratio:number):'alpine-peaks'|'world-peaks'=>ratio>0.5?'alpine-peaks':'world-peaks';
export function insidePolygon(ring:Ring,point:Position):boolean {
  const geometry=polygonGeometry(ring),bounds=polygonBounds(ring),anchor=(bounds[0]+bounds[2])/2;
  return sectionCovers({type:'Feature',properties:{id:'custom',name:'Custom'},geometry},{lat:point.lat,lon:anchor+wrap(point.lon-anchor)});
}
export function encodePolygon(input:Ring):string {
  const bytes:number[]=[];let last=[0,0];
  for(const p of normalizePolygon(input))p.forEach((v,i)=>{const n=Math.round(v*scale),delta=n-last[i];last[i]=n;let value=delta<0?-delta*2-1:delta*2;while(value>=128){bytes.push((value%128)|128);value=Math.floor(value/128);}bytes.push(value);});
  return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
export function decodePolygon(encoded:string):Ring {
  if(!/^[A-Za-z0-9_-]{1,1400}$/.test(encoded))throw new Error('polygon');
  let binary:string;try{binary=atob(encoded.replaceAll('-','+').replaceAll('_','/'));}catch{throw new Error('polygon');}
  const values:number[]=[];let value=0,multiplier=1;const last=[0,0];
  for(const char of binary){const byte=char.charCodeAt(0);value+=(byte&127)*multiplier;if(value>72000000||multiplier>2**28)throw new Error('polygon');if(byte&128){multiplier*=128;continue;}
    const axis=values.length%2;last[axis]+=value%2?-(value+1)/2:value/2;values.push(last[axis]/scale);value=0;multiplier=1;
    if(values.length>MAX_VERTICES*2)throw new Error('polygon');
  }
  if(multiplier!==1||values.length%2)throw new Error('polygon');
  return normalizePolygon(Array.from({length:values.length/2},(_,i)=>[values[i*2],values[i*2+1]]));
}
export function customPicks(pool:Candidate[],identity:string,date:string):Candidate[] {
  if(pool.length<3||new Set(pool.map(p=>p.id)).size!==pool.length)throw new Error('few');
  const tiers:Difficulty[]=['easy','medium','hard'];
  const sorted=[...pool].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),day=dateOrdinal(date);
  const picked=tiers.flatMap(tier=>{const deck=shuffle(sorted.filter(p=>p.difficulty===tier),`custom-v1|${identity}|${tier}`);return deck.length?[deck[((day%deck.length)+deck.length)%deck.length]]:[];});
  const rest=shuffle(sorted.filter(p=>!picked.some(q=>q.id===p.id)),`custom-v1|${identity}|${date}|fill`);
  picked.push(...rest.slice(0,3-picked.length));
  return picked.sort((a,b)=>tiers.indexOf(a.difficulty)-tiers.indexOf(b.difficulty)||(a.id<b.id?-1:1));
}
