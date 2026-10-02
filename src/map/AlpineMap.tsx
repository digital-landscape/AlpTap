import {customMessages} from '../core/custom-i18n';
import {unwrap,type Ring} from '../core/custom';
import { continuousPath, revealBounds } from '../core/modes';
import { useEffect, useId, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as LibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
maplibregl.setWorkerUrl(mapWorkerUrl);
import { terrainConfig } from './config';
import { basemapLabels, basemapSources, basemapStyle, readBasemap, saveBasemap } from './basemap';
import { SolarShadows } from './SolarShadows';
import { solarPosition } from './solar';
const shadowLabels = { en: 'Sun shadows', de: 'Sonnenschatten', fr: 'Ombres du soleil', it: 'Ombre solari' };
const controlLabels = { en: 'Map controls', de: 'Kartensteuerung', fr: 'Commandes de la carte', it: 'Controlli della mappa' };
import { messages } from '../core/i18n';
import type { SectionFeature } from '../core/geography';
import type { Locale, Position, Result } from '../core/types';
export interface MapPair { guess: Position; actual: Position; label: string }
export interface ExploreMapPeak { id:string; name:string; position:Position; difficulty:string }
export interface MapProps { area?: Ring; drawing?: boolean; onVertex?(p:Position):void; frameBounds?: boolean; explorePeaks?: ExploreMapPeak[]; onExploreSelect?(id:string):void; explorePoint?: Position; pairs?: MapPair[]; focusedPair?: number | null; world?: boolean; valley?: boolean; bounds: [number, number, number, number]; guess: Position | null; actual: Position | null; result?: Result; roundKey: string; locale: Locale; locked: boolean; sections: SectionFeature[]; onGuess(p: Position): void }
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
function pairPath(a: Position, b: Position) {
  // Great-circle interpolation for the connecting path, including long guesses.
  const toVector = (p: Position) => { const lat=p.lat*Math.PI/180,lon=p.lon*Math.PI/180; return [Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)]; };
  const va=toVector(a),vb=toVector(b),omega=Math.acos(Math.max(-1,Math.min(1,va.reduce((s,v,i)=>s+v*vb[i],0))));
  return Array.from({length:65},(_,i)=>{ const f=i/64; if(omega<1e-6 || Math.abs(Math.sin(omega))<1e-6) return [a.lon+(b.lon-a.lon)*f,a.lat+(b.lat-a.lat)*f]; const v=va.map((x,j)=>(Math.sin((1-f)*omega)*x+Math.sin(f*omega)*vb[j])/Math.sin(omega)); return [Math.atan2(v[1],v[0])*180/Math.PI,Math.atan2(v[2],Math.hypot(v[0],v[1]))*180/Math.PI]; });
}
export function AlpineMap(props: MapProps) {
  const element = useRef<HTMLDivElement>(null), map = useRef<LibreMap | null>(null), latest = useRef(props);
  const pairMarkers = useRef<maplibregl.Marker[]>([]);
  const guessMarker = useRef<maplibregl.Marker | null>(null), summitMarker = useRef<maplibregl.Marker | null>(null);
  const [ready, setReady] = useState(false), [loaded, setLoaded] = useState(false), [failed, setFailed] = useState(false), [terrainFailed, setTerrainFailed] = useState(false);
  const [terrain, setTerrain] = useState(terrainConfig.enabled), [revision, setRevision] = useState(0);
  const [basemap, setBasemap] = useState(readBasemap);
  const [controlsOpen, setControlsOpen] = useState(false);
  const controlsId = useId();
  const controlsToggle = useRef<HTMLButtonElement>(null);
  const activeBasemap = useRef(basemap);
  const failedSources = useRef(new Set<string>());
  activeBasemap.current = basemap;
  const labels = basemapLabels[props.locale];
  const [bearing, setBearing] = useState(0);
  const [shadowPreference, setShadowPreference] = useState<boolean | null>(null);
  const [shadowsEnabled, setShadowsEnabled] = useState(() => solarPosition((props.bounds[1]+props.bounds[3])/2, (props.bounds[0]+props.bounds[2])/2, Date.now()).altitude > 0);
  const solarShadows = useRef<SolarShadows | null>(null);
  const [exaggeration, setExaggeration] = useState(terrainConfig.exaggeration);
  const viewPadding = () => props.drawing || props.onVertex ? (window.innerWidth<720?{top:30,bottom:285,left:25,right:65}:{top:50,bottom:85,left:410,right:100}) : props.explorePeaks ? (window.innerWidth<720 ? {top:175,bottom:90,left:30,right:60} : {top:80,bottom:80,left:390,right:90}) : props.explorePoint ? {top:40,bottom:60,left:40,right:100} : padding();
  const showOverview = (instance: LibreMap, duration: number) => {
    const inset = viewPadding();
    if (props.world && !props.frameBounds) {
      const diameter = Math.max(120, Math.min(instance.getCanvas().clientWidth-inset.left-inset.right, instance.getCanvas().clientHeight-inset.top-inset.bottom));
      instance.easeTo({center:[10.5,20],zoom:Math.log2(diameter*Math.PI/512),bearing:0,pitch:0,padding:inset,duration});
    } else instance.fitBounds(props.bounds,{padding:inset,duration,maxZoom:props.area?.length?12:8,pitch:props.world?0:terrain?35:0});
  };
  latest.current = props; const t = messages[props.locale];
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    setReady(false); setLoaded(false); setFailed(false); setTerrainFailed(false);
    failedSources.current.clear();
    let instance: LibreMap;
    try {
      instance = new maplibregl.Map({ container: element.current!, style: { ...basemapStyle(activeBasemap.current), projection: {type: props.world ? 'globe' : 'mercator'} }, center: [10.5,46.5], zoom: 5.5, maxZoom: 15, minZoom: props.world || props.frameBounds ? -2 : 3, maxPitch: 65, pitch: props.world ? 0 : 35, attributionControl: { compact: false }, dragRotate: true, canvasContextAttributes: { antialias: true }, renderWorldCopies: false });
    } catch { setFailed(true); return; }
    map.current = instance;
    setBearing(instance.getBearing());
    instance.on('rotate', () => setBearing(instance.getBearing()));
    instance.on('idle', () => element.current?.setAttribute('data-settled', 'true'));
    instance.on('movestart', () => element.current?.setAttribute('data-settled', 'false'));
    instance.doubleClickZoom.disable();
    // MapLibre distinguishes clicks from drags; also bind each gesture to
    // the round that was accepting guesses when the pointer went down.
    let gestureRound: string | null = null;
    const onPointerDown = (event: PointerEvent) => {
      gestureRound = event.isPrimary && event.button === 0 && (!latest.current.locked || !!latest.current.drawing)
        ? latest.current.roundKey : null;
    };
    const onPointerCancel = () => { gestureRound = null; };
    instance.getCanvas().addEventListener('pointerdown', onPointerDown);
    instance.getCanvas().addEventListener('pointercancel', onPointerCancel);
    instance.on('dragstart', onPointerCancel);
    instance.on('click', e => {
      const startedRound = gestureRound;
      gestureRound = null;
      if (startedRound === latest.current.roundKey && (!latest.current.locked || latest.current.drawing) && (!latest.current.world || instance.project(e.lngLat).dist(e.point) < 2)) {
        const point={ lon: e.lngLat.wrap().lng, lat: e.lngLat.lat };
        if(latest.current.drawing)latest.current.onVertex?.(point);else latest.current.onGuess(point);
      }
    });
    instance.on('load', () => {
      if (latest.current.explorePeaks) {
        instance.addSource('explore-peaks', {type:'geojson',data:empty,cluster:true,clusterRadius:40,clusterMaxZoom:10});
        instance.addLayer({id:'explore-clusters',type:'circle',source:'explore-peaks',filter:['has','point_count'],paint:{'circle-color':'#d9e9a7','circle-radius':['step',['get','point_count'],18,100,23,1000,29],'circle-stroke-width':2,'circle-stroke-color':'#294c37','circle-opacity':.95}});
        instance.addLayer({id:'explore-cluster-count',type:'symbol',source:'explore-peaks',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-font':['Open Sans Bold'],'text-size':12,'text-allow-overlap':true},paint:{'text-color':'#203a34'}});
        instance.addLayer({id:'explore-summits',type:'circle',source:'explore-peaks',filter:['!', ['has','point_count']],paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,5,10,8,14,10],'circle-color':['match',['get','difficulty'],'easy','#d9e9a7','medium','#eed593','#e7ae8c'],'circle-stroke-width':2,'circle-stroke-color':'#203a34'}});
        instance.addLayer({id:'explore-summit-names',type:'symbol',source:'explore-peaks',minzoom:8,filter:['!', ['has','point_count']],layout:{'text-field':['get','name'],'text-font':['Open Sans Regular'],'text-size':12,'text-anchor':'top','text-offset':[0,1]},paint:{'text-color':'#fff','text-halo-color':'#203a34','text-halo-width':2}});
        instance.on('click', 'explore-clusters', async event => {
          const feature=event.features?.[0];
          if (!feature || feature.geometry.type!=='Point') return;
          try {
            const zoom=await (instance.getSource('explore-peaks') as GeoJSONSource).getClusterExpansionZoom(Number(feature.properties.cluster_id));
            if (map.current===instance) instance.easeTo({center:feature.geometry.coordinates as [number,number],zoom,duration:reduced()?0:650});
          } catch { /* The catalogue may change while a cluster is expanding. */ }
        });
        instance.on('click',['explore-summits','explore-summit-names'],event=>{const id=event.features?.[0]?.properties.id;if(typeof id==='string')latest.current.onExploreSelect?.(id);});
        const hover = new maplibregl.Popup({closeButton:false,closeOnClick:true,offset:12});
        instance.on('mousemove',['explore-summits','explore-summit-names'],event=>{
          instance.getCanvas().style.cursor='pointer';const feature=event.features?.[0];
          if(feature?.geometry.type==='Point')hover.setLngLat(event.lngLat).setText(String(feature.properties.name)).addTo(instance);
        });
        instance.on('mouseleave',['explore-summits','explore-summit-names'],()=>{instance.getCanvas().style.cursor='';hover.remove();});
        instance.on('mouseenter','explore-clusters',()=>{instance.getCanvas().style.cursor='pointer';});
        instance.on('mouseleave','explore-clusters',()=>{instance.getCanvas().style.cursor='';});
      }

      instance.addSource('custom-area', {type:'geojson',data:empty});
      instance.addLayer({id:'custom-fill',type:'fill',source:'custom-area',filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':'#eed593','fill-opacity':.10}});
      instance.addLayer({id:'custom-outline',type:'line',source:'custom-area',filter:['!=',['geometry-type'],'Point'],paint:{'line-color':'#eed593','line-width':2,'line-dasharray':[3,2]}});
      instance.addLayer({id:'custom-vertices',type:'circle',source:'custom-area',filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':5,'circle-color':'#eed593','circle-stroke-color':'#203a34','circle-stroke-width':2}});
      instance.addSource('dem', terrainConfig.source);
      if (terrainConfig.enabled) instance.setTerrain({ source: 'dem', exaggeration });
      instance.addSource('summit-sections', {type:'geojson',data:empty});
      instance.addLayer({id:'section-fill',type:'fill',source:'summit-sections',paint:{'fill-color':'#d9e9a7','fill-opacity':0,'fill-opacity-transition':{duration:reduced()?0:1400,delay:reduced()?0:400}}});
      instance.addLayer({id:'section-outline',type:'line',source:'summit-sections',paint:{'line-color':'#e3efb8','line-width':1.6,'line-opacity':0,'line-opacity-transition':{duration:reduced()?0:1400,delay:reduced()?0:400}}});
      instance.addSource('connection', { type:'geojson', data:empty });
      instance.addLayer({ id:'connection-shadow', type:'line', source:'connection', paint:{'line-color':'#173c36','line-width':5,'line-opacity':.5} });
      instance.addLayer({ id:'connection', type:'line', source:'connection', paint:{'line-color':'#eaf4ba','line-width':2,'line-dasharray':[3,2]} });
      solarShadows.current = new SolarShadows(instance, element.current!, setShadowsEnabled);
      setReady(true);
    });
    instance.on('error', e => {
      const source = (e as unknown as {sourceId?: string}).sourceId;
      const text = String(e.error?.message ?? '');
      if (source) failedSources.current.add(source);
      if (source === 'dem') { instance.setTerrain(null); solarShadows.current?.setEnabled(false, exaggeration); setTerrainFailed(true); setTerrain(false); }
      if ((source && basemapSources(activeBasemap.current).includes(source)) || /WebGL/i.test(text)) setFailed(true);
    });
    const initialTimeout = window.setTimeout(() => {
      if (!basemapSources(activeBasemap.current).every(id => instance.isSourceLoaded(id))) setFailed(true);
    }, 18000);
    const observer = new ResizeObserver(() => instance.resize()); observer.observe(element.current!);
    return () => { clearTimeout(initialTimeout); solarShadows.current?.dispose(); solarShadows.current = null; instance.getCanvas().removeEventListener('pointerdown', onPointerDown); instance.getCanvas().removeEventListener('pointercancel', onPointerCancel); observer.disconnect(); guessMarker.current?.remove(); summitMarker.current?.remove(); guessMarker.current = null; summitMarker.current = null; instance.remove(); map.current = null; };
  }, [revision]);
  useEffect(() => {
    saveBasemap(basemap);
    if (!ready || !map.current) return;
    const instance = map.current;
    setFailed(basemapSources(basemap).some(id => failedSources.current.has(id))); setLoaded(false);
    instance.setLayoutProperty('satellite', 'visibility', basemap === 'satellite' ? 'visible' : 'none');
    for (const id of ['relief-background', 'relief-hillshade', 'oceans', 'hydrography']) {
      instance.setLayoutProperty(id, 'visibility', basemap === 'relief' ? 'visible' : 'none');
    }
    instance.setPaintProperty('section-outline', 'line-color', basemap === 'relief' ? '#466332' : '#e3efb8');
    const sources = basemapSources(basemap);
    const updateLoaded = () => setLoaded(sources.every(id => instance.isSourceLoaded(id)));
    instance.on('sourcedata', updateLoaded);
    updateLoaded();
    const timeout = window.setTimeout(() => {
      if (!sources.every(id => instance.isSourceLoaded(id))) setFailed(true);
    }, 18000);
    return () => { clearTimeout(timeout); instance.off('sourcedata', updateLoaded); };
  }, [basemap, ready]);
  useEffect(() => {
    if (ready) map.current?.getCanvas().setAttribute('aria-label', `AlpTap · ${labels[basemap]}`);
  }, [ready, basemap, props.locale]);
  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.setTerrain(terrain && !terrainFailed ? { source: 'dem', exaggeration } : null);
    solarShadows.current?.setEnabled(terrain && !terrainFailed, exaggeration, shadowPreference);
  }, [terrain, terrainFailed, ready, exaggeration, shadowPreference]);
  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.easeTo({ pitch: props.world ? 0 : terrain ? 35 : 0, duration: reduced() ? 0 : 650 });
  }, [terrain, terrainFailed, ready]);
  useEffect(() => {
    if (!ready || !map.current) return;
    showOverview(map.current, reduced() ? 0 : 950);
  // Worldwide rounds restart from the world overview; Alpine rounds retain exploration.
  }, [ready, props.bounds[0], props.bounds[1], props.bounds[2], props.bounds[3], props.world && !props.explorePeaks && !props.frameBounds && !props.onVertex ? props.roundKey : null]);
  useEffect(() => {
    if(!ready||!map.current)return;
    const ring=props.area??[], coordinates=unwrap(ring.length>=3?[...ring,ring[0]]:ring);
    const features:GeoJSON.Feature[]=[];
    if(ring.length>=3)features.push({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[coordinates]}});
    else if(ring.length===2)features.push({type:'Feature',properties:{},geometry:{type:'LineString',coordinates}});
    if(props.onVertex)for(const point of unwrap(ring))features.push({type:'Feature',properties:{},geometry:{type:'Point',coordinates:point}});
    (map.current.getSource('custom-area') as GeoJSONSource).setData({type:'FeatureCollection',features});
  },[ready,props.area,props.onVertex]);
  useEffect(() => {
    if (!ready || !map.current) return;
    (map.current.getSource('summit-sections') as GeoJSONSource).setData({type:'FeatureCollection',features:props.sections});
    map.current.setPaintProperty('section-fill','fill-opacity',props.sections.length ? (props.valley ? .25 : .12) : 0);
    map.current.setPaintProperty('section-outline','line-opacity',props.sections.length ? .8 : 0);
      if(props.valley&&props.sections.length){
      const coords=props.sections.flatMap(s=>s.geometry.type==='Polygon'?s.geometry.coordinates.flat():s.geometry.coordinates.flat(2));
      const xs=coords.map(p=>p[0]),ys=coords.map(p=>p[1]);
      map.current.fitBounds([Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],{padding:viewPadding(),maxZoom:10,duration:reduced()?0:1200});
    }
  },[props.sections,ready]);
  useEffect(() => {
    if (!ready || !map.current) return;
    guessMarker.current?.remove(); guessMarker.current = null;
    if (!props.pairs?.length && props.guess) guessMarker.current = new maplibregl.Marker({element:marker('guess-pin',t.yourGuess),anchor:'center'}).setLngLat([props.guess.lon,props.guess.lat]).addTo(map.current);
  }, [props.guess, ready, props.locale, props.pairs]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const instance = map.current;
    summitMarker.current?.remove(); summitMarker.current = null;
    const source = instance.getSource('connection') as GeoJSONSource;
    if (props.pairs?.length) return;
    source.setData(empty);
    if (!props.actual || !props.guess) return;
    const a = props.guess, b = props.actual;
    const summitTimer = window.setTimeout(() => {
      summitMarker.current = new maplibregl.Marker({ element:marker('summit-pin',t.summit), anchor:'center' }).setLngLat([b.lon,b.lat]).addTo(instance);
    }, reduced() ? 0 : 550);
    const cameraTimer = window.setTimeout(() => instance.fitBounds(revealBounds(a,b), { padding:viewPadding(), maxZoom:12, duration:reduced() ? 0 : 1700, pitch:terrain ? 35 : 0 }), reduced() ? 0 : 350);
    const coordinates=pairPath(a,b);
    let frame=0; const start=performance.now()+(reduced()?0:600);
    const draw=(time:number)=>{const progress=reduced()?1:Math.max(0,Math.min(1,(time-start)/1400));source.setData({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:continuousPath(coordinates).slice(0,Math.max(2,Math.ceil(progress*65)))}});if(progress<1)frame=requestAnimationFrame(draw);};
    frame=requestAnimationFrame(draw); return()=>{cancelAnimationFrame(frame);clearTimeout(summitTimer);clearTimeout(cameraTimer);};
  }, [props.actual, ready, props.roundKey, props.pairs]);
  useEffect(() => {
    if (!ready || !map.current || !props.pairs?.length) return;
    const instance = map.current;
    const pairs = props.pairs;
    pairMarkers.current = pairs.flatMap((pair,i) => [
      new maplibregl.Marker({element:marker('guess-pin',`${i+1}. ${pair.label}: ${t.yourGuess}`),anchor:'center'}).setLngLat([pair.guess.lon,pair.guess.lat]).addTo(instance),
      new maplibregl.Marker({element:marker('summit-pin',`${i+1}. ${pair.label}: ${t.summit}`),anchor:'center'}).setLngLat([pair.actual.lon,pair.actual.lat]).addTo(instance),
    ]);
    pairMarkers.current.forEach((pin,i)=>{const badge=document.createElement('b');badge.className='pair-number';badge.textContent=String(Math.floor(i/2)+1);pin.getElement().append(badge);});
    (instance.getSource('connection') as GeoJSONSource).setData({type:'FeatureCollection',features:pairs.map((pair,i)=>({type:'Feature',properties:{round:i+1},geometry:{type:'LineString',coordinates:continuousPath(pairPath(pair.guess,pair.actual))}}))});
    return()=>{pairMarkers.current.forEach(pin=>pin.remove());pairMarkers.current=[];};
  },[props.pairs,ready,props.locale]);
  useEffect(() => {
    if (!ready || !map.current || !props.pairs?.length) return;
    const selected=props.focusedPair==null?props.pairs:[props.pairs[props.focusedPair]].filter(Boolean);
    const points=selected.flatMap(pair=>[pair.guess,pair.actual]);
    const longs=points.map(p=>(p.lon+360)%360).sort((a,b)=>a-b);
    let gap=-1,start=longs[0];
    longs.forEach((lon,i)=>{const next=longs[(i+1)%longs.length]+(i===longs.length-1?360:0);if(next-lon>gap){gap=next-lon;start=next%360;}});
    const xs=longs.map(lon=>lon<start?lon+360:lon),ys=points.map(p=>p.lat);
    map.current.fitBounds([Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],{padding:viewPadding(),maxZoom:12,duration:reduced()?0:1000,pitch:terrain?35:0});
  },[props.pairs,props.focusedPair,ready]);
  useEffect(() => {
    if (!ready || !map.current || !props.explorePeaks) return;
    (map.current.getSource('explore-peaks') as GeoJSONSource).setData({type:'FeatureCollection',features:props.explorePeaks.map(peak=>({type:'Feature',geometry:{type:'Point',coordinates:[peak.position.lon,peak.position.lat]},properties:{id:peak.id,name:peak.name,difficulty:peak.difficulty}}))});
  },[ready,props.explorePeaks]);
  useEffect(() => {
    if (!ready || !map.current || !props.explorePoint) return;
    const point = props.explorePoint;
    const pin = new maplibregl.Marker({element:marker('summit-pin', t.summit), anchor:'center'}).setLngLat([point.lon,point.lat]).addTo(map.current);
    map.current.jumpTo({center:[point.lon,point.lat],zoom:Math.max(map.current.getZoom(),10),pitch:terrain?35:0});
    return () => {pin.remove();};
  }, [ready, props.explorePoint, props.locale]);
  return <div className={`map-wrap basemap-${basemap} ${props.world?'world-map':''}`}>
    <div className="map-canvas" ref={element} data-testid="map" data-basemap={basemap}/>
    <div className="map-vignette"/>
    {(!loaded || failed) && <div className={`map-status ${failed?'is-error':''}`} role="status">{basemap === 'relief' ? (failed ? labels.error : labels.loading) : (failed ? t.mapError : t.mapLoading)}{failed&&<button onClick={()=>setRevision(r=>r+1)}>{t.retryMap}</button>}</div>}
    {terrainFailed&&<div className="terrain-notice" role="status">{t.terrainError}</div>}
    <button ref={controlsToggle} className="map-controls-toggle" aria-label={controlLabels[props.locale]} title={controlLabels[props.locale]} aria-expanded={controlsOpen} aria-controls={controlsId} onClick={() => setControlsOpen(value => !value)}>
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 3v18M12 3v18M20 3v18"/><path d="M1 8h6M9 16h6M17 8h6" strokeWidth="4"/></svg>
    </button>
    <div id={controlsId} className={`map-controls-panel${controlsOpen ? ' is-open' : ''}`} onKeyDown={event => {
      if (event.key === 'Escape' && window.matchMedia('(max-width: 719px)').matches) {
        event.stopPropagation(); setControlsOpen(false); controlsToggle.current?.focus();
      }
    }}>
    <div className="map-tools"><button aria-label={t.zoomIn} title={t.zoomIn} onClick={()=>map.current?.zoomIn()}>+</button><button aria-label={t.zoomOut} title={t.zoomOut} onClick={()=>map.current?.zoomOut()}>−</button><button className="map-compass" title={t.north} aria-label={t.north} onClick={()=>map.current?.resetNorth({duration:reduced()?0:500})}>
      <svg viewBox="0 0 32 32" aria-hidden="true" style={{transform:`rotate(${-bearing}deg)`}}><text x="16" y="8" textAnchor="middle">N</text><path d="M16 10 10 24 16 21Z" fill="#b35c45"/><path d="M16 10 22 24 16 21Z" fill="currentColor"/></svg>
    </button><span/><button title={t.reset} aria-label={t.reset} onClick={()=>{if(map.current)showOverview(map.current,reduced()?0:800);}}>⌖</button></div>
    <label className="terrain-exaggeration" title={t.exaggeration}>
      <span aria-hidden="true">△</span>
      <input type="range" min="0" max="3" step="0.1" value={exaggeration} disabled={!terrain || terrainFailed} aria-label={t.exaggeration} aria-orientation="vertical" aria-valuetext={`${exaggeration.toFixed(1)}×`} onChange={event=>setExaggeration(Number(event.target.value))}/>
      <output>{exaggeration.toFixed(1)}×</output>
    </label>
    <div className="map-display-controls">
    <button className="basemap-switch" role="switch" aria-label={labels.relief} aria-checked={basemap === 'relief'} title={`${labels.satellite} / ${labels.relief}`} onClick={() => setBasemap(value => value === 'satellite' ? 'relief' : 'satellite')}>
      <span aria-hidden="true">🛰️</span><span aria-hidden="true">🏔️</span>
    </button>
    <button className={`terrain-toggle ${terrain?'active':''}`} aria-label={terrain?t.terrain:t.flat} disabled={terrainFailed} aria-pressed={terrain} onClick={()=>setTerrain(v=>!v)}>{terrain?'△':'▱'} <span>{terrain?t.terrain:t.flat}</span><i/></button>
    <button className={`terrain-toggle shadow-toggle ${shadowsEnabled?'active':''}`} aria-label={shadowLabels[props.locale]} title={shadowLabels[props.locale]} disabled={!terrain || terrainFailed || exaggeration === 0} aria-pressed={shadowsEnabled} onClick={()=>setShadowPreference(!shadowsEnabled)}>☀ <span>{shadowLabels[props.locale]}</span><i/></button>
    </div>
    </div>
    {(!props.locked||props.drawing)&&<button className="center-guess" onClick={()=>{ const canvas=map.current?.getCanvas(); const center=canvas&&map.current?.unproject([canvas.clientWidth/2,canvas.clientHeight*(window.innerWidth<720?.4:.5)]); if(center){const p={lon:center.wrap().lng,lat:center.lat};if(props.drawing)props.onVertex?.(p);else props.onGuess(p);} }}>{props.drawing?customMessages[props.locale].add:t.center}</button>}
    {(!props.locked||props.drawing)&&<div className="map-crosshair" aria-hidden="true">+</div>}
    {props.actual&&<div className="map-legend"><span><i className="legend-guess"/>{t.yourGuess}</span><span><i className="legend-summit"/>{t.summit}</span></div>}
  </div>;
}
