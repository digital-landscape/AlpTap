import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import clipping from 'polygon-clipping';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=async path=>JSON.parse(await readFile(root+path,'utf8'));
const alpine=await read('data/processed/api-index.json');
const world=(await read('data/processed/mode-index.json')).find(x=>x.mode==='world-peaks');
const manifest=await read(`public/data/${alpine.version}/manifest.json`);
const worldManifest=await read(`public/data/${world.version}/manifest.json`);
const records={};
for(let i=0;i<64;i++)Object.assign(records,await read(`public/data/${alpine.version}/peaks-${String(i).padStart(2,'0')}.json`));
const sections=await Promise.all(manifest.units.filter(u=>/^SZ\./.test(u.id)).map(u=>read(`public/data/${alpine.version}/sections/${u.id}.json`)));
const boundary={type:'MultiPolygon',coordinates:clipping.union(...sections.map(f=>f.geometry.coordinates))};
const config=await readFile(root+'src/core/config.ts','utf8');
const payload={schemaVersion:1,algorithms:{alpine:config.match(/mixedAlgorithmVersion: '([^']+)'/)[1],world:'daily-modes-v1',custom:'custom-v1'},
  alpine:{version:alpine.version,peaks:alpine.peaks.map(p=>({...p,position:{lon:records[p.id].lon,lat:records[p.id].lat}}))},
  world:{...world,targets:world.targets.map(p=>({...p,position:worldManifest.targets.find(t=>t.id===p.id).position}))},
  boundary,curated:await read('data/config/curated.json')};
const content=JSON.stringify(payload);
const id='catalog-'+createHash('sha256').update(content).digest('hex').slice(0,16);
const directory=root+'public/data/catalogs/';await mkdir(directory,{recursive:true});
const published=JSON.stringify({id,...payload});
try{await writeFile(directory+id+'.json',published,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;if(await readFile(directory+id+'.json','utf8')!==published)throw new Error('Refusing to overwrite an immutable catalogue');}
await writeFile(directory+'current.json',JSON.stringify({id}));
console.log(`Prepared shared-game catalogue: ${id}`);
