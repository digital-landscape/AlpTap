import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import type {Locale,Position} from './core/types';
import {MAX_VERTICES,decodePolygon,encodePolygon,type Ring} from './core/custom';
import {customMessages} from './core/custom-i18n';
import type {Catalog} from './data/catalog';
import {customPool} from './data/play';
const AlpineMap=lazy(()=>import('./map/AlpineMap').then(m=>({default:m.AlpineMap})));
export function CustomArea({catalog,locale,initial,world,onCancel,onPlay}:{catalog:Catalog;locale:Locale;initial?:Ring;world:boolean;onCancel():void;onPlay(polygon:Ring):void}){
  const [points,setPoints]=useState<Ring>(initial??[]),[preview,setPreview]=useState<ReturnType<typeof customPool>|null>(null),[error,setError]=useState(false);
  const title=useRef<HTMLHeadingElement>(null),t=customMessages[locale];
  useEffect(()=>{title.current?.focus();const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')onCancel();};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[onCancel]);
  const add=(p:Position)=>{setError(false);setPoints(r=>r.length<MAX_VERTICES?[...r,[p.lon,p.lat]]:r);};
  const finish=()=>{try{const canonical=decodePolygon(encodePolygon(points));const selection=customPool(catalog,canonical);setPoints(canonical);setPreview(selection);setError(false);}catch{setError(true);}};
  return <main className="app-shell custom-editor">
    <Suspense fallback={<div className="map-backdrop"/>}><AlpineMap world frameBounds={!world} bounds={world?[-175,-55,180,75]:[4.88,43.54,16.59,48.36]} area={points} drawing={!preview} onVertex={add} guess={null} actual={null} roundKey={preview?'custom-preview':'custom-draw'} locale={locale} locked sections={[]} onGuess={()=>{}}/></Suspense>
    <section className="custom-panel" aria-labelledby="custom-title">
      <h1 id="custom-title" tabIndex={-1} ref={title}>{preview?t.preview:t.draw}</h1>
      {!preview&&<p>{t.instruction}</p>}
      <p>{points.length} / {MAX_VERTICES} {t.vertices}</p>
      {error&&<p role="alert">{t.polygon}</p>}
      {preview&&<div role="status" className="custom-preview"><strong>{preview.mode==='alpine-peaks'?t.alpine:t.world}</strong><p>{t.overlap}: {new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:1}).format(preview.overlap)}</p><p><b>{preview.pool.length}</b> {t.eligible}</p>{preview.pool.length<3?<p>{t.small}</p>:['easy','medium','hard'].some(tier=>!preview.pool.some(p=>p.difficulty===tier))&&<p>{t.fallback}</p>}<p>{t.daily}</p></div>}
      <div className="custom-actions">{preview?<><button onClick={()=>setPreview(null)}>{t.edit}</button><button className="primary" disabled={preview.pool.length<3} onClick={()=>onPlay(points)}>{t.play}</button></>:<><button disabled={!points.length} onClick={()=>{setPoints(p=>p.slice(0,-1));setError(false);}}>{t.undo}</button><button disabled={!points.length} onClick={()=>{setPoints([]);setError(false);}}>{t.clear}</button><button className="primary" disabled={points.length<3} onClick={finish}>{t.finish}</button></>}<button onClick={onCancel}>{t.cancel}</button></div>
    </section>
  </main>;
}
