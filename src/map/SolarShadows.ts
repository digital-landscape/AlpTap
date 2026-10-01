import type { ImageSource, Map as LibreMap } from 'maplibre-gl';
import { terrainConfig } from './config';
import { solarPosition } from './solar';
import { SolarShadowRenderer } from './SolarShadowRenderer';
const layerId = 'solar-shadows', sourceId = 'solar-shadow-mask', gridSize = 256;
const circumference = 40075016.686;
const tileY = (lat: number, n: number) => (1 - Math.asinh(Math.tan(Math.max(-85.0511,Math.min(85.0511,lat))*Math.PI/180))/Math.PI)/2*n;
const latitude = (y: number, n: number) => Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI;
interface Scene { key: string; heights: Float32Array; extent: [number,number]; coordinates: [[number,number],[number,number],[number,number],[number,number]]; latitude: number; longitude: number }
/** Owns offscreen GPU resources and a terrain-draped raster shadow mask. */
export class SolarShadows {
  private renderer?: SolarShadowRenderer;
  private mask?: ImageBitmap;
  private scene?: Scene;
  private enabled = false;
  private preference: boolean | null = null;
  private exaggeration = 1.5;
  private stopped = false;
  private request?: AbortController;
  private generation = 0;
  private cache = new Map<string, ImageBitmap>();
  private timer: number;
  private status(value: string) { this.element.dataset.solarStatus=value; }
  constructor(private map: LibreMap, private element: HTMLElement, private onChoice: (enabled: boolean) => void) {
    this.map.on('moveend', this.update);
    document.addEventListener('visibilitychange',this.visibility);
    this.timer=window.setInterval(this.update,60000);
  }
  private visibility=()=>{if(!document.hidden)this.update();};
  setEnabled(enabled: boolean, exaggeration: number, preference: boolean | null = null) {
    this.preference=preference;
    this.enabled=enabled && exaggeration>0;this.exaggeration=exaggeration;
    if(!this.enabled){this.generation++;this.request?.abort();this.hide();this.status('disabled');}
    else this.update();
  }
  private hide() { if(this.map.getLayer(layerId))this.map.setLayoutProperty(layerId,'visibility','none'); }
  private async tile(z: number,x: number,y: number,signal: AbortSignal) {
    const n=2**z, key=`${z}/${((x%n)+n)%n}/${Math.max(0,Math.min(n-1,y))}`;
    const cached=this.cache.get(key);if(cached)return cached;
    const [tz,tx,ty]=key.split('/');const template=terrainConfig.source.tiles[0];
    const response=await fetch(template.replace('{z}',tz).replace('{x}',tx).replace('{y}',ty),{signal});
    if(!response.ok)throw new Error(`Shadow DEM HTTP ${response.status}`);
    const bitmap=await createImageBitmap(await response.blob());
    if(signal.aborted||this.stopped){bitmap.close();throw new DOMException('Cancelled','AbortError');}
    this.cache.set(key,bitmap);return bitmap;
  }
  private descriptor() {
    const bounds=this.map.getBounds();let z=Math.min(11,terrainConfig.source.maxzoom,Math.floor(this.map.getZoom()));
    if(z<3||bounds.getNorth()-bounds.getSouth()>65)return null;
    let left=0,top=0,count=0;
    while(z>=2){const n=2**z;
      const west=(bounds.getWest()+180)/360*n,east=(bounds.getEast()+180)/360*n;
      const north=tileY(bounds.getNorth(),n),south=tileY(bounds.getSouth(),n);
      const width=Math.ceil(east)-Math.floor(west),height=Math.ceil(south)-Math.floor(north);
      if(Math.max(width,height)<=3){count=Math.max(1,width,height)+2;left=Math.floor(west)-1;top=Math.floor(north)-1;break;}z--;
    }
    if(!count)return null;
    const n=2**z,lat=latitude(top+count/2,n),lon=(left+count/2)/n*360-180;
    const groundSpan=circumference*Math.cos(lat*Math.PI/180)*count/n;
    const coordinates: [[number,number],[number,number],[number,number],[number,number]]=[[left/n*360-180,latitude(top,n)],[(left+count)/n*360-180,latitude(top,n)],[(left+count)/n*360-180,latitude(top+count,n)],[left/n*360-180,latitude(top+count,n)]];
    return {z,left,top,count,key:`${z}/${left}/${top}/${count}`,extent:[groundSpan,groundSpan] as [number,number],coordinates,latitude:lat,longitude:lon};
  }
  private update=async()=>{
    if(this.stopped||document.hidden)return;
    const center=this.map.getCenter();
    const choice=this.preference ?? (solarPosition(center.lat,center.lng,Date.now()).altitude>0);
    this.onChoice(choice);
    if(!this.enabled||!choice){this.generation++;this.request?.abort();this.hide();this.status('disabled');return;}
    if(this.map.isMoving())return;
    const descriptor=this.descriptor();if(!descriptor){this.hide();this.status('overview');return;}
    const generation=++this.generation;this.request?.abort();const controller=new AbortController();this.request=controller;
    try {
      if(!this.renderer)this.renderer=new SolarShadowRenderer();
      if(this.scene?.key!==descriptor.key){
        this.hide();this.status('loading');
        const atlas=document.createElement('canvas');atlas.width=atlas.height=descriptor.count*256;
        const context=atlas.getContext('2d',{willReadFrequently:true})!;context.imageSmoothingEnabled=false;
        const jobs=Array.from({length:descriptor.count**2},(_,i)=>({x:i%descriptor.count,y:Math.floor(i/descriptor.count)}));
        let next=0;
        await Promise.all(Array.from({length:4},async()=>{while(next<jobs.length){const {x,y}=jobs[next++];const bitmap=await this.tile(descriptor.z,descriptor.left+x,descriptor.top+y,controller.signal);context.drawImage(bitmap,x*256,y*256,256,256);}}));
        const sample=document.createElement('canvas');sample.width=sample.height=gridSize;
        const ctx=sample.getContext('2d',{willReadFrequently:true})!;ctx.imageSmoothingEnabled=false;ctx.drawImage(atlas,0,0,gridSize,gridSize);
        const pixels=ctx.getImageData(0,0,gridSize,gridSize).data,heights=new Float32Array(gridSize**2);
        for(let i=0;i<heights.length;i++){const r=pixels[i*4],g=pixels[i*4+1],b=pixels[i*4+2];heights[i]=terrainConfig.source.encoding==='mapbox'?-10000+(r*65536+g*256+b)*.1:r*256+g+b/256-32768;}
        if(generation!==this.generation||this.stopped)return;
        this.scene={...descriptor,heights};
        // Keep tile memory bounded; the current scene no longer needs bitmaps.
        while(this.cache.size>64){const key=this.cache.keys().next().value!;this.cache.get(key)!.close();this.cache.delete(key);}
      }
      if(generation!==this.generation||this.stopped)return;
      const scene=this.scene!,now=Date.now(),sun=solarPosition(scene.latitude,scene.longitude,now);
      const canvas=this.renderer.render(scene.heights,gridSize,scene.extent,sun.direction,this.exaggeration);
      const image=await createImageBitmap(canvas);
      if(generation!==this.generation||this.stopped){image.close();return;}
      const source=this.map.getSource(sourceId) as ImageSource | undefined;
      if(source)source.updateImage({image,coordinates:scene.coordinates});
      else{this.map.addSource(sourceId,{type:'image',coordinates:scene.coordinates});(this.map.getSource(sourceId) as ImageSource).updateImage({image});this.map.addLayer({id:layerId,type:'raster',source:sourceId,paint:{'raster-fade-duration':0}},'section-fill');}
      this.mask?.close();this.mask=image;
      this.map.setLayoutProperty(layerId,'visibility','visible');this.status('ready');
      this.element.dataset.solarTime=new Date(now).toISOString();this.element.dataset.solarAltitude=sun.altitude.toFixed(2);this.element.dataset.solarAzimuth=sun.azimuth.toFixed(2);
    } catch(error) {
      controller.abort();
      if(generation!==this.generation||this.stopped)return;
      this.hide();this.status('unavailable');this.renderer?.dispose();this.renderer=undefined;
      console.warn('Solar shadows unavailable; satellite map remains usable.',error);
    }
  };
  dispose(){this.stopped=true;this.generation++;this.request?.abort();clearInterval(this.timer);document.removeEventListener('visibilitychange',this.visibility);this.map.off('moveend',this.update);this.renderer?.dispose();this.mask?.close();for(const bitmap of this.cache.values())bitmap.close();this.cache.clear();}
}
