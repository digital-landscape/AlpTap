import type { Difficulty, Locale, Position } from './types';
import type { SectionFeature } from './geography';
import { sectionCovers } from './geography';
import { distanceKm, validPosition } from './scoring';
import { shuffle } from './challenge';
import { dateOrdinal, nextViennaRollover } from './date';

export const MODES = ['alpine-peaks','world-peaks','alpine-valleys'] as const;
export type GameMode = typeof MODES[number];
export type NewMode = Exclude<GameMode,'alpine-peaks'>;
export const TIERS: Difficulty[] = ['easy','medium','hard'];
export type ScoringRule = 'alpine-section-v2'|'world-region-v1'|'valley-area-v1';
interface TargetBase {
  id: string; name: string; names: Partial<Record<Locale,string>>;
  position: Position; difficulty: Difficulty; countries: string[]; wikipedia: Record<string,string>;
  regionIds: string[]; geometryRef?: string; displayGeometryRef?: string;
  provenance: { source: string; url: string; license: string; reviewed: boolean; [key:string]: unknown };
}
export type SummitTarget=TargetBase & {kind:'summit'};
export type ValleyTarget=TargetBase & {kind:'valley';geometryRef:string;displayGeometryRef:string};
export type Target=SummitTarget|ValleyTarget;
export interface ModeRegion {id: string; name: string; geometryRef: string; displayGeometryRef: string}
export interface ModeManifest {
  schemaVersion: 2; version: string; mode: NewMode; targets: Target[]; regions: ModeRegion[];
  bounds: [number,number,number,number]; attribution: {name:string;url:string;license:string}[];
}
export interface ChallengeV2 {
  schemaVersion: 2; id: string; mode: GameMode; region: string; date: string; timezone:'Europe/Vienna';
  datasetVersion:string; algorithmVersion:string; scoringRule:ScoringRule;
  targetIds:string[]; roundDifficulties:Difficulty[]; nextRollover:string;
}
export interface ModeIndex {version:string;mode:NewMode;targets:Pick<Target,'id'|'difficulty'|'countries'>[];validated:boolean}
export interface ModeResult {guess:Position;distanceKm:number;score:number;distanceScore:number;areaBonus:number;inside:boolean;scoringRule:ScoringRule}
export interface ModeSession {schemaVersion:2;challenge:ChallengeV2;targets:Target[];round:number;results:ModeResult[];pendingGuess:Position|null;complete:boolean}
export const scoringRuleFor = (mode:GameMode):ScoringRule => mode==='world-peaks'?'world-region-v1':mode==='alpine-valleys'?'valley-area-v1':'alpine-section-v2';
export function releaseReady(index:ModeIndex):boolean {
  return index.validated===true && ['world-peaks','alpine-valleys'].includes(index.mode) && /^mode-[a-f0-9]{12}$/.test(index.version)
    && new Set(index.targets.map(t=>t.id)).size===index.targets.length && index.targets.every(t=>/^wikidata:Q\d+$/.test(t.id)&&TIERS.includes(t.difficulty)&&Array.isArray(t.countries))
    && TIERS.every(tier=>index.targets.filter(t=>t.difficulty===tier).length>=6)
    && (index.mode!=='alpine-valleys'||['FR','AT','IT','CH'].every(country=>index.targets.some(t=>t.countries.includes(country))));
}
export function generateModeChallenge(index:ModeIndex,date:string):ChallengeV2 {
  if(!releaseReady(index))throw new Error('Catalogue has not passed release checks');
  const seed=`daily-modes-v1|${index.mode}|${index.version}`;
  const day=dateOrdinal(date);
  const targetIds=TIERS.map(tier=>{const deck=shuffle(index.targets.filter(t=>t.difficulty===tier).map(t=>t.id).sort(),`${seed}|${tier}`);return deck[((day%deck.length)+deck.length)%deck.length];});
  return {schemaVersion:2,id:`${seed}|${date}`,mode:index.mode,region:index.mode==='world-peaks'?'world':'alps',date,timezone:'Europe/Vienna',datasetVersion:index.version,algorithmVersion:'daily-modes-v1',scoringRule:scoringRuleFor(index.mode),targetIds,roundDifficulties:[...TIERS],nextRollover:nextViennaRollover(date)};
}
export function validV2(c:unknown):c is ChallengeV2 {
  if(!c||typeof c!=='object')return false;const x=c as ChallengeV2;
  return x.schemaVersion===2&&MODES.includes(x.mode)&&x.scoringRule===scoringRuleFor(x.mode)&&typeof x.id==='string'&&typeof x.algorithmVersion==='string'&&/^(mode|alps)-[a-f0-9]{12}$/.test(x.datasetVersion)&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&Number.isFinite(Date.parse(x.date))&&x.timezone==='Europe/Vienna'&&x.nextRollover===nextViennaRollover(x.date)&&Array.isArray(x.targetIds)&&x.targetIds.length===3&&new Set(x.targetIds).size===3&&x.targetIds.every(id=>/^(wikidata:Q\d+|osm:node\/\d+)$/.test(id))&&JSON.stringify(x.roundDifficulties)===JSON.stringify(TIERS)&& (x.mode==='world-peaks'?x.region==='world':x.mode==='alpine-valleys'?x.region==='alps':['alps','western-alps','eastern-alps'].includes(x.region));
}
export function validTarget(value:unknown,mode:NewMode):value is Target {
  if(!value||typeof value!=='object')return false;const t=value as Target;
  return /^wikidata:Q\d+$/.test(t.id)&&t.kind===(mode==='world-peaks'?'summit':'valley')&&typeof t.name==='string'&&t.name.length>0&&validPosition(t.position)&&TIERS.includes(t.difficulty)&&!!t.names&&Object.values(t.names).every(v=>typeof v==='string')&&!!t.wikipedia&&Object.values(t.wikipedia).every(v=>typeof v==='string'&&/^https:\/\/[a-z-]+\.wikipedia\.org\/wiki\//.test(v))&&Array.isArray(t.countries)&&t.countries.every(c=>typeof c==='string')&&Array.isArray(t.regionIds)&&t.regionIds.every(id=>typeof id==='string')&&t.provenance?.reviewed===true&&(mode==='world-peaks'?t.regionIds.length>0:typeof t.geometryRef==='string'&&typeof t.displayGeometryRef==='string');
}
// Shift longitude to the copy nearest an anchor, for antimeridian camera/path continuity.
export const nearbyLongitude=(lon:number,anchor:number)=>anchor+((lon-anchor+540)%360+360)%360-180;
export function revealBounds(a:Position,b:Position):[number,number,number,number] {const lon=nearbyLongitude(b.lon,a.lon);return [Math.min(a.lon,lon),Math.min(a.lat,b.lat),Math.max(a.lon,lon),Math.max(a.lat,b.lat)];}
export function continuousPath(coordinates:number[][]):number[][] {return coordinates.reduce<number[][]>((out,p)=>{out.push([out.length?nearbyLongitude(p[0],out[out.length-1][0]):p[0],p[1]]);return out;},[]);}
function radians(v:number){return v*Math.PI/180;}
function bearing(a:Position,b:Position){const dl=radians(nearbyLongitude(b.lon,a.lon)-a.lon),la=radians(a.lat),lb=radians(b.lat);return Math.atan2(Math.sin(dl)*Math.cos(lb),Math.cos(la)*Math.sin(lb)-Math.sin(la)*Math.cos(lb)*Math.cos(dl));}
// Spherical distance to a great-circle segment, including its endpoints.
export function segmentDistance(p:Position,a:Position,b:Position):number {
  const R=6371.0088,d=distanceKm(a,p)/R,length=distanceKm(a,b)/R;
  if(length<1e-12)return distanceKm(a,p);
  const angle=bearing(a,p)-bearing(a,b),along=Math.atan2(Math.sin(d)*Math.cos(angle),Math.cos(d));
  if(along<0||along>length)return Math.min(distanceKm(p,a),distanceKm(p,b));
  return Math.abs(Math.asin(Math.max(-1,Math.min(1,Math.sin(d)*Math.sin(angle)))))*R;
}
export function polygonDistance(p:Position,feature:SectionFeature):number {
  if(sectionCovers(feature,p))return 0;
  const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
  let best=Infinity;
  for(const polygon of polygons)for(const ring of polygon)for(let i=1;i<ring.length;i++)best=Math.min(best,segmentDistance(p,{lon:ring[i-1][0],lat:ring[i-1][1]},{lon:ring[i][0],lat:ring[i][1]}));
  if(!Number.isFinite(best))throw new Error('Invalid valley boundary');return best;
}
export function evaluateModeGuess(mode:NewMode,target:Target,guess:Position,geometry:SectionFeature[]):ModeResult {
  if(!validPosition(guess))throw new Error('Invalid guess');
  if(!geometry.length)throw new Error('Scoring geometry unavailable');
  if(mode==='world-peaks'&&!target.regionIds.every(id=>geometry.some(g=>g.properties.id===id)))throw new Error('Incomplete mountain regions');
  if(mode==='alpine-valleys'&&(geometry.length!==1||geometry[0].properties.id!==target.id))throw new Error('Incorrect valley geometry');
  const inside=geometry.some(g=>sectionCovers(g,guess));
  const distance=mode==='world-peaks'?distanceKm(guess,target.position):polygonDistance(guess,geometry[0]);
  const base=Math.exp(-distance/(mode==='world-peaks'?250:50));
  const normalized=base+(mode==='world-peaks'&&inside ? .15*(1-base) : 0);
  const score=Math.round(1000*normalized),distanceScore=Math.round(1000*base);
  return {guess,distanceKm:distance,score,distanceScore,areaBonus:score-distanceScore,inside,scoringRule:scoringRuleFor(mode)};
}
