import { continuousPath, revealBounds } from '../core/modes';
import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as LibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
maplibregl.setWorkerUrl(mapWorkerUrl);
import { satellite, terrainConfig } from './config';
import { messages } from '../core/i18n';
import type { SectionFeature } from '../core/geography';
import type { Locale, Position, Result } from '../core/types';
export interface MapProps { world?: boolean; valley?: boolean; bounds: [number, number, number, number]; guess: Position | null; actual: Position | null; result?: Result; roundKey: string; locale: Locale; locked: boolean; sections: SectionFeature[]; onGuess(p: Position): void }
const empty = { type: 'FeatureCollection' as const, features: [] };
function padding() {
  const panel = document.querySelector('.game-card')?.getBoundingClientRect();
  return window.innerWidth < 720 ? { top: 205, bottom: panel ? window.innerHeight - panel.top + 58 : 340, left: 28, right: 65 } : { top: 165, bottom: 100, left: 445, right: 110 };
}
function marker(kind: string, label: string) {
  const el = document.createElement('div'); el.className = `map-pin ${kind}`;
  el.setAttribute('role','img'); el.setAttribute('aria-label', label);
  const core = document.createElement('span'); core.className='pin-core';
  const dot = document.createElement('span'); core.append(dot); el.append(core);
  return el;
}
export function AlpineMap(props: MapProps) {
  const element = useRef<HTMLDivElement>(null), map = useRef<LibreMap | null>(null), latest = useRef(props);
  const guessMarker = useRef<maplibregl.Marker | null>(null), summitMarker = useRef<maplibregl.Marker | null>(null);
  const [ready, setReady] = useState(false), [loaded, setLoaded] = useState(false), [failed, setFailed] = useState(false), [terrainFailed, setTerrainFailed] = useState(false);
  const [terrain, setTerrain] = useState(terrainConfig.enabled), [revision, setRevision] = useState(0);
  const [exaggeration, setExaggeration] = useState(terrainConfig.exaggeration);
  latest.current = props; const t = messages[props.locale];
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    setReady(false); setLoaded(false); setFailed(false); setTerrainFailed(false);
    let instance: LibreMap;
    try {
      instance = new maplibregl.Map({ container: element.current!, style: { version: 8, sources: { satellite }, layers: [{ id:'satellite', type:'raster', source:'satellite', paint:{'raster-fade-duration': 300, 'raster-saturation': -.1} }] }, center: [10.5,46.5], zoom: 5.5, maxZoom: 15, minZoom: props.world ? -2 : 3, maxPitch: 65, pitch: 35, attributionControl: { compact: false }, dragRotate: true, canvasContextAttributes: { antialias: true }, renderWorldCopies: !!props.world });
    } catch { setFailed(true); return; }
    map.current = instance;
    instance.getCanvas().setAttribute('aria-label', 'AlpTap satellite map');
    instance.on('idle', () => element.current?.setAttribute('data-settled', 'true'));
    instance.on('movestart', () => element.current?.setAttribute('data-settled', 'false'));
    instance.doubleClickZoom.disable();
    // MapLibre distinguishes clicks from drags; also bind each gesture to
    // the round that was accepting guesses when the pointer went down.
    let gestureRound: string | null = null;
    const onPointerDown = (event: PointerEvent) => {
      gestureRound = event.isPrimary && event.button === 0 && !latest.current.locked
        ? latest.current.roundKey : null;
    };
    const onPointerCancel = () => { gestureRound = null; };
    instance.getCanvas().addEventListener('pointerdown', onPointerDown);
    instance.getCanvas().addEventListener('pointercancel', onPointerCancel);
    instance.on('dragstart', onPointerCancel);
    instance.on('click', e => {
      const startedRound = gestureRound;
      gestureRound = null;
      if (startedRound === latest.current.roundKey && !latest.current.locked) {
        latest.current.onGuess({ lon: e.lngLat.wrap().lng, lat: e.lngLat.lat });
      }
    });
    instance.on('load', () => {
      instance.addSource('dem', terrainConfig.source);
      if (terrainConfig.enabled) instance.setTerrain({ source: 'dem', exaggeration });
      instance.addSource('summit-sections', {type:'geojson',data:empty});
      instance.addLayer({id:'section-fill',type:'fill',source:'summit-sections',paint:{'fill-color':'#d9e9a7','fill-opacity':0,'fill-opacity-transition':{duration:reduced()?0:1400,delay:reduced()?0:400}}});
      instance.addLayer({id:'section-outline',type:'line',source:'summit-sections',paint:{'line-color':'#e3efb8','line-width':1.6,'line-opacity':0,'line-opacity-transition':{duration:reduced()?0:1400,delay:reduced()?0:400}}});
      instance.addSource('connection', { type:'geojson', data:empty });
      instance.addLayer({ id:'connection-shadow', type:'line', source:'connection', paint:{'line-color':'#173c36','line-width':5,'line-opacity':.5} });
      instance.addLayer({ id:'connection', type:'line', source:'connection', paint:{'line-color':'#eaf4ba','line-width':2,'line-dasharray':[3,2]} });
      setReady(true);
    });
    instance.on('sourcedata', e => { if (e.sourceId === 'satellite' && e.isSourceLoaded) { setLoaded(true); setFailed(false); } });
    instance.on('error', e => {
      const source = (e as unknown as {sourceId?: string}).sourceId;
      const text = String(e.error?.message ?? '');
      if (source === 'dem' || /terrarium|elevation-tiles|dem/i.test(text)) { instance.setTerrain(null); setTerrainFailed(true); setTerrain(false); }
      else if (source === 'satellite' || /eox|WebGL|Failed to fetch/i.test(text)) setFailed(true);
    });
    const timeout = window.setTimeout(() => { if (!instance.isSourceLoaded('satellite')) setFailed(true); }, 18000);
    const observer = new ResizeObserver(() => instance.resize()); observer.observe(element.current!);
    return () => { clearTimeout(timeout); instance.getCanvas().removeEventListener('pointerdown', onPointerDown); instance.getCanvas().removeEventListener('pointercancel', onPointerCancel); observer.disconnect(); guessMarker.current?.remove(); summitMarker.current?.remove(); guessMarker.current = null; summitMarker.current = null; instance.remove(); map.current = null; };
  }, [revision]);
  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.setTerrain(terrain && !terrainFailed ? { source: 'dem', exaggeration } : null);
  }, [terrain, terrainFailed, ready, exaggeration]);
  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.easeTo({ pitch: terrain ? 35 : 0, duration: reduced() ? 0 : 650 });
  }, [terrain, terrainFailed, ready]);
  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.fitBounds(props.bounds, { padding:padding(), duration: reduced() ? 0 : 950, maxZoom: 8, pitch:props.world ? 0 : terrain ? 35 : 0 });
  // Frame the selected region initially, but preserve the view between summits.
  }, [ready, props.bounds[0], props.bounds[1], props.bounds[2], props.bounds[3]]);
  useEffect(() => {
    if (!ready || !map.current) return;
    (map.current.getSource('summit-sections') as GeoJSONSource).setData({type:'FeatureCollection',features:props.sections});
    map.current.setPaintProperty('section-fill','fill-opacity',props.sections.length ? (props.valley ? .25 : .12) : 0);
    map.current.setPaintProperty('section-outline','line-opacity',props.sections.length ? .8 : 0);
      if(props.valley&&props.sections.length){
      const coords=props.sections.flatMap(s=>s.geometry.type==='Polygon'?s.geometry.coordinates.flat():s.geometry.coordinates.flat(2));
      const xs=coords.map(p=>p[0]),ys=coords.map(p=>p[1]);
      map.current.fitBounds([Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],{padding:padding(),maxZoom:10,duration:reduced()?0:1200});
    }
  },[props.sections,ready]);
  useEffect(() => {
    if (!ready || !map.current) return;
    guessMarker.current?.remove(); guessMarker.current = null;
    if (props.guess) guessMarker.current = new maplibregl.Marker({element:marker('guess-pin',t.yourGuess),anchor:'center'}).setLngLat([props.guess.lon,props.guess.lat]).addTo(map.current);
  }, [props.guess, ready, props.locale]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const instance = map.current;
    summitMarker.current?.remove(); summitMarker.current = null;
    const source = instance.getSource('connection') as GeoJSONSource;
    source.setData(empty);
    if (!props.actual || !props.guess) return;
    const a = props.guess, b = props.actual;
    const summitTimer = window.setTimeout(() => {
      summitMarker.current = new maplibregl.Marker({ element:marker('summit-pin',t.summit), anchor:'center' }).setLngLat([b.lon,b.lat]).addTo(instance);
    }, reduced() ? 0 : 550);
    const cameraTimer = window.setTimeout(() => instance.fitBounds(revealBounds(a,b), { padding:padding(), maxZoom:12, duration:reduced() ? 0 : 1700, pitch:terrain ? 35 : 0 }), reduced() ? 0 : 350);
    // Great-circle interpolation for the connecting path, including long guesses.
    const toVector = (p: Position) => { const lat=p.lat*Math.PI/180,lon=p.lon*Math.PI/180; return [Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)]; };
    const va=toVector(a),vb=toVector(b),omega=Math.acos(Math.max(-1,Math.min(1,va.reduce((s,v,i)=>s+v*vb[i],0))));
    const coordinates=Array.from({length:65},(_,i)=>{ const f=i/64; if(omega<1e-6 || Math.abs(Math.sin(omega))<1e-6) return [a.lon+(b.lon-a.lon)*f,a.lat+(b.lat-a.lat)*f]; const v=va.map((x,j)=>(Math.sin((1-f)*omega)*x+Math.sin(f*omega)*vb[j])/Math.sin(omega)); return [Math.atan2(v[1],v[0])*180/Math.PI,Math.atan2(v[2],Math.hypot(v[0],v[1]))*180/Math.PI]; });
    let frame=0; const start=performance.now()+(reduced()?0:600);
    const draw=(time:number)=>{const progress=reduced()?1:Math.max(0,Math.min(1,(time-start)/1400));source.setData({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:continuousPath(coordinates).slice(0,Math.max(2,Math.ceil(progress*65)))}});if(progress<1)frame=requestAnimationFrame(draw);};
    frame=requestAnimationFrame(draw); return()=>{cancelAnimationFrame(frame);clearTimeout(summitTimer);clearTimeout(cameraTimer);};
  }, [props.actual, ready, props.roundKey]);
  return <div className="map-wrap">
    <div className="map-canvas" ref={element} data-testid="map"/>
    <div className="map-vignette"/>
    {(!loaded || failed) && <div className={`map-status ${failed?'is-error':''}`} role="status">{failed?t.mapError:t.mapLoading}{failed&&<button onClick={()=>setRevision(r=>r+1)}>{t.retryMap}</button>}</div>}
    {terrainFailed&&<div className="terrain-notice" role="status">{t.terrainError}</div>}
    <div className="map-tools"><button aria-label={t.zoomIn} title={t.zoomIn} onClick={()=>map.current?.zoomIn()}>+</button><button aria-label={t.zoomOut} title={t.zoomOut} onClick={()=>map.current?.zoomOut()}>−</button><span/><button title={t.reset} aria-label={t.reset} onClick={()=>map.current?.fitBounds(props.bounds,{padding:padding(),duration:reduced()?0:800})}>⌖</button></div>
    <label className="terrain-exaggeration" title={t.exaggeration}>
      <span aria-hidden="true">△</span>
      <input type="range" min="0" max="3" step="0.1" value={exaggeration} disabled={!terrain || terrainFailed} aria-label={t.exaggeration} aria-orientation="vertical" aria-valuetext={`${exaggeration.toFixed(1)}×`} onChange={event=>setExaggeration(Number(event.target.value))}/>
      <output>{exaggeration.toFixed(1)}×</output>
    </label>
    <button className={`terrain-toggle ${terrain?'active':''}`} disabled={terrainFailed} aria-pressed={terrain} onClick={()=>setTerrain(v=>!v)}>{terrain?'△':'▱'} <span>{terrain?t.terrain:t.flat}</span><i/></button>
    {!props.locked&&<button className="center-guess" onClick={()=>{ const canvas=map.current?.getCanvas(); const center=canvas&&map.current?.unproject([canvas.clientWidth/2,canvas.clientHeight*(window.innerWidth<720?.4:.5)]); if(center)props.onGuess({lon:center.wrap().lng,lat:center.lat}); }}>{t.center}</button>}
    {!props.locked&&<div className="map-crosshair" aria-hidden="true">+</div>}
    {props.actual&&<div className="map-legend"><span><i className="legend-guess"/>{t.yourGuess}</span><span><i className="legend-summit"/>{t.summit}</span></div>}
  </div>;
}
