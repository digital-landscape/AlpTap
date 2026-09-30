"""Reproducible, cached SOIUSA/OSM preparation. Run through npm run data:peaks."""
from __future__ import annotations
import argparse, csv, collections, datetime as dt, hashlib, html, json, math, os, re, subprocess, time
from pathlib import Path
import xml.etree.ElementTree as ET
import numpy as np
from scipy.spatial import cKDTree
from shapely import make_valid, prepare
from shapely.geometry import Polygon, MultiPolygon, Point, shape, mapping
from shapely.ops import unary_union
from classification import RULES, classify_peak

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache/data'
OUT = ROOT / 'data/processed'
PUBLIC = ROOT / 'public/data'
NS = {'k': 'http://www.opengis.net/kml/2.2'}
COUNTRIES = {'AT':16239,'FR':2202162,'IT':365331,'CH':51701,'DE':51477,'SI':218657,'LI':1155955}
WEIGHTS = RULES['weights']
SOURCE = 'https://www.homoalpinus.com/alpes/subdivisions/soiusa/'
AREA_NAMES = ROOT / 'data/config/area-names.json'

def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix+'.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, separators=(',',':'))+'\n')
    tmp.replace(path)

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def now(): return dt.datetime.now(dt.timezone.utc).isoformat()

def download(path, url, *, data=None, offline=False):
    if path.exists(): return json.loads(path.read_text())
    if offline: raise RuntimeError(f'Missing cache: {path}; run without --offline first')
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.download')
    cmd = ['curl','--fail','--location','--silent','--show-error','--max-time','240','--retry','2','--retry-all-errors','--retry-delay','5','--user-agent','AlpTap-data-prototype/0.1','--output',str(temp)]
    if data is not None: cmd += ['--data-urlencode', 'data='+data]
    cmd += [url]
    subprocess.run(cmd, check=True)
    value = json.loads(temp.read_text())
    if isinstance(value,dict) and value.get('remark'): raise RuntimeError(value['remark'])
    temp.replace(path)
    write(path.with_suffix('.source.json'), {'url':url,'downloadedAt':now(),'sha256':digest(path)})
    return value

def import_sections():
    root = ET.parse(ROOT/'SIOUSA/SOIUSA 36 SECTIONS.kml')
    grouped = collections.defaultdict(list); meta = {}; issues=[]
    for index,p in enumerate(root.findall('.//k:Placemark',NS)):
        description = p.findtext('k:description',default='',namespaces=NS)
        fields = dict(re.findall(r'(?:^|<br>)\s*([^=<>]+?)\s*=\s*([^<]*)',description))
        fields = {k.strip():html.unescape(v).strip() for k,v in fields.items()}
        code = fields.get('Code') or 'aux:klagenfurt-basin'
        polygons=[]
        for poly in p.findall('.//k:Polygon',NS):
            def ring(where):
                return [(float(c.split(',')[0]),float(c.split(',')[1])) for c in poly.findtext(where,namespaces=NS).split()]
            outer=ring('k:outerBoundaryIs/k:LinearRing/k:coordinates')
            holes=[]
            for inner in poly.findall('k:innerBoundaryIs/k:LinearRing/k:coordinates',NS):
                holes.append([(float(c.split(',')[0]),float(c.split(',')[1])) for c in inner.text.split()])
            geom=Polygon(outer,holes)
            if not geom.is_valid:
                issues.append({'type':'geometry-repaired','id':code,'feature':index})
                geom=make_valid(geom)
            polygons.append(geom)
        grouped[code].extend(polygons)
        if code not in meta:
            meta[code]={'id':code,'parentId':('western-alps' if int(code.split('.')[1])<=14 else 'eastern-alps') if code.startswith('SZ.') else None,'level':'section' if code.startswith('SZ.') else 'auxiliary','name':fields['Name'],'names':{},'provenance':{'source':SOURCE,'creator':fields.get('Created_By'),'kind':'supplied'},'sourceFeatures':[],'geometryRef':f'sections.geojson#{code}'}
        meta[code]['sourceFeatures'].append({'index':index,'fields':fields})
    catalogue=json.loads(AREA_NAMES.read_text())
    for code,unit in meta.items():
        entry=catalogue['records'][code]
        if entry['original']!=unit['name']:raise ValueError(f'Area name changed for {code}; review static translations')
        unit['names']=entry['names']
        unit['provenance']['names']={'version':catalogue['version'],'source':entry['source'],'method':entry['method']}
    geoms={code:unary_union(parts) for code,parts in grouped.items()}
    assert len([k for k in geoms if k.startswith('SZ.')])==36
    units=[]
    for id_,label,names in [('alps','Alps',{'en':'All Alps','de':'Gesamte Alpen','fr':'Toutes les Alpes','it':'Tutte le Alpi'}),('western-alps','Western Alps',{'en':'Western Alps','de':'Westalpen','fr':'Alpes occidentales','it':'Alpi Occidentali'}),('eastern-alps','Eastern Alps',{'en':'Eastern Alps','de':'Ostalpen','fr':'Alpes orientales','it':'Alpi Orientali'})]:
        children=[g for code,g in geoms.items() if code.startswith('SZ.') and (id_=='alps' or meta[code]['parentId']==id_)]
        union=unary_union(children)
        units.append({'id':id_,'parentId':None if id_=='alps' else 'alps','level':'system' if id_=='alps' else 'major-part','name':label,'names':names,'bounds':list(union.bounds),'geometryRef':f'regions.geojson#{id_}','provenance':{'source':SOURCE,'kind':'derived-parent-mapping'}})
    for unit in units:
        entry=catalogue['records'][unit['id']]
        unit['names']=entry['names']
        unit['provenance']['names']={'version':catalogue['version'],'source':entry['source'],'method':entry['method']}
    write(OUT/'sections.geojson',{'type':'FeatureCollection','features':[{'type':'Feature','properties':meta[k],'geometry':mapping(g)} for k,g in geoms.items()]})
    write(OUT/'regions.geojson',{'type':'FeatureCollection','features':[{'type':'Feature','properties':u,'geometry':mapping(unary_union([g for k,g in geoms.items() if k.startswith('SZ.') and (u['id']=='alps' or meta[k]['parentId']==u['id'])]))} for u in units]})
    return geoms,units+list(meta.values()),issues

def countries_for(point, boundaries, expanded=None):
    # covers preserves exact shared boundaries. A 100 m uncertainty corridor is
    # reported separately, not silently promoted to confirmed country membership.
    confirmed=sorted(k for k,g in boundaries.items() if g.covers(point))
    near=sorted(k for k,g in boundaries.items() if k not in confirmed and (expanded[k].covers(point) if expanded is not None else g.distance(point)<.0013))
    return confirmed,near

def numeric(value):
    if value is None: return None
    try:
        n=float(str(value).strip().replace(',','.').removesuffix(' m'))
        return n if math.isfinite(n) else None
    except ValueError: return None

def difficulty(features):
    components={}
    for key,weight in WEIGHTS.items():
        v=features.get(key)
        if v is not None:
            components[key]=1-v if key in ('notoriety','prominence','isolation','elevation') else v
    total=sum(WEIGHTS[k] for k in components)
    return round(100*sum(WEIGHTS[k]*v for k,v in components.items())/total,3) if total else 50

def enrich(ids, offline, skip):
    result={}
    # Cached entity batches are reused even when the remote service is unavailable.
    for cached in sorted((CACHE/'wikidata').glob('*.json')):
        if not cached.name.endswith('.source.json'):
            result.update(json.loads(cached.read_text()).get('entities',{}))
    if skip: return result
    missing=[id_ for id_ in ids if id_ not in result]
    for start in range(0,len(missing),50):
        batch=missing[start:start+50]; key=hashlib.sha256('|'.join(batch).encode()).hexdigest()[:16]
        url='https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels%7Csitelinks%7Cclaims&languages=en%7Cde%7Cfr%7Cit&ids='+'%7C'.join(batch)
        try:
            if not offline: time.sleep(1)
            response=download(CACHE/f'wikidata/{key}.json',url,offline=offline)
            if 'error' in response: raise RuntimeError(str(response['error']))
            result.update(response.get('entities',{}))
            if start % 500 == 0: print(f'Wikidata: {len(result)} cached entities',flush=True)
        except Exception as e:
            print(f'Wikidata enrichment paused; preserving {len(result)} cached entities. {e}',flush=True)
            break
    return result

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--offline',action='store_true'); parser.add_argument('--skip-wikidata',action='store_true'); parser.add_argument('--geography-only',action='store_true'); args=parser.parse_args()
    geoms,units,issues=import_sections()
    if args.geography_only:
        write(OUT/'hierarchy.json',units); print('Imported 36 sections, 3 derived parents, 1 auxiliary feature'); return
    raw={}
    endpoint=os.getenv('OVERPASS_URL','https://overpass-api.de/api/interpreter')
    # Six bounded stripes; successful responses survive interruptions and reruns.
    for west,east in [(4,6),(6,8),(8,10),(10,12),(12,14),(14,17)]:
        print(f'OSM peaks: {west}–{east}° E',flush=True)
        query=f'[out:json][timeout:180];nwr["natural"="peak"](43,{west},49,{east});out body center;'
        data=download(CACHE/f'osm/peaks-{west}-{east}.json',endpoint,data=query,offline=args.offline)
        for e in data['elements']: raw[f"osm:{e['type']}/{e['id']}"]=e
    boundaries={}
    for country,id_ in COUNTRIES.items():
        print('Country boundary:',country,flush=True)
        data=download(CACHE/f'countries/{country}.json',f'https://polygons.openstreetmap.fr/get_geojson.py?id={id_}&params=0',offline=args.offline)
        if data['type']=='FeatureCollection': geometry=unary_union([shape(f['geometry']) for f in data['features']])
        elif data['type']=='Feature': geometry=shape(data['geometry'])
        else: geometry=shape(data)
        boundaries[country]=make_valid(geometry)
    expanded={k:g.buffer(.0013) for k,g in boundaries.items()}
    for g in [*boundaries.values(),*expanded.values(),*geoms.values()]: prepare(g)
    sections={k:v for k,v in geoms.items() if k.startswith('SZ.')}
    peaks=[]; seen={}
    for id_,e in sorted(raw.items()):
        tags=e.get('tags',{})
        if e['type']!='node':
            issues.append({'id':id_,'type':'non-point-peak-excluded','reason':'Way/relation center is not a surveyed summit'}); continue
        lon,lat=e.get('lon'),e.get('lat')
        if lon is None or lat is None or not(-180<=lon<=180 and -90<=lat<=90): issues.append({'id':id_,'type':'invalid-coordinate'}); continue
        p=Point(lon,lat); assigned=[k for k,g in sections.items() if g.covers(p)]
        if not assigned:
            issues.append({'id':id_,'type':'uncoded-basin' if geoms['aux:klagenfurt-basin'].covers(p) else 'outside-domain'}); continue
        names={k[5:]:v.strip() for k,v in tags.items() if k.startswith('name:') and isinstance(v,str) and v.strip()}
        name=tags.get('name','').strip() or next(iter(names.values()),'')
        if not name: issues.append({'id':id_,'type':'unnamed-excluded'}); continue
        duplicate=(round(lat,6),round(lon,6),name.casefold())
        if duplicate in seen: issues.append({'id':id_,'type':'duplicate','retained':seen[duplicate]}); continue
        seen[duplicate]=id_
        elevation=numeric(tags.get('ele'))
        if elevation is not None and not 0<elevation<5000:
            issues.append({'id':id_,'type':'suspicious-elevation','value':tags.get('ele')}); elevation=None
        elif tags.get('ele') and elevation is None: issues.append({'id':id_,'type':'unparsed-elevation','value':tags['ele']})
        countries,near=countries_for(p,boundaries,expanded)
        recorded=tags.get('addr:country','').upper().split(';')
        countries=sorted(set(countries+[c for c in recorded if c in COUNTRIES]))
        if near or not countries: issues.append({'id':id_,'type':'country-review','countries':countries,'nearby':near})
        if len(assigned)>1: issues.append({'id':id_,'type':'multiple-sections','sections':assigned})
        regionIds=['alps']+sorted(set('western-alps' if int(k[3:])<=14 else 'eastern-alps' for k in assigned))
        aliases=sorted(set(s.strip() for key,v in tags.items() if key=='alt_name' or key.startswith('alt_name:') for s in v.split(';') if s.strip()))
        prominence=numeric(tags.get('ele:prominence',tags.get('prominence')))
        if prominence is not None and not 0<=prominence<=5000: issues.append({'id':id_,'type':'suspicious-prominence'}); prominence=None
        peaks.append({'id':id_,'lat':lat,'lon':lon,'elevation':elevation,'name':name,'names':names,'aliases':aliases,'wikidata':tags.get('wikidata'),'countries':countries,'countryCandidates':near,'soiusa':{'sectionIds':assigned,'regionIds':regionIds},'prominence':prominence,'isolation':None,'provenance':{'source':'OpenStreetMap','id':id_,'countrySource':'OSM administrative boundaries; addr:country where supplied','prominenceSource':'OSM tag' if prominence is not None else None},'_wikipedia':bool(tags.get('wikipedia'))})
    ids=sorted(set(p['wikidata'] for p in peaks if p['wikidata'] and re.fullmatch(r'Q\d+',p['wikidata'])))
    print(f'Enriching {len(peaks)} Alpine peaks, {len(ids)} Wikidata entities',flush=True)
    entities=enrich(ids,args.offline,args.skip_wikidata)
    for p in peaks:
        entity=entities.get(p['wikidata'],{})
        for lang,label in entity.get('labels',{}).items():
            if lang not in p['names'] and label.get('value'): p['names'][lang]=label['value']
        # Wikidata country claims can represent multiple border memberships.
        country_q={'Q40':'AT','Q142':'FR','Q38':'IT','Q39':'CH','Q183':'DE','Q215':'SI','Q347':'LI'}
        for claim in entity.get('claims',{}).get('P17',[]):
            if claim.get('rank') == 'deprecated': continue
            q=claim.get('mainsnak',{}).get('datavalue',{}).get('value',{}).get('id')
            if q in country_q and country_q[q] not in p['countries']: p['countries'].append(country_q[q])
        p['countries'].sort(); p['countryCandidates']=[c for c in p['countryCandidates'] if c not in p['countries']]
        if entity:
            p['provenance']['wikidata']=p['wikidata']
            p['provenance']['countrySource']+='; Wikidata P17 where supplied'
        p['_notoriety']=min(1,math.log1p(len(entity.get('sitelinks',{}))+(3 if p['_wikipedia'] else 0)+(1 if p['wikidata'] else 0))/math.log(61))
    publish(peaks,geoms,units,issues,{'source':'OSM + available Wikidata','requestedEntities':len(ids),'cachedEntities':sum(id_ in entities for id_ in ids),'complete':all(id_ in entities for id_ in ids)})

def publish(peaks,geoms,units,issues,enrichment,primary='OpenStreetMap'):
    sections={k:v for k,v in geoms.items() if k.startswith('SZ.')}
    coords=np.array([[math.cos(math.radians(p['lat']))*math.cos(math.radians(p['lon'])),math.cos(math.radians(p['lat']))*math.sin(math.radians(p['lon'])),math.sin(math.radians(p['lat']))] for p in peaks])
    tree=cKDTree(coords); neighbours=tree.query_ball_point(coords,2*math.sin(10/6371.0088/2))
    for p,near in zip(peaks,neighbours):
        density=len(near)-1
        similar=sum(1 for j in near if peaks[j]['id']!=p['id'] and p['elevation'] is not None and peaks[j]['elevation'] is not None and abs(p['elevation']-peaks[j]['elevation'])<=200)
        features={'notoriety':p.pop('_notoriety'),'prominence':min(1,p['prominence']/1500) if p['prominence'] is not None else None,'isolation':min(1,p['isolation']/100) if p['isolation'] is not None else None,'density':min(1,math.log1p(density)/math.log(301)),'similarDensity':min(1,math.log1p(similar)/math.log(101)) if p['elevation'] is not None else None,'elevation':min(1,p['elevation']/4809) if p['elevation'] is not None else None}
        p.pop('_wikipedia'); p['metrics']={'nearby10km':density,'similarElevation10km':similar if p['elevation'] is not None else None}
        p['difficulty']={'score':difficulty(features),'level':'medium','version':RULES['version'] if primary=='Wikidata' else 'identification-v1','features':features}
    ranked=sorted(peaks,key=lambda p:(p['difficulty']['score'],p['id']))
    for i,p in enumerate(ranked):
        if primary=='Wikidata':
            level,reasons=classify_peak(p)
            p['difficulty'].update({'level':level,'reasons':reasons,'wikipediaEditions':len(p.get('wikipedia',{}))})
        else:p['difficulty']['level']='easy' if i<len(ranked)/3 else 'medium' if i<2*len(ranked)/3 else 'hard'
    overrides=json.loads((ROOT/'data/config/overrides.json').read_text())
    byid={p['id']:p for p in peaks}
    for override in overrides:
        if not override.get('source') or not override.get('reason'): raise ValueError('Overrides require source and reason')
        p=byid[override['id']]
        for field in ('countries','difficulty'):
            if field in override: p[field]=override[field] if field!='difficulty' else {**p[field],**override[field],'override':override['reason']}
        p['provenance']['override']=override
    ranked=sorted(peaks,key=lambda p:(['easy','medium','hard'].index(p['difficulty']['level']),-len(p.get('wikipedia',{})),p['difficulty']['score'],p['id']))
    for rank,p in enumerate(ranked,1):p['difficulty']['rank']=rank
    with (OUT/'difficulty-ranking.csv').open('w',newline='') as file:
        writer=csv.writer(file)
        writer.writerow(['rank','difficulty','name','id','identification_score','wikipedia_editions','prominence_m','isolation_km','reasons'])
        for p in ranked:writer.writerow([p['difficulty']['rank'],p['difficulty']['level'],p['name'],p['id'],p['difficulty']['score'],len(p.get('wikipedia',{})),p['prominence'],p['isolation'],'; '.join(p['difficulty'].get('reasons',[]))])
    counts={r:{d:sum(r in p['soiusa']['regionIds'] and p['difficulty']['level']==d for p in peaks) for d in ['easy','medium','hard']} for r in ['alps','western-alps','eastern-alps']}
    for r,ds in counts.items():
        for d,n in ds.items():
            if n<6: raise ValueError(f'Insufficient pool {r}/{d}: {n}; need at least 6')
    for p in peaks:
        assert p['id'] and p['name'] and all(isinstance(s,str) and s.strip() for s in p['names'].values())
        assert p['soiusa']['sectionIds'] and p['difficulty']['level'] in ('easy','medium','hard')
    content=json.dumps(peaks,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
    version='alps-'+hashlib.sha256(content+(ROOT/'SIOUSA/SOIUSA 36 SECTIONS.kml').read_bytes()+AREA_NAMES.read_bytes()).hexdigest()[:12]
    destination=PUBLIC/version
    source_files=[{'file':str(p.relative_to(ROOT)),'sha256':digest(p),'downloadedAt':json.loads(p.with_suffix('.source.json').read_text()).get('downloadedAt') if p.with_suffix('.source.json').exists() else None,'sourceTimestamp':json.loads(p.read_text()).get('osm3s',{}).get('timestamp_osm_base')} for p in sorted(CACHE.rglob('*.json')) if not p.name.endswith('.source.json') and (primary!='Wikidata' or (p.parent.name=='wikidata-primary' and p.name.startswith('query-')))]
    public_units=[{k:v for k,v in u.items() if k!='sourceFeatures'} for u in units]
    manifest={'version':version,'generatedAt':now(),'schemaVersion':1,'enrichment':enrichment,'units':public_units,'counts':counts,'peakCount':len(peaks),'shards':64,'attribution':{'peaks':'Wikidata (CC0)' if primary=='Wikidata' else '© OpenStreetMap contributors (ODbL 1.0)','names':'Wikidata (CC0)' if primary=='Wikidata' else 'Wikidata (CC0) where enriched','boundaries':'SOIUSA / Capleymar — supplied boundary license not specified'},'sourceFiles':source_files}
    shards=collections.defaultdict(dict)
    for p in peaks:
        # ID numeric portion modulo 64 is language-independent and cheap in browser.
        bucket=int(re.search(r'\d+$',p['id']).group())%64
        shards[bucket][p['id']]={k:v for k,v in p.items() if k not in ('metrics',)}
        shards[bucket][p['id']]['difficulty']={k:v for k,v in p['difficulty'].items() if k!='features'}
    for bucket,records in shards.items(): write(destination/f'peaks-{bucket:02d}.json',records)
    for code,geometry in sections.items():
        write(destination/'sections'/f'{code}.json',{'type':'Feature','properties':{'id':code,'name':next(u['name'] for u in units if u['id']==code)},'geometry':mapping(geometry)})
    write(destination/'manifest.json',manifest)
    write(OUT/'peaks.json',peaks)
    write(OUT/'hierarchy.json',units)
    write(OUT/'api-index.json',{'version':version,'peaks':[{'id':p['id'],'regionIds':p['soiusa']['regionIds'],'difficulty':p['difficulty']['level']} for p in peaks]})
    write(OUT/'report.json',{'version':version,'counts':counts,'issues':issues,'countries':dict(collections.Counter(c for p in peaks for c in p['countries'])),'missingElevation':sum(p['elevation'] is None for p in peaks),'missingLocalizedNames':{lang:sum(lang not in p['names'] for p in peaks) for lang in ['en','de','fr','it']},'difficultyWeights':WEIGHTS,'classificationRules':RULES if primary=='Wikidata' else None,'difficultyBands':{level:[min(p['difficulty']['score'] for p in peaks if p['difficulty']['level']==level),max(p['difficulty']['score'] for p in peaks if p['difficulty']['level']==level)] for level in ['easy','medium','hard']},'representativePeaks':[{'id':p['id'],'name':p['name'],'difficulty':p['difficulty']} for p in ranked[::max(1,len(ranked)//15)]]})
    # Publish pointer last, after all shards and indexes exist.
    write(PUBLIC/'manifest.json',manifest)
    print(json.dumps({'version':version,'peaks':len(peaks),'counts':counts,'issues':len(issues)},indent=2))

if __name__=='__main__': main()
