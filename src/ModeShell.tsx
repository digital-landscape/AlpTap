import {CopyIcon} from './ui/ShareIcons';
import {parseSharedGame,shareMessages} from './core/sharing';
import {useCallback,useEffect,useState} from 'react';
import App from './App';
import {ModeGame} from './ModeGame';
import {CustomArea} from './CustomArea';
import {modeMessages} from './core/mode-i18n';
import {browserStorage,initialPreferences,readJSON,saveJSON} from './core/persistence';
import {messages} from './core/i18n';
import {customMessages} from './core/custom-i18n';
import {gameURL,readGameRoute,type GameRoute} from './core/game-url';
import {viennaDate} from './core/date';
import {loadCatalog,type Catalog} from './data/catalog';
import {preparePlay,type PlaySetup} from './data/play';
import {InstitutionFooter} from './ui/InstitutionFooter';
import type {RegionId} from './core/types';
import './custom.css';
const storage=browserStorage;
function currentRoute():{route:GameRoute;error?:string}{
  const preferences=initialPreferences(storage,navigator.languages);
  const defaults:GameRoute={mode:readJSON(storage,'alptap:mode')==='world-peaks'?'world-peaks':'alpine-peaks',region:preferences.region};
  try{return {route:readGameRoute(location.search,defaults)};}catch{return {route:defaults,error:'link'};}
}
function DailyModeShell(){
  const [entry,setEntry]=useState(currentRoute),[revision,setRevision]=useState(0);
  const [locale,setLocale]=useState(()=>initialPreferences(storage,navigator.languages).locale);
  const [catalog,setCatalog]=useState<Catalog|null>(null),[setup,setSetup]=useState<PlaySetup|null>(null),[error,setError]=useState<string|null>(null);
  const [today,setToday]=useState(viennaDate),[drawing,setDrawing]=useState(false),[copied,setCopied]=useState(false),[copyLink,setCopyLink]=useState('');
  const t=customMessages[locale],route=entry.route;
  const cancel=useCallback(()=>{setSetup(null);setDrawing(false);setRevision(n=>n+1);},[]);
  useEffect(()=>{
    const restore=()=>{setDrawing(false);setEntry(currentRoute());setRevision(n=>n+1);};
    const date=()=>setToday(viennaDate());
    const interval=setInterval(date,10000);window.addEventListener('popstate',restore);window.addEventListener('focus',date);document.addEventListener('visibilitychange',date);
    return()=>{clearInterval(interval);window.removeEventListener('popstate',restore);window.removeEventListener('focus',date);document.removeEventListener('visibilitychange',date);};
  },[]);
  useEffect(()=>{
    // Preserve an unfinished drawing across Alpine midnight. Starting or
    // cancelling it resumes loading against the newest Alpine date.
    if(drawing)return;
    const controller=new AbortController();setSetup(null);setCatalog(null);setError(entry.error??null);setCopied(false);setCopyLink('');
    if(entry.error)return;
    (async()=>{
      const release=await loadCatalog(readGameRoute(location.search,route).catalog,controller.signal);
      const game=await preparePlay(route,release,today,storage,controller.signal);
      if(controller.signal.aborted)return;
      setCatalog(release);setSetup(game);
    })().catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error&&['catalog','few','version','polygon'].includes(e.message)?e.message:'failed');});
    return()=>controller.abort();
  },[entry,revision,today,drawing]);
  useEffect(()=>{if(!copied)return;const timer=setTimeout(()=>setCopied(false),3000);return()=>clearTimeout(timer);},[copied]);
  const navigate=(next:GameRoute)=>{
    history.pushState(null,'',gameURL(location.href,next));setEntry({route:next});setDrawing(false);
    if(next.mode!=='custom'){saveJSON(storage,'alptap:mode',next.mode);saveJSON(storage,'alptap:preferences',{...initialPreferences(storage,navigator.languages),region:next.region});}
  };
  const share=async()=>{
    if(!catalog)return;
    const url=gameURL(location.href,{...route,catalog:catalog.id});
    history.replaceState(null,'',url);
    try{await navigator.clipboard.writeText(url);setCopied(true);}catch{setCopyLink(url);}
  };
  const control=<>
    <label className="mode-select"><span>{modeMessages[locale].mode}</span><select aria-label={modeMessages[locale].mode} value={route.mode==='alpine-peaks'?(route.region==='alps'?'alpine-peaks':route.region):route.mode} onChange={e=>{
      const value=e.target.value;if(value==='custom')return;
      const region:RegionId=value==='western-alps'||value==='eastern-alps'?value:'alps';
      navigate({mode:value==='world-peaks'?'world-peaks':'alpine-peaks',region,catalog:catalog?.id});
    }}><optgroup label={modeMessages[locale].alpineGroup}><option value="alpine-peaks">{modeMessages[locale]['alpine-peaks']}</option>{(['western-alps','eastern-alps'] as const).map(region=><option key={region} value={region}>{messages[locale][region]}</option>)}</optgroup><optgroup label={modeMessages[locale].worldGroup}><option value="world-peaks">{modeMessages[locale]['world-peaks']}</option></optgroup>{route.mode==='custom'&&<option value="custom">{t.custom}</option>}</select></label>
    <div className="area-controls">
      <button className={route.mode==='custom'?'is-active':undefined} aria-label={t.custom} title={t.custom} disabled={!catalog} onClick={()=>setDrawing(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m5 6 13-2 2 13-13 3Z"/><g fill="currentColor" stroke="none"><circle cx="5" cy="6" r="2"/><circle cx="18" cy="4" r="2"/><circle cx="20" cy="17" r="2"/><circle cx="7" cy="20" r="2"/></g></svg>
      </button>
      <button className={copied?'is-copied':undefined} aria-label={copied?t.copied:t.share} title={copied?t.copied:t.share} disabled={!setup} onClick={share}>
        {copied?<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m5 12 4 4L19 6"/></svg>:<CopyIcon/>}
      </button>
      <span className="sr-only" role="status">{copied?t.copied:''}</span>
    </div>
  </>;
  return <div className="institution-layout">
    {drawing&&catalog?<CustomArea catalog={catalog} locale={locale} initial={route.polygon} world={setup?.kind==='world-peaks'} onCancel={cancel} onPlay={polygon=>navigate({mode:'custom',region:'alps',catalog:catalog.id,polygon})}/>:
      setup?(setup.kind==='alpine-peaks'?<App key={setup.session.challenge.id+revision} setup={setup} initialRegion={setup.session.challenge.region} modeControl={control} onLocale={setLocale}/>:<ModeGame key={setup.session.challenge.id+revision} setup={setup} mode="world-peaks" modeControl={control} onLocale={setLocale}/>):
      <main className="app-shell"><div className="filterbar">{control}</div><section className="loading-card" role={error?'alert':'status'}><h1>{error?t[error as keyof typeof t]??t.failed:t.loading}</h1>{error&&<div className="custom-actions"><button onClick={()=>setRevision(n=>n+1)}>{t.retry}</button><button onClick={()=>navigate({mode:'alpine-peaks',region:'alps'})}>{t.home}</button></div>}</section></main>}
    {copyLink&&<div className="copy-link-panel" role="dialog" aria-label={t.copy}><label>{t.copy}<input readOnly value={copyLink} autoFocus onFocus={e=>e.currentTarget.select()}/></label><button onClick={()=>setCopyLink('')}>{t.close}</button></div>}
    <InstitutionFooter locale={locale}/>
  </div>;
}

// Exact-result links take precedence over the catalogue/custom-area URL router.
export default function ModeShell(){
  return new URLSearchParams(location.search).has('play')?<SharedResultsGame/>:<DailyModeShell/>;
}
function SharedResultsGame(){
  const [shared]=useState(()=>{try{return parseSharedGame(location.search);}catch{return null;}});
  const [locale,setLocale]=useState(()=>initialPreferences(storage,navigator.languages).locale);
  const t=shareMessages[locale],daily=()=>location.assign(import.meta.env.BASE_URL);
  if(!shared)return <main className="app-shell"><section className="loading-card" role="alert"><h1>{t.invalid}</h1><button className="primary" onClick={daily}>{t.daily}</button></section></main>;
  const control=<div className="shared-challenge"><span><b>{t.shared}</b><small>{t.hint}</small></span><button onClick={daily}>{t.daily} ↗</button></div>;
  return <div className="institution-layout">{shared.kind==='alpine'?<App replay={shared} modeControl={control} onLocale={setLocale}/>:<ModeGame mode="world-peaks" replay={shared} modeControl={control} onLocale={setLocale}/>}<InstitutionFooter locale={locale}/></div>;
}
