import {useState} from 'react';
import App from './App';
import {ModeGame} from './ModeGame';
import {MODES,type GameMode} from './core/modes';
import {modeMessages} from './core/mode-i18n';
import {initialPreferences,readJSON,saveJSON} from './core/persistence';
const storage={getItem:(k:string)=>localStorage.getItem(k),setItem:(k:string,v:string)=>localStorage.setItem(k,v)};
export default function ModeShell(){
 const [mode,setMode]=useState<GameMode>(()=>{const saved=readJSON(storage,'alptap:mode');return MODES.includes(saved as GameMode)?saved as GameMode:'alpine-peaks';});
 const [locale,setLocale]=useState(()=>initialPreferences(storage,navigator.languages).locale);
 const control=<label className="mode-select"><span>{modeMessages[locale].mode}</span><select aria-label={modeMessages[locale].mode} value={mode} onChange={e=>{const next=e.target.value as GameMode;saveJSON(storage,'alptap:mode',next);setMode(next);}}>{MODES.map(m=><option key={m} value={m}>{modeMessages[locale][m]}</option>)}</select></label>;
 return mode==='alpine-peaks'?<App modeControl={control} onLocale={setLocale}/>:<ModeGame key={mode} mode={mode} modeControl={control} onLocale={setLocale}/>;
}
