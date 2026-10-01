import {lazy,Suspense,useEffect,useRef,useState,type ReactNode} from 'react';
import {messages} from './core/i18n';
import {interactionMessages,resultMessages} from './core/interaction-i18n';
import {modeMessages} from './core/mode-i18n';
import {languageNames} from './core/onboarding-i18n';
import {initialPreferences,saveJSON,type StorageLike} from './core/persistence';
import {evaluateModeGuess,TIERS,type ModeManifest,type ModeSession,type NewMode,type Target} from './core/modes';
import {modeChallenge,modeManifest,modeSessionKey,restoreMode,targetGeometry} from './data/modes';
import {viennaDate} from './core/date';
import type {Locale} from './core/types';
import type {SectionFeature} from './core/geography';
const AlpineMap=lazy(()=>import('./map/AlpineMap').then(m=>({default:m.AlpineMap})));
const storage:StorageLike={getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)};
export function ModeGame({mode,modeControl,onLocale}:{mode:NewMode;modeControl:ReactNode;onLocale(l:Locale):void}){
 const [locale,setLocale]=useState(()=>initialPreferences(storage,navigator.languages).locale);
 const [session,setSession]=useState<ModeSession|null>(null),[manifest,setManifest]=useState<ModeManifest|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(false),[unavailable,setUnavailable]=useState(false),[retry,setRetry]=useState(0),[storageOk,setStorageOk]=useState(true),[today,setToday]=useState(viennaDate());
 const [geometry,setGeometry]=useState<SectionFeature[]>([]),[display,setDisplay]=useState<SectionFeature[]>([]),[geometryError,setGeometryError]=useState(false),[geometryRetry,setGeometryRetry]=useState(0);
 const [helpOpen,setHelpOpen]=useState(false);const help=useRef<HTMLDialogElement>(null),heading=useRef<HTMLHeadingElement>(null);
 const t={...messages[locale],...interactionMessages[locale],...resultMessages[locale]},m=modeMessages[locale];
 const target=session?.targets[session.round],result=session?.results[session.round];
 const number=(v:number,d=0)=>new Intl.NumberFormat(locale,{maximumFractionDigits:d}).format(v);
 const name=(target:Target)=>target.names[locale]??target.name;
 useEffect(()=>{document.documentElement.lang=locale;onLocale(locale);const p=initialPreferences(storage,navigator.languages);setStorageOk(saveJSON(storage,'alptap:preferences',{...p,locale}));},[locale]);
 useEffect(()=>{const id=setInterval(()=>setToday(viennaDate()),30000);return()=>clearInterval(id);},[]);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError(false);setUnavailable(false);
  (async()=>{
   const saved=await restoreMode(storage,mode,controller.signal);
   if(saved){if(!controller.signal.aborted){setSession(saved.session);setManifest(saved.manifest);setLoading(false);}return;}
   const response=await fetch(`${import.meta.env.VITE_API_URL??''}/v2/modes`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)])}).catch(e=>{if(controller.signal.aborted)throw e;return null;});
   if(response?.ok){const status=await response.json();if(status.modes?.some((s:{mode:string;available:boolean})=>s.mode===mode&&!s.available)){if(!controller.signal.aborted){setUnavailable(true);setLoading(false);}return;}}
   const challenge=await modeChallenge(mode,storage,controller.signal),data=await modeManifest(challenge,controller.signal);
   if(controller.signal.aborted)return;
   setManifest(data);setSession({schemaVersion:2,challenge,targets:challenge.targetIds.map(id=>data.targets.find(t=>t.id===id)!),round:0,results:[],pendingGuess:null,complete:false});setLoading(false);
  })().catch(()=>{if(!controller.signal.aborted){setError(true);setLoading(false);}});
  return()=>controller.abort();
 },[mode,retry]);
 useEffect(()=>{if(session)setStorageOk(saveJSON(storage,modeSessionKey(mode),session));},[session,mode]);
 useEffect(()=>{
  setGeometry([]);setDisplay([]);setGeometryError(false);if(!manifest||!target)return;
  const controller=new AbortController();
  Promise.all([targetGeometry(manifest,target,false,controller.signal),targetGeometry(manifest,target,true,controller.signal)]).then(([g,d])=>{if(!controller.signal.aborted){setGeometry(g);setDisplay(d);}}).catch(()=>{if(!controller.signal.aborted)setGeometryError(true);});
  return()=>controller.abort();
 },[manifest,target?.id,geometryRetry]);
 useEffect(()=>{if(!session?.pendingGuess||result||!target||!geometry.length)return;
  try {const r=evaluateModeGuess(mode,target,session.pendingGuess,geometry);setSession(s=>!s||s.results.length>s.round?s:{...s,results:[...s.results,r]});}catch{setGeometryError(true);}
 },[geometry,session?.pendingGuess,target?.id,result]);
 useEffect(()=>{if(!result||session?.complete||helpOpen)return;const timer=setTimeout(()=>setSession(s=>!s?s:s.round===2?{...s,complete:true}:{...s,round:s.round+1,pendingGuess:null}),6000);return()=>clearTimeout(timer);},[result,session?.complete,helpOpen]);
 useEffect(()=>{if(!helpOpen)heading.current?.focus({preventScroll:true});},[session?.round,session?.complete,result,helpOpen]);
 const date=session?.challenge.date??today;
 return <main className="app-shell mode-game">
  {manifest&&session&&target&&!loading&&!error&&<Suspense fallback={<div className="map-backdrop"/>}><AlpineMap bounds={manifest.bounds} guess={result?.guess??session.pendingGuess} actual={result&&target.kind==='summit'?target.position:null} roundKey={`${session.challenge.id}:${session.round}`} locale={locale} onGuess={guess=>setSession(s=>!s||s.pendingGuess||s.results.length>s.round?s:{...s,pendingGuess:guess})} locked={!!session.pendingGuess||!!result||session.complete||helpOpen} sections={result?display:[]} world={mode==='world-peaks'} valley={mode==='alpine-valleys'}/></Suspense>}
  <header className="topbar"><a className="brand" href="./">Alp<span className="brand-light">Tap</span></a><div className="daily-heading"><span className="eyebrow">{m[mode]}</span><span className="date">{new Intl.DateTimeFormat(locale,{dateStyle:'long',timeZone:'Europe/Vienna'}).format(new Date(date+'T12:00:00Z'))}</span></div><div className="header-actions"><label className="language-select"><span className="sr-only">{t.language}</span><select aria-label={t.language} value={locale} onChange={e=>setLocale(e.target.value as Locale)}>{Object.entries(languageNames).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><button className="help-button" aria-label={t.help} onClick={()=>{setHelpOpen(true);help.current?.showModal();}}>?</button></div></header>
  <div className="filterbar">{modeControl}<div className="mode-highlight"><div className="daily-order">{TIERS.map((tier,i)=><span className="difficulty-step" key={tier}>{i>0&&<span aria-hidden="true">→</span>}<span aria-current={!loading&&!error&&!session?.complete&&target?.difficulty===tier?'step':undefined}>{t[tier]}</span></span>)}</div></div></div>
  {(loading||error||unavailable)&&<section className="loading-card" role="status"><h1>{loading?t.loading:unavailable?m.unavailable:t.error}</h1><p>{unavailable?m.unavailableHint:error?t.errorHint:''}</p>{!loading&&<button className="primary" onClick={()=>setRetry(v=>v+1)}>{t.retry}</button>}</section>}
  {!loading&&!error&&session&&target&&!session.complete&&<section className={`game-card ${result?'revealed':''}`} data-difficulty={target.difficulty}>
   <div className="card-topline"><span className="eyebrow">{t.roundLabel} {session.round+1} / 3</span><span className="difficulty-badge">{t[target.difficulty]}</span></div>
   <div className="round-progress">{TIERS.map((tier,i)=><span key={tier} className={i<session.results.length?'done':i===session.round?'current':''}/>)}</div>
   {date!==today&&<p className="previous-note">{t.previous}</p>}
   <div className="peak-heading"><p className="prompt">{target.kind==='valley'?m.findValley:target.provenance.featureType==='volcano'?m.findVolcano:m.findPeak}</p><h1 ref={heading} tabIndex={-1}>{name(target)}</h1>{target.kind==='summit'&&<div className="question-area"><span className="eyebrow">{m.range}</span><p>{target.regionIds.map(id=>manifest?.regions.find(r=>r.id===id)?.name).join(' · ')}</p></div>}</div>
   {!result?<><p className="instruction">{session.pendingGuess?t.revealing:target.kind==='valley'?m.valleyInstruction:t.instruction}</p>{target.kind==='valley'&&<p className="instruction">{m.valleyDefinition}</p>}<div className="instant-guess-hint">⌖ {session.pendingGuess?t.revealing:t.place}</div>{geometryError&&session.pendingGuess&&<div className="section-error" role="status"><p>{m.geometryError}</p><button onClick={()=>setGeometryRetry(v=>v+1)}>{t.retry}</button></div>}</>:<div className="reveal-content"><div className="result-stats"><div><span className="eyebrow">{target.kind==='valley'?m.boundaryDistance:t.distance}</span><strong>{number(result.distanceKm,1)}<small> km</small></strong></div><div><span className="eyebrow">{t.points}</span><strong>{number(result.score)}<small> / {number(1000)}</small></strong></div></div><div className="score-track"><span style={{width:`${result.score/10}%`}}/></div>{target.kind==='valley'?<p className="result-message">{result.inside?m.inside:m.outside}</p>:<div className="score-breakdown"><span>{t.distancePoints} <b>{number(result.distanceScore)}</b></span><span>{m.regionBonus} <b>+{result.areaBonus}</b></span></div>}<p className="result-continue-note">{t.keepResult}</p><a className="source-link" href={target.wikipedia[locale]??Object.values(target.wikipedia)[0]??`https://www.wikidata.org/wiki/${target.id.split(':')[1]}`} target="_blank" rel="noreferrer">{t.learn} ↗</a></div>}
  </section>}
  {session?.complete&&!loading&&!error&&<div className="summary-scrim"><section className="summary-card"><p className="eyebrow">{m.complete} · {m[mode]}</p><h1 ref={heading} tabIndex={-1}>{m.summary}</h1><div className="summary-score"><strong>{number(session.results.reduce((s,r)=>s+r.score,0))}<small> / {number(3000)}</small></strong></div><ol className="result-card-grid">{session.targets.map((target,i)=><li className="recap-card" key={target.id}><span className="recap-difficulty">{t[target.difficulty]}</span><h2>{name(target)}</h2><div className="result-stats"><strong>{number(session.results[i].score)}<small> {t.scoreLabel}</small></strong></div><p>{number(session.results[i].distanceKm,1)} km · {target.kind==='valley'?m.boundaryDistance:t.distance}</p></li>)}</ol><p>{t.tomorrowSub}</p>{date!==today&&<button className="primary" onClick={()=>{setSession(null);setRetry(r=>r+1);}}>{t.newToday}</button>}</section></div>}
  <footer className="app-footer"><span>ALPTAP · {m[mode]}</span><span>{storageOk?t.saved:t.storageError}</span></footer>
  <dialog className="about-dialog" ref={help} onClose={()=>setHelpOpen(false)}><button className="dialog-close" aria-label={t.close} onClick={()=>help.current?.close()}>×</button><h2>{m[mode]}</h2><p>{mode==='world-peaks'?m.worldHelp:m.valleyHelp}</p>{mode==='alpine-valleys'&&<p>{m.valleyDefinition}</p>}<h3>{m.credits}</h3>{manifest?.attribution.map(a=><p key={a.url}><a href={a.url} target="_blank" rel="noreferrer">{a.name}</a> · {a.license}</p>)}</dialog>
 </main>;
}
