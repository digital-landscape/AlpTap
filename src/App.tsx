import {ProjectCredits} from './ui/ProjectCredits';
import {MountainIcon} from './ui/MountainIcon';
import {Brand} from './ui/Brand';
import { practiceBounds, practiceSummit } from './core/practice';
import { getAreaName } from './core/area-names';
import { peakInfoLink } from './core/peak-links';
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { onboardingMessages, languageNames } from './core/onboarding-i18n';
import { messages } from './core/i18n';
import { interactionMessages, resultMessages } from './core/interaction-i18n';
import { matchingSections, type SectionFeature } from './core/geography';
import { loadSections } from './data/sections';
import { AnimatedNumber } from './ui/AnimatedNumber';
import { ScoringCurve } from './ui/ScoringCurve';
import { InstitutionFooter } from './ui/InstitutionFooter';
import { GAME, LOCALES } from './core/config';
import { alternativeNames, getPeakName } from './core/names';
import { initialPreferences, loadSession, readJSON, saveJSON, sessionKey, type StorageLike } from './core/persistence';
import { evaluateGuess } from './core/scoring';
import { viennaDate } from './core/date';
import { createChallengeProvider, loadDataset } from './data/provider';
import type { GameSession, Manifest, Preferences, Position, Peak, Result } from './core/types';
const AlpineMap = lazy(() => import('./map/AlpineMap').then(m => ({default:m.AlpineMap})));
const storage: StorageLike = { getItem: key => localStorage.getItem(key), setItem: (key,value) => localStorage.setItem(key,value) };

function Arrow() { return <span aria-hidden="true">↗</span>; }
export default function App({modeControl,onLocale,initialRegion}:{initialRegion?:Preferences['region'];modeControl?:ReactNode;onLocale?:(locale:Preferences['locale'])=>void}={}) {
 const [scoresAside,setScoresAside]=useState(false),[reviewRound,setReviewRound]=useState<number|null>(null);
  const [preferences,setPreferences] = useState<Preferences>(()=>({...initialPreferences(storage,navigator.languages),...(initialRegion?{region:initialRegion}:{})}));
  const [session,setSession] = useState<GameSession|null>(null), [manifest,setManifest] = useState<Manifest|null>(null);
  const [loading,setLoading] = useState(true), [error,setError] = useState(false), [retry,setRetry] = useState(0), [storageOk,setStorageOk] = useState(true), [today,setToday] = useState(viennaDate());
  const welcomeDialog=useRef<HTMLDialogElement>(null);
  const [welcomeOpen,setWelcomeOpen]=useState(()=>readJSON(storage,'alptap:onboarding:v1')!==true);
  const [practiceActive,setPracticeActive]=useState(false);
  const [practiceResult,setPracticeResult]=useState<Result|null>(null);
  const dialog=useRef<HTMLDialogElement>(null), heading=useRef<HTMLHeadingElement>(null);
  const t={...messages[preferences.locale],...interactionMessages[preferences.locale],...resultMessages[preferences.locale]}, locale=preferences.locale;
  const onboarding=onboardingMessages[locale];
  useEffect(()=>{if(welcomeOpen&&!welcomeDialog.current?.open)welcomeDialog.current?.showModal();},[welcomeOpen]);
  const startPractice=()=>{setPracticeResult(null);setPracticeActive(true);setWelcomeOpen(false);welcomeDialog.current?.close();};
  const finishWelcome=()=>{setPracticeActive(false);if(!saveJSON(storage,'alptap:onboarding:v1',true))setStorageOk(false);setWelcomeOpen(false);welcomeDialog.current?.close();};
  useEffect(()=>{
    if(!practiceActive)return;
    const skipPractice=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!dialog.current?.open){event.preventDefault();finishWelcome();}
    };
    window.addEventListener('keydown',skipPractice);
    return()=>window.removeEventListener('keydown',skipPractice);
  },[practiceActive]);
  const [sections,setSections]=useState<SectionFeature[]>([]), [sectionError,setSectionError]=useState(false), [sectionRetry,setSectionRetry]=useState(0);
  useEffect(()=>{document.documentElement.lang=locale;onLocale?.(locale);},[locale]);
  useEffect(()=>{setStorageOk(saveJSON(storage,'alptap:preferences',preferences));},[preferences]);
  useEffect(()=>{const id=setInterval(()=>setToday(viennaDate()),30000);return()=>clearInterval(id);},[]);
  useEffect(()=>{
    const controller=new AbortController(); setLoading(true);setError(false);setSession(null);
    const run=async()=>{
      const saved=loadSession(storage,preferences.region,preferences.difficulty);
      if(saved){
        const cached=readJSON(storage,`alptap:manifest:${saved.challenge.datasetVersion}`) as Manifest|null;
        if(cached?.version===saved.challenge.datasetVersion && Array.isArray(cached.units)) {setManifest(cached);setSession(saved);setLoading(false);return;}
        const data=await loadDataset(saved.challenge,controller.signal);
        if(controller.signal.aborted)return;
        setManifest(data.manifest);setSession(saved);
      }else{
        const challenge=await createChallengeProvider(storage).load(preferences.region,preferences.difficulty,controller.signal);
        const data=await loadDataset(challenge,controller.signal);
        if(controller.signal.aborted)return;
        saveJSON(storage,`alptap:manifest:${data.manifest.version}`,data.manifest);
        setManifest(data.manifest);setSession({schemaVersion:1,interactionVersion:'instant-v2',challenge,peaks:data.peaks,results:[],pendingGuess:null,round:0,complete:false});
      }
      setLoading(false);
    };
    run().catch(()=>{if(!controller.signal.aborted){setError(true);setLoading(false);}});
    return()=>controller.abort();
  },[preferences.region,preferences.difficulty,retry]);
  useEffect(()=>{if(session)setStorageOk(saveJSON(storage,sessionKey(session.challenge.region,session.challenge.difficulty),session));},[session]);
  useEffect(()=>{if((session||practiceActive)&&!welcomeOpen)heading.current?.focus({preventScroll:true});},[session?.round,session?.complete,session?.results.length,welcomeOpen,practiceActive,practiceResult]);
  const change=<K extends keyof Preferences>(key:K,value:Preferences[K])=>setPreferences(p=>({...p,[key]:value}));
 useEffect(()=>{setReviewRound(null);setScoresAside(false);},[session?.challenge.id]);
 useEffect(()=>{if(session?.complete)setScoresAside(true);},[session?.complete,session?.challenge.id]);
  const mapRound=session?.complete?(reviewRound??session.round):session?.round;
  const peak=session?.peaks[mapRound??0],result=session?.results[mapRound??0];
  const sectionKey = session && peak ? `${session.challenge.datasetVersion}/${peak.id}` : '';
  useEffect(()=>{
    setSections([]);setSectionError(false);
    if(!session || !peak)return;
    let canceled=false;
    loadSections(session.challenge.datasetVersion,peak.soiusa.sectionIds).then(value=>{if(!canceled)setSections(value);}).catch(()=>{if(!canceled)setSectionError(true);});
    return()=>{canceled=true;};
  },[sectionKey,sectionRetry]);
  useEffect(()=>{
    if(!session?.pendingGuess || result || !peak || !sections.length || !peak.soiusa.sectionIds.every(id=>sections.some(s=>s.properties.id===id)))return;
    setSession(s=>!s || s.peaks[s.round].id!==peak.id || !s.pendingGuess || s.results.length>s.round?s:{...s,results:[...s.results,evaluateGuess(peak.id,s.pendingGuess,peak,matchingSections(s.pendingGuess,sections))]});
  },[session?.pendingGuess,sections,sectionKey,result]);
  const unit=manifest?.units.find(u=>u.id===preferences.region);
  const number=(n:number,digits=0)=>new Intl.NumberFormat(locale,{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(n);
  const date=session?.challenge.date??today;
  const dateLabel=new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Vienna'}).format(new Date(`${date}T12:00:00Z`));
  const guess=(position:Position)=>setSession(s=>!s||s.pendingGuess||s.results.length>s.round?s:{...s,interactionVersion:'instant-v2',pendingGuess:position});
  const total=session?.results.reduce((n,r)=>n+r.score,0)??0;
  const renderResult=(peak:Peak,result:Result,recap=false)=>(<div className="reveal-content" aria-live="polite"><div className="result-stats"><div><span className="eyebrow">{t.distance}</span><strong>{recap?number(result.distanceKm,1):<AnimatedNumber value={result.distanceKm} locale={locale} digits={1}/>}<small> km</small></strong></div><div><span className="eyebrow">{t.points}</span><strong>{recap?number(result.score):<AnimatedNumber value={result.score} locale={locale}/>}<small> / 1{locale==='en'?',':' '}000</small></strong></div></div><div className="score-track"><span style={{width:`${result.normalizedScore*100}%`}}/></div>{result.scoringVersion==='section-v2'&&<div className="score-breakdown"><span>{t.distancePoints} <b>{number(result.distanceScore??result.score)}</b></span><span>{t.areaPoints} <b>+{result.areaBonus??0}</b></span></div>}<p className="result-message">{result.distanceKm<5?t.resultGreat:result.distanceKm<50?t.resultGood:t.resultFar}</p><div className={`section-result ${result.matchedSectionIds?.length?'matched':''}`}><span className="eyebrow">{t.section} · {peak.soiusa.sectionIds.join(' / ')}</span><b>{peak.soiusa.sectionIds.map(id=>getAreaName(id,locale,manifest?.units.find(u=>u.id===id))).join(' · ')}</b>{result.scoringVersion==='section-v2'&&<p>{result.matchedSectionIds?.length?`✓ ${t.rightSection}`:t.outsideSection}<strong>+{result.areaBonus??0}</strong></p>}</div><div className="summit-details"><div><MountainIcon/><span><b>{peak.elevation===null?t.unknown:`${number(peak.elevation)} m`}</b><small>{t.elevation}</small></span></div><p>{peak.countries.map(c=>new Intl.DisplayNames([locale],{type:'region'}).of(c)??c).join(' / ')}<span>{peak.soiusa.sectionIds.map(id=>getAreaName(id,locale,manifest?.units.find(u=>u.id===id))).join(' · ')}</span></p></div>{peak.countryCandidates?.length>0&&<p className="border-note">{t.border}</p>}<a className="source-link" href={peakInfoLink(peak,locale).url} target="_blank" rel="noreferrer">{t.learn} · {peakInfoLink(peak,locale).label} ↗</a>{!recap&&<p className="result-continue-note">{t.keepResult}</p>}</div>);
  return <main className="app-shell">
    {practiceActive?<Suspense fallback={<div className="map-backdrop"/>}><AlpineMap bounds={practiceBounds} guess={practiceResult?.guess??null} actual={practiceResult?practiceSummit:null} roundKey="practice:mont-blanc" locale={locale} onGuess={position=>setPracticeResult(current=>current??evaluateGuess('wikidata:Q583',position,practiceSummit))} locked={!!practiceResult||welcomeOpen} sections={[]}/></Suspense>:session&&unit?.bounds&&<Suspense fallback={<div className="map-backdrop"/>}><AlpineMap bounds={unit.bounds} guess={result?.guess??session.pendingGuess} actual={result&&peak?peak:null} result={result} roundKey={`${session.challenge.id}:${mapRound}`} locale={locale} onGuess={guess} locked={welcomeOpen||!!session.pendingGuess||!!result||session.complete} sections={result?sections:[]}/></Suspense>}
    <header className="topbar">
      <Brand tagline={t.tagline} dateLabel={dateLabel}/>
      <div className="daily-heading"><span className="eyebrow"><i/>{t.daily}</span><span className="date">{dateLabel}</span></div>
      <div className="header-actions"><label className="language-select"><span className="sr-only">{t.language}</span><span aria-hidden="true">◎</span><select aria-label={t.language} value={locale} onChange={e=>change('locale',e.target.value as Preferences['locale'])}>{LOCALES.map(l=><option key={l} value={l}>{l.toUpperCase()}</option>)}</select></label><button className="help-button" aria-label={t.help} title={t.help} onClick={()=>dialog.current?.showModal()}>?</button></div>
    </header>
    <div className="filterbar">{modeControl}<div className="mode-highlight"><span className="mode-label">{onboarding.mode}<b>{practiceActive?onboarding.practiceMode:onboarding.dailyMode}</b></span><div className="daily-order">{(['easy','medium','hard'] as const).map((level,i)=><span className="difficulty-step" key={level}>{i>0&&<span aria-hidden="true">→</span>}<span aria-current={!practiceActive&&!welcomeOpen&&!session?.complete&&peak?.difficulty.level===level?'step':undefined}>{t[level]}</span></span>)}</div></div><span className="filter-note">{t.hint}</span></div>
    {!practiceActive&&(loading||error)&&<section className="loading-card" role="status"><MountainIcon large/><h1>{loading?t.loading:t.error}</h1>{loading?<div className="loading-dots"><i/><i/><i/></div>:<><p>{t.errorHint}</p><button className="primary" onClick={()=>setRetry(n=>n+1)}>{t.retry}<Arrow/></button></>}</section>}
    {practiceActive&&<section className={`game-card practice-card ${practiceResult?'revealed':''}`} aria-label={onboarding.practiceMode}>
      <p className="eyebrow">{onboarding.practiceMode}</p><div className="peak-heading"><p className="prompt">{practiceResult?t.revealed:t.find}</p><h1 ref={heading} tabIndex={-1}>{locale==='it'?'Monte Bianco':'Mont Blanc'}{!practiceResult&&<span className="question">{t.question}</span>}</h1></div>
      <p className="instruction">{onboarding.practice}</p>
      {practiceResult?<><div className="result-stats" aria-live="polite"><div><span className="eyebrow">{t.distance}</span><strong>{number(practiceResult.distanceKm,1)}<small> km</small></strong></div></div><p className="instruction">{practiceResult.distanceKm<5?t.resultGreat:practiceResult.distanceKm<50?t.resultGood:t.resultFar}</p><button className="primary" onClick={finishWelcome}>{onboarding.practiceDone}<Arrow/></button></>:<><p className="instruction">{t.instruction}</p><div className="instant-guess-hint">⌖ {t.place}</div></>}
    </section>}
    {!practiceActive&&session&&peak&&!loading&&!session.complete&&<section className={`game-card ${result?'revealed':''}`} aria-label={t.daily} data-difficulty={peak.difficulty.level}>
      <div className="card-topline"><span className="eyebrow">{t.round} {String(session.round+1).padStart(2,'0')} <span className="muted">/ {String(session.peaks.length).padStart(2,'0')}</span></span><span className="difficulty-badge"><i/><i className={peak.difficulty.level!=='easy'?'filled':''}/><i className={peak.difficulty.level==='hard'?'filled':''}/>{t[peak.difficulty.level]}</span></div>
      <div className="round-progress" aria-label={`${t.roundLabel} ${session.round+1} ${t.of} ${session.peaks.length}`}>{session.peaks.map((p,i)=><span key={p.id} className={i<session.results.length?'done':i===session.round?'current':''}/>)}</div>
      {date!==today&&<p className="previous-note">{t.previous}</p>}
      <div className="peak-heading"><p className="prompt">{result?t.revealed:t.find}</p><h1 ref={heading} tabIndex={-1}>{getPeakName(peak,locale)}{!result&&<span className="question">{t.question}</span>}</h1>{!result&&<div className="question-area"><span className="eyebrow">{t.section}</span><p>{peak.soiusa.sectionIds.map(id=>getAreaName(id,locale,manifest?.units.find(u=>u.id===id))).join(" · ")}</p></div>}{result&&<p className="alternative-names">{alternativeNames(peak,locale).join(' · ')}</p>}</div>
      {!result?<><p className="instruction">{session.pendingGuess?t.revealing:t.instruction}</p><div className={`instant-guess-hint ${session.pendingGuess?'submitted':''}`}><span aria-hidden="true">⌖</span>{session.pendingGuess?t.revealing:t.place}</div>{sectionError&&session.pendingGuess&&<div className="section-error" role="status"><p>{t.sectionError}</p><button onClick={()=>setSectionRetry(n=>n+1)}>{t.retry}</button></div>}<div className="card-footnote"><span aria-hidden="true">↔</span>{t.keyboard}</div></>:<>{renderResult(peak,result)}<button className="primary" onClick={()=>setSession(s=>!s?s:s.round===s.peaks.length-1?{...s,complete:true}:{...s,round:s.round+1,pendingGuess:null})}>{session.round===session.peaks.length-1?t.finish:t.nextRound}</button></>}
    </section>}
    {!practiceActive&&session?.complete&&<div className={`summary-scrim ${scoresAside?'scores-aside':''}`}><section className="summary-card"><button className="summary-toggle" onClick={()=>setScoresAside(v=>!v)}>{scoresAside?t.scoresView:t.mapView}</button><span className="summary-mountain"><MountainIcon large/></span><p className="eyebrow">{t.completed}</p><h1 ref={heading} tabIndex={-1}>{t.summary}</h1><p className="summary-sub">{t.summarySub}</p><div className="summary-score"><span className="eyebrow">{t.total}</span><strong>{number(total)}<small> / {number(session.peaks.length*GAME.maxRoundScore)}</small></strong><div className="score-track"><span style={{width:`${total/(session.peaks.length*GAME.maxRoundScore)*100}%`}}/></div><span>{t.average} <b>{number(session.results.reduce((n,r)=>n+r.distanceKm,0)/session.results.length,1)} km</b></span></div><ol className="result-card-grid">{session.peaks.map((p,i)=><li key={p.id} className="recap-card" data-difficulty={p.difficulty.level}><span className="eyebrow">{t.round} {String(i+1).padStart(2,'0')} / {String(session.peaks.length).padStart(2,'0')}</span><span className="recap-difficulty">{t[p.difficulty.level]}</span><div className="peak-heading"><p className="prompt">{t.revealed}</p><h2><button className="recap-map-button" aria-pressed={(reviewRound??session.round)===i} onClick={()=>{setReviewRound(i);setScoresAside(true);}}>{getPeakName(p,locale)} ↗</button></h2><p className="alternative-names">{alternativeNames(p,locale).join(' · ')}</p></div>{renderResult(p,session.results[i],true)}</li>)}</ol><div className="tomorrow"><span aria-hidden="true">☀</span><div><b>{t.tomorrow}</b><p>{t.tomorrowSub}</p></div></div>{date!==today&&<button className="primary" onClick={()=>setRetry(r=>r+1)}>{t.newToday}<Arrow/></button>}<p className="save-note">{storageOk?'✓':'!'} {storageOk?t.saved:t.storageError}</p></section></div>}
    <footer className="app-footer"><span>ALPTAP <i/> {t.daily}</span><span className={storageOk?'':'storage-warning'}>{storageOk?'◌':'!'} {storageOk?t.saved:t.storageError}</span></footer>
    <dialog ref={welcomeDialog} className="about-dialog welcome-dialog" aria-labelledby="welcome-title" onCancel={e=>{e.preventDefault();finishWelcome();}}>
      <label className="welcome-language">{t.language}<select autoFocus value={locale} onChange={e=>change('locale',e.target.value as Preferences['locale'])}>{LOCALES.map(l=><option key={l} value={l}>{languageNames[l]}</option>)}</select></label>
      <MountainIcon large/><h2 id="welcome-title">{onboarding.welcome}</h2><p>{onboarding.intro}</p>
      <div className="welcome-mode"><span className="eyebrow">{onboarding.mode}</span><h3>{onboarding.dailyMode}</h3><div className="daily-order"><span>{t.easy}</span><span aria-hidden="true">→</span><span>{t.medium}</span><span aria-hidden="true">→</span><span>{t.hard}</span></div></div>
      <ol className="welcome-steps">{onboarding.steps.map(step=><li key={step}>{step}</li>)}</ol>
      <section className="welcome-example"><h3>{onboarding.example}</h3><p>{onboarding.exampleText}</p><small>{onboarding.practice}</small></section>
      <button className="primary" onClick={startPractice}>{onboarding.start}<Arrow/></button>
      <InstitutionFooter locale={locale} placement="welcome"/>
    </dialog>
    <dialog ref={dialog} className="about-dialog" aria-labelledby="about-title"><button className="dialog-close" aria-label={t.close} onClick={()=>dialog.current?.close()}>×</button><MountainIcon large/><p className="eyebrow">ALPTAP</p><h2 id="about-title">{t.how}</h2><button className="example-button" onClick={()=>{dialog.current?.close();setWelcomeOpen(true);}}>{onboarding.instructions} ↗</button><p>{t.howText}</p><p>{t.howScore}</p><ScoringCurve locale={locale}/><p>{t.howData}</p><p>{t.howPrivacy}</p><ProjectCredits locale={locale}/><h3>{t.credits}</h3><p>{t.attribution}</p><p className="terrain-credits">Terrain: Mapzen; © offene Daten Österreichs (DGM Österreich); Copernicus EU-DEM, funded by the European Union; USGS (SRTM/GMTED2010); NOAA (ETOPO1).</p><div className="credit-links"><a href="https://www.wikidata.org/wiki/Wikidata:Licensing" target="_blank" rel="noreferrer">Wikidata · CC0 ↗</a><a href="https://maps.eox.at/" target="_blank" rel="noreferrer">EOX Maps ↗</a><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap ↗</a><a href="https://www.homoalpinus.com/alpes/subdivisions/soiusa/" target="_blank" rel="noreferrer">SOIUSA ↗</a><a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noreferrer">Mapzen ↗</a></div></dialog>
  </main>;
}
