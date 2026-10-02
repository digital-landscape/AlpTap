import {lazy, Suspense, useEffect, useMemo, useRef, useState} from 'react';
import {messages} from './core/i18n';
import {modeMessages} from './core/mode-i18n';
import {exploreMessages} from './core/explore-i18n';
import {getPeakName} from './core/names';
import {getAreaName} from './core/area-names';
import {peakInfoLink} from './core/peak-links';
import {initialPreferences, saveJSON} from './core/persistence';
import type {Difficulty, Locale, Position} from './core/types';
import {Brand} from './ui/Brand';
import {MountainIcon} from './ui/MountainIcon';
import {InstitutionFooter} from './ui/InstitutionFooter';
import './explore.css';
const AlpineMap = lazy(() => import('./map/AlpineMap').then(module => ({default:module.AlpineMap})));
const storage = {getItem:(key:string)=>localStorage.getItem(key),setItem:(key:string,value:string)=>localStorage.setItem(key,value)};
type CatalogueMode = 'alpine-peaks' | 'world-peaks';
interface ExplorerPeak {
 id:string; name:string; names:Record<string,string>; aliases:string[]; elevation:number|null;
 countries:string[]; difficulty:Difficulty; position:Position; regions:string[]; wikipedia:Record<string,string>;
}
interface Catalogue {peaks:ExplorerPeak[]; regions?:Record<string,string>}
const normalize = (text:string) => text.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase();
const pageSize = 60;
export default function Explore() {
 const [locale,setLocale] = useState(() => initialPreferences(storage,navigator.languages).locale);
 const [mode,setMode] = useState<CatalogueMode>(() => new URLSearchParams(location.search).get('mode') === 'world-peaks' ? 'world-peaks' : 'alpine-peaks');
 const [catalogue,setCatalogue] = useState<Catalogue|null>(null);
 const [error,setError] = useState(false), [retry,setRetry] = useState(0);
 const [query,setQuery] = useState(''), [difficulty,setDifficulty] = useState<Difficulty|''>('');
 const [limit,setLimit] = useState(pageSize);
 const [browseOpen,setBrowseOpen] = useState(false);
 const [selectedId,setSelectedId] = useState<string|null>(() => new URLSearchParams(location.search).get('peak'));
 const detail = useRef<HTMLElement>(null);
 const t = exploreMessages[locale], common = messages[locale], modes = modeMessages[locale];
 useEffect(() => {document.documentElement.lang=locale;document.title=`${t.explore} · AlpTap`;},[locale,t.explore]);
 const countryNames = useMemo(() => new Intl.DisplayNames([locale],{type:'region'}),[locale]);
 const country = (code:string) => {try{return countryNames.of(code) || code;}catch{return code;}};
 useEffect(() => {
  const controller = new AbortController();
  setCatalogue(null); setError(false);
  fetch(`${import.meta.env.BASE_URL}explore/${mode}.json`,{signal:controller.signal})
   .then(response => {if(!response.ok) throw new Error('Catalogue unavailable');return response.json() as Promise<Catalogue>;})
   .then(data => {if(!controller.signal.aborted)setCatalogue(data);})
   .catch(() => {if(!controller.signal.aborted)setError(true);});
  return () => controller.abort();
 },[mode,retry]);
 useEffect(() => {
  const restore = () => {const params=new URLSearchParams(location.search);setMode(params.get('mode')==='world-peaks'?'world-peaks':'alpine-peaks');setSelectedId(params.get('peak'));};
  window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore);
 },[]);
 const updateUrl = (nextMode:CatalogueMode,id:string|null) => {
  const url = new URL(location.href);url.searchParams.set('mode',nextMode);
  if(id)url.searchParams.set('peak',id);else url.searchParams.delete('peak');
  history.pushState(null,'',url);
 };
 const clearSelection = () => {setSelectedId(null);const url=new URL(location.href);url.searchParams.delete('peak');history.replaceState(null,'',url);};
 const entries = useMemo(() => (catalogue?.peaks??[]).map(peak => ({peak,name:getPeakName(peak,locale),search:normalize([peak.name,...Object.values(peak.names),...peak.aliases,...peak.regions.map(id=>catalogue?.regions?.[id]??getAreaName(id,locale)),...peak.countries.flatMap(code=>[code,country(code)])].join(' '))})).sort((a,b) => a.name.localeCompare(b.name,locale)),[catalogue,locale,countryNames]);
 const filtered = useMemo(() => {const terms=normalize(query).trim().split(/\s+/);return entries.filter(({peak,search})=>(!difficulty||peak.difficulty===difficulty)&&terms.every(term=>search.includes(term)));},[entries,query,difficulty]);
 const mapPeaks = useMemo(()=>filtered.map(({peak,name})=>({id:peak.id,name,position:peak.position,difficulty:peak.difficulty})),[filtered]);
 const selected = catalogue?.peaks.find(peak=>peak.id===selectedId);
 const source = selected ? peakInfoLink({...selected,wikidata:selected.id.replace('wikidata:','')},locale) : null;
 const changeMode = (next:CatalogueMode) => {setMode(next);setSelectedId(null);setQuery('');setDifficulty('');setLimit(pageSize);updateUrl(next,null);};
 const selectPeak = (peak:ExplorerPeak) => {setSelectedId(peak.id);updateUrl(mode,peak.id);requestAnimationFrame(()=>{detail.current?.focus({preventScroll:true});});};
 return <div className="explorer">
  <header className="explore-header"><Brand tagline={common.tagline} dateLabel={t.explore}/><nav aria-label={t.explore}><a className="explore-link" href={import.meta.env.BASE_URL}>← {t.daily}</a><label className="language-select"><span className="sr-only">{common.language}</span><select aria-label={common.language} value={locale} onChange={event=>{const next=event.target.value as Locale;setLocale(next);saveJSON(storage,'alptap:preferences',{...initialPreferences(storage,navigator.languages),locale:next});}}>{(['en','de','fr','it'] as const).map(lang=><option key={lang} value={lang}>{lang.toUpperCase()}</option>)}</select></label></nav></header>
  <main className="explore-main">
   <div className="explore-map"><Suspense fallback={<p className="catalogue-message">{common.mapLoading}</p>}><AlpineMap key={mode} explorePeaks={mapPeaks} onExploreSelect={id=>{const peak=catalogue?.peaks.find(p=>p.id===id);if(peak)selectPeak(peak);}} explorePoint={selected?.position} world={mode==='world-peaks'} bounds={mode==='world-peaks'?[-175,-55,180,75]:[4.88,43.54,16.59,48.36]} guess={null} actual={null} roundKey={mode} locale={locale} locked sections={[]} onGuess={()=>{}}/></Suspense></div>
   <div className="explore-layout">
    <section className="peak-browser" aria-label={t.explore}>
     <div className="catalogue-controls"><h1>{t.explore}</h1><p className="map-explore-hint">{t.mapHint}</p>
      <div className="catalogue-modes">{(['alpine-peaks','world-peaks'] as const).map(value=><button key={value} aria-pressed={mode===value} onClick={()=>changeMode(value)}>{modes[value]}</button>)}</div>
      <label className="peak-search"><span aria-hidden="true">⌕</span><input type="search" aria-label={t.search} placeholder={t.search} value={query} onChange={event=>{setQuery(event.target.value);setLimit(pageSize);clearSelection();}}/></label>
      <div className="catalogue-filter"><p role="status">{catalogue?`${filtered.length.toLocaleString(locale)} ${filtered.length===1?t.result:t.results}`:error?'—':t.loading}</p><select aria-label={t.all} value={difficulty} onChange={event=>{setDifficulty(event.target.value as Difficulty|'');setLimit(pageSize);clearSelection();}}><option value="">{t.all}</option>{(['easy','medium','hard'] as const).map(tier=><option key={tier} value={tier}>{common[tier]}</option>)}</select></div>
     </div>
     {error?<div className="catalogue-message" role="alert"><p>{t.error}</p><button className="example-button" onClick={()=>setRetry(value=>value+1)}>{t.retry}</button></div>:catalogue&&filtered.length===0?<p className="catalogue-message">{t.empty}</p>: (browseOpen||query.trim())&&<ul className="peak-list">{filtered.slice(0,limit).map(({peak,name})=><li key={peak.id}><button aria-pressed={selectedId===peak.id} onClick={()=>selectPeak(peak)}><span className="peak-list-icon" aria-hidden="true"><MountainIcon/></span><span className="peak-list-copy"><strong>{name}</strong><small>{[peak.elevation!==null?`${peak.elevation.toLocaleString(locale)} m`:null,...peak.countries.map(country)].filter(Boolean).join(' · ')||peak.regions.map(id=>mode==='alpine-peaks'?getAreaName(id,locale):catalogue?.regions?.[id]??id).join(' · ')||t.unknown}</small></span><span className={`peak-tier tier-${peak.difficulty}`}>{common[peak.difficulty]}</span><span aria-hidden="true">↗</span></button></li>)}</ul>}
     {(browseOpen||query.trim())&&filtered.length>limit&&<button className="catalogue-more" onClick={()=>setLimit(value=>value+pageSize)}>{t.more} <span aria-hidden="true">↓</span></button>}
     <button className="browse-toggle" aria-expanded={browseOpen} onClick={()=>setBrowseOpen(open=>!open)}>{browseOpen?t.hideList:t.browseList}</button>
    </section>
    <section className={`peak-detail ${selected?'has-peak':''}`} ref={detail} tabIndex={-1} aria-label={t.detail}>
     {selected?<><div className="peak-detail-heading"><button className="detail-back" onClick={()=>{setSelectedId(null);updateUrl(mode,null);document.querySelector<HTMLInputElement>('.peak-search input')?.focus();}}>× {t.close}</button><span className={`peak-tier tier-${selected.difficulty}`}>{common[selected.difficulty]}</span><h2>{getPeakName(selected,locale)}</h2><p>{[...new Set([selected.name,...['en','de','fr','it'].map(language=>selected.names[language]),...selected.aliases])].filter(name=>name&&name!==getPeakName(selected,locale)).slice(0,4).join(' · ')}</p></div>
      <dl className="peak-facts"><div><dt>{t.elevation}</dt><dd>{selected.elevation!==null?`${selected.elevation.toLocaleString(locale)} m`:t.unknown}</dd></div><div><dt>{t.countries}</dt><dd>{selected.countries.map(country).join(', ')||t.unknown}</dd></div><div className="wide"><dt>{t.region}</dt><dd>{selected.regions.map(id=>mode==='alpine-peaks'?getAreaName(id,locale):catalogue?.regions?.[id]??id).join(' · ')||t.unknown}</dd></div><div className="wide"><dt>{t.coordinates}</dt><dd>{Math.abs(selected.position.lat).toFixed(4)}° {selected.position.lat<0?'S':'N'}, {Math.abs(selected.position.lon).toFixed(4)}° {selected.position.lon<0?'W':'E'}</dd></div></dl>
      {source&&<a className="explore-source" href={source.url} target="_blank" rel="noopener noreferrer">{source.label} <span aria-hidden="true">↗</span></a>}
     </>:null}
    </section>
   </div>
   <div className="explore-map-legend" aria-label={t.all}>{(['easy','medium','hard'] as const).map(tier=><span key={tier}><i className={`dot-${tier}`}/>{common[tier]}</span>)}</div>
  </main><footer className="explore-footer"><InstitutionFooter locale={locale}/></footer>
 </div>;
}
