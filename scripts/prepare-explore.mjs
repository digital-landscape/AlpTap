import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = async path => JSON.parse(await readFile(root + path, 'utf8'));
const alpine = await read('data/processed/api-index.json');
const indexes = await read('data/processed/mode-index.json');
// Preserve every recorded edition: regionally significant peaks may only have a local-language article.
const wikipedia = links => links ?? {};
const records = {};
for (let bucket = 0; bucket < 64; bucket++) Object.assign(records, await read(`public/data/${alpine.version}/peaks-${String(bucket).padStart(2,'0')}.json`));
const peaks = alpine.peaks.map(({id}) => {
  const p = records[id];
  return {id:p.id, name:p.name, names:p.names, aliases:p.aliases, elevation:p.elevation, countries:p.countries, difficulty:p.difficulty.level, position:{lon:p.lon,lat:p.lat}, regions:p.soiusa.sectionIds, wikipedia:wikipedia(p.wikipedia)};
});
await mkdir(root + 'public/explore', {recursive:true});
await writeFile(root + 'public/explore/alpine-peaks.json', JSON.stringify({peaks}));
const world = indexes.find(index => index.mode === 'world-peaks');
const manifest = await read(`public/data/${world.version}/manifest.json`);
await writeFile(root + 'public/explore/world-peaks.json', JSON.stringify({version:manifest.version,peaks:manifest.targets.map(p => ({id:p.id,name:p.name,names:p.names,aliases:[],elevation:null,countries:p.countries,difficulty:p.difficulty,position:p.position,regions:p.regionIds,wikipedia:wikipedia(p.wikipedia)})), regions:Object.fromEntries(manifest.regions.map(r => [r.id,r.name]))}));
console.log(`Prepared explorer: ${peaks.length} Alpine and ${manifest.targets.length} worldwide peaks.`);
