import {parseSharedGame, shareMessages} from './core/sharing';
import {useState} from 'react';
import App from './App';
import {ModeGame} from './ModeGame';
import {MODES,type GameMode} from './core/modes';
import {modeMessages} from './core/mode-i18n';
import {initialPreferences,readJSON,saveJSON} from './core/persistence';
import {messages} from './core/i18n';
import type {RegionId} from './core/types';
import {InstitutionFooter} from './ui/InstitutionFooter';
const storage={getItem:(k:string)=>localStorage.getItem(k),setItem:(k:string,v:string)=>localStorage.setItem(k,v)};
export default function ModeShell(){
 const [shared]=useState(()=>{try{return {game:parseSharedGame(window.location.search),invalid:false};}catch{return {game:null,invalid:true};}});
 const replay=shared.game;
 const [mode,setMode]=useState<GameMode>(()=>{if(replay)return replay.kind==='alpine'?'alpine-peaks':'world-peaks';const saved=readJSON(storage,'alptap:mode');return MODES.includes(saved as GameMode)&&saved!=='alpine-valleys'?saved as GameMode:'alpine-peaks';});
 const [regionalEntry,setRegionalEntry]=useState<{region:RegionId;revision:number}|null>(null);
 const [locale,setLocale]=useState(()=>initialPreferences(storage,navigator.languages).locale);
 const daily=()=>window.location.assign(import.meta.env.BASE_URL);
 if(shared.invalid)return <main className="app-shell"><section className="loading-card" role="alert"><h1>{shareMessages[locale].invalid}</h1><button className="primary" onClick={daily}>{shareMessages[locale].daily}</button></section></main>;
 const control=replay?<div className="shared-challenge"><span><b>{shareMessages[locale].shared}</b><small>{shareMessages[locale].hint}</small></span><button onClick={daily}>{shareMessages[locale].daily} ↗</button></div>:<label className="mode-select"><span>{modeMessages[locale].mode}</span><select aria-label={modeMessages[locale].mode} value={mode==='alpine-peaks'?((regionalEntry?.region??initialPreferences(storage,navigator.languages).region)==='alps'?'alpine-peaks':(regionalEntry?.region??initialPreferences(storage,navigator.languages).region)):mode} onChange={e=>{const value=e.target.value;
 if(value==='western-alps'||value==='eastern-alps'){
  const preferences=initialPreferences(storage,navigator.languages);
  saveJSON(storage,'alptap:preferences',{...preferences,region:value});
  setRegionalEntry(previous=>({region:value,revision:(previous?.revision??0)+1}));
  saveJSON(storage,'alptap:mode','alpine-peaks');setMode('alpine-peaks');
 }else{const next=value as GameMode;setRegionalEntry(next==='alpine-peaks'?{region:'alps',revision:(regionalEntry?.revision??0)+1}:null);if(next==='alpine-peaks')saveJSON(storage,'alptap:preferences',{...initialPreferences(storage,navigator.languages),region:'alps'});saveJSON(storage,'alptap:mode',next);setMode(next);}}}><optgroup label={modeMessages[locale].alpineGroup}><option value="alpine-peaks">{modeMessages[locale]['alpine-peaks']}</option>{(['western-alps','eastern-alps'] as const).map(region=><option key={region} value={region}>{messages[locale][region]}</option>)}</optgroup><optgroup label={modeMessages[locale].worldGroup}><option value="world-peaks">{modeMessages[locale]['world-peaks']}</option></optgroup></select></label>;
 return <div className="institution-layout">{mode==='alpine-peaks'?<App key={regionalEntry?.revision??0} initialRegion={regionalEntry?.region} replay={replay?.kind==='alpine'?replay:undefined} modeControl={control} onLocale={setLocale}/>:<ModeGame key={mode} mode={mode} replay={replay?.kind==='world'?replay:undefined} modeControl={control} onLocale={setLocale}/>}<InstitutionFooter locale={locale}/></div>;
}
