"""Reproducible mode catalogues. Only reviewed identities and original polygons are published."""
import argparse,hashlib,json,math,time,urllib.request,urllib.parse,zipfile
from pathlib import Path
import shapefile
from pyproj import CRS,Transformer
from shapely.geometry import shape,mapping,Point
from shapely.ops import transform
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'.cache/modes'
CONFIG=ROOT/'data/config'
PUBLIC=ROOT/'public/data'
OUT=ROOT/'data/processed'
GMBA_URL='https://data.earthenv.org/mountains/standard/GMBA_Inventory_v2.0_standard_300.zip'

def fetch(url,path,offline=False):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    if not path.exists():
        if offline:raise RuntimeError('Missing cached source: '+str(path))
        last=None
        for attempt in range(3):
            try:
                data=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'AlpTap/0.2 educational geography catalogue'}),timeout=90).read()
                temporary=path.with_suffix(path.suffix+'.download');temporary.write_bytes(data);temporary.replace(path);break
            except Exception as e:last=e;time.sleep(2**attempt)
        else:raise last
    return path.read_bytes()

def entities(titles,site='enwiki',offline=False):
    values={}
    for i in range(0,len(titles),20):
        batch=titles[i:i+20];query={'action':'wbgetentities','sites':site,'titles':'|'.join(batch),'props':'labels|claims|sitelinks/urls','format':'json','redirects':'yes'}
        url='https://www.wikidata.org/w/api.php?'+urllib.parse.urlencode(query)
        key=hashlib.sha256(url.encode()).hexdigest()[:20]
        data=json.loads(fetch(url,CACHE/'wikidata'/f'{key}.json',offline))
        if 'entities' not in data:raise ValueError(data)
        values.update({k:v for k,v in data['entities'].items() if not k.startswith('-')})
        if not offline:time.sleep(.2)
    return values

def coordinates(entity):
    rows=[c for c in entity.get('claims',{}).get('P625',[]) if c.get('rank')!='deprecated' and c.get('mainsnak',{}).get('snaktype')=='value']
    preferred=[c for c in rows if c.get('rank')=='preferred'];rows=preferred or rows
    points=set()
    for c in rows:
        v=c['mainsnak']['datavalue']['value']
        if v.get('globe')!='http://www.wikidata.org/entity/Q2':continue
        points.add((v['longitude'],v['latitude']))
    if len(points)!=1:return None
    lon,lat=next(iter(points));return {'lon':lon,'lat':lat} if math.isfinite(lon) and math.isfinite(lat) and abs(lon)<=180 and abs(lat)<=85 else None

def articles(entity):
    return {k[:-4]:v['url'] for k,v in entity.get('sitelinks',{}).items() if k.endswith('wiki') and '.wikipedia.org/wiki/' in v.get('url','')}

def read_shapes(path,encoding='utf-8'):
    path=Path(path);reader=shapefile.Reader(str(path),encoding=encoding)
    crs=CRS.from_wkt(path.with_suffix('.prj').read_text());project=Transformer.from_crs(crs,4326,always_xy=True).transform
    for item in reader.iterShapeRecords():
        geom=transform(project,shape(item.shape.__geo_interface__))
        yield item.record.as_dict(),geom

def unpack(name,url,offline):
    path=CACHE/(name+'.zip');fetch(url,path,offline);folder=CACHE/name
    if not folder.exists():
        with zipfile.ZipFile(path) as z:
            for member in z.namelist():
                if not (folder/member).resolve().is_relative_to(folder.resolve()):raise ValueError('Unsafe archive path')
            z.extractall(folder)
    return folder

def feature(id_,name,geom):return {'type':'Feature','properties':{'id':id_,'name':name},'geometry':mapping(geom)}
def write(path,value):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n')
def valid_geometry(g):return g.geom_type in ['Polygon','MultiPolygon'] and g.is_valid and not g.is_empty

def publish(mode,targets,regions,geometries,attribution,report):
    targets.sort(key=lambda t:t['id']);regions.sort(key=lambda r:r['id'])
    counts={tier:sum(t['difficulty']==tier for t in targets) for tier in ['easy','medium','hard']}
    countries=sorted({c for t in targets for c in t['countries']})
    ready=all(n>=6 for n in counts.values()) and (mode!='alpine-valleys' or all(c in countries for c in ['FR','AT','IT','CH']))
    report.update(mode=mode,counts=counts,countries=countries,ready=ready,included=[{'id':t['id'],'name':t['name'],'difficulty':t['difficulty']} for t in targets])
    write(OUT/(mode+'-report.json'),report)
    index_path=OUT/'mode-index.json';indexes=json.loads(index_path.read_text()) if index_path.exists() else [];indexes=[i for i in indexes if i['mode']!=mode]
    if not ready:
        write(index_path,indexes);print(mode,'NOT RELEASED',counts,countries);return
    payload={'schemaVersion':2,'mode':mode,'targets':targets,'regions':regions,'bounds':[-180,-75,180,80] if mode=='world-peaks' else [4,43,17,49],'attribution':attribution}
    version='mode-'+hashlib.sha256(json.dumps([payload,geometries],sort_keys=True).encode()).hexdigest()[:12]
    payload['version']=version;folder=PUBLIC/version
    for name,value in geometries.items():write(folder/name,value)
    write(folder/'report.json',report);write(folder/'manifest.json',payload)
    indexes.append({'version':version,'mode':mode,'validated':True,'targets':[{k:t[k] for k in ['id','difficulty','countries']} for t in targets]})
    write(index_path,indexes);print(mode,version,counts)

def world(offline):
    source=unpack('gmba',GMBA_URL,offline);ranges=[];excluded=[]
    for row,g in read_shapes(next(source.glob('*.shp'))):
        if not valid_geometry(g):excluded.append({'region':row['GMBA_V2_ID'],'reason':'invalid polygon'});continue
        # Keep the official 300 selection, including named island/highland units.
        ranges.append((row,g))
    discovery_path=OUT/'world-discovery.json'
    discovery=json.loads(discovery_path.read_text())
    review=json.loads((CONFIG/'world-review.json').read_text())
    if not discovery.get('complete') or review['discoverySha256']!=hashlib.sha256(discovery_path.read_bytes()).hexdigest():
        raise ValueError('Worldwide discovery must be complete and match its reviewed snapshot')
    candidates=discovery['candidates'];decisions={r['id']:r for r in review['decisions']}
    if len(decisions)!=len(review['decisions']) or len({c['id'] for c in candidates})!=len(candidates) or set(decisions)!={c['id'] for c in candidates}:
        raise ValueError('Every unique candidate needs exactly one review decision')
    targets=[];used={}
    for c in candidates:
        qid=c['id'].split(':')[1];decision=decisions[c['id']]
        if not decision['include']:
            excluded.append({'id':qid,'name':c['name'],'reason':decision['reason'],'editions':c['wikipediaEditions']});continue
        links=c['wikipedia'];position=c['position'];count=len(links)
        if c['checks'] or count<20 or count!=c['wikipediaEditions'] or not position:
            raise ValueError('Review cannot bypass geographic or recognition checks: '+qid)
        matches=[(r,g) for r,g in ranges if g.covers(Point(position['lon'],position['lat']))]
        if len(matches)!=1:raise ValueError('Reviewed GMBA assignment no longer resolves: '+qid)
        row,g=matches[0];region_id='gmba:'+str(row['GMBA_V2_ID']);used[region_id]=(row,g)
        if [r['id'] for r in c['gmbaRegions']]!=[region_id]:raise ValueError('GMBA source assignment changed: '+qid)
        tier='easy' if count>=60 else 'medium' if count>=35 else 'hard'
        override=review.get('overrides',{}).get(qid,{})
        # Prefer recorded article titles over malformed or ambiguous English labels.
        title=urllib.parse.unquote(links['en'].split('/wiki/',1)[1]).replace('_',' ') if 'en' in links else c['name']
        name=override.get('name',title);tier=override.get('tier',tier)
        if tier not in ['easy','medium','hard']:raise ValueError('Invalid tier override')
        names={k:v for k,v in c['names'].items() if k in ['en','de','fr','it']};names['en']=name
        targets.append({'id':c['id'],'kind':'summit','name':name,'names':names,'position':position,'difficulty':tier,'countries':[],
            'wikipedia':links,'regionIds':[region_id],'provenance':{'source':'Wikidata worldwide mountain and volcano discovery',
            'url':c['provenance']['url'],'license':'CC0','reviewed':True,'reviewDate':review['reviewDate'],'reviewMethod':review['method'],
            'discoverySha256':review['discoverySha256'],'featureType':'volcano' if 'volcano' in c['discoveredAs'] else 'mountain',
            'wikipediaEditions':count,'recognitionRule':'world-recognition-v1','reviewReason':decision['reason'],'override':override}})
    regions=[];geometries={}
    for id_,(row,g) in used.items():
        file='regions/'+id_.split(':')[1];regions.append({'id':id_,'name':row['MapName'],'geometryRef':file+'.json','displayGeometryRef':file+'-display.json'})
        geometries[file+'.json']=feature(id_,row['MapName'],g);geometries[file+'-display.json']=feature(id_,row['MapName'],g.simplify(.015,preserve_topology=True))
    publish('world-peaks',targets,regions,geometries,[{'name':'Wikidata','url':'https://www.wikidata.org/wiki/Wikidata:Licensing','license':'CC0'},{'name':'GMBA Mountain Inventory v2.0, Standard 300 selection','url':'https://doi.org/10.48601/earthenv-t9k2-1407','license':'CC BY 4.0'},{'name':'Snethlage et al. (2022), A hierarchical inventory of the world’s mountains','url':'https://doi.org/10.1038/s41597-022-01256-y','license':'CC BY 4.0'}],{'excluded':excluded,'discoverySha256':review['discoverySha256'],'discovered':len(candidates),'volcanoes':sum(t['provenance']['featureType']=='volcano' for t in targets),'sources':[{'url':GMBA_URL,'sha256':hashlib.sha256((CACHE/'gmba.zip').read_bytes()).hexdigest()}]})


def valleys(offline):
    config=json.loads((CONFIG/'valley-candidates.json').read_text());candidates=config['candidates'];by_source={};excluded=list(config['excludedSourceGroups'])
    # SOIUSA is used only to establish Alpine eligibility, not to clip source polygons.
    alpine=json.loads((OUT/'regions.geojson').read_text())
    alpine_geometries=[shape(f['geometry']) for f in alpine['features']]
    for name,source in config['sources'].items():
        folder=unpack(name,source['url'],offline)
        wanted={c['key'] for c in candidates if c['source']==name};records={}
        path=folder/source['file'];reader=shapefile.Reader(str(path))
        project=Transformer.from_crs(CRS.from_wkt(path.with_suffix('.prj').read_text()),4326,always_xy=True).transform
        for item in reader.iterShapeRecords():
            row=item.record.as_dict();key=str(row[source['field']])
            if key not in wanted:continue
            if source.get('classField') and row[source['classField']] not in source['classes']:continue
            g=transform(project,shape(item.shape.__geo_interface__))
            if key in records:
                if not records[key][1].equals(g):raise ValueError('Ambiguous source polygon '+key)
                continue
            records[key]=(row,g)
        by_source[name]=records
    targets=[];geometries={};seen=set()
    by_site={site:entities([c['title'] for c in candidates if c['site']==site],site,offline) for site in sorted({c['site'] for c in candidates})}
    for c in candidates:
        if c.get('excludeReason'):excluded.append({**c,'reason':c['excludeReason']});continue
        src=config['sources'][c['source']]
        records={qid:e for qid,e in by_site[c['site']].items() if e.get('sitelinks',{}).get(c['site'],{}).get('title','').replace('_',' ').casefold()==c['title'].replace('_',' ').casefold()}
        if len(records)!=1:excluded.append({**c,'reason':'Wikipedia title does not resolve to one Wikidata identity'});continue
        qid,e=next(iter(records.items()));position=coordinates(e);links=articles(e)
        hit=by_source[c['source']].get(c['key'])
        if not hit or not valid_geometry(hit[1]):excluded.append({**c,'reason':'Missing or invalid original polygon'});continue
        row,g=hit
        if not position or not links:excluded.append({**c,'reason':'Missing unambiguous coordinates or Wikipedia article'});continue
        point=Point(position['lon'],position['lat'])
        if not g.covers(point):excluded.append({**c,'reason':'Wikidata reference point outside source polygon; identity/extent review required'});continue
        if not any(a.covers(point) for a in alpine_geometries):excluded.append({**c,'reason':'Reference point outside supplied Alpine domain'});continue
        if qid in seen:raise ValueError('Duplicate valley identity '+qid)
        seen.add(qid);id_='wikidata:'+qid
        name=e.get('labels',{}).get('en',{}).get('value',c['title']);file='valleys/'+qid
        targets.append({'id':id_,'kind':'valley','name':name,'names':{k:v['value'] for k,v in e.get('labels',{}).items() if k in ['en','fr','it','de']},'position':position,'difficulty':c['tier'],'countries':[src['country']],'wikipedia':links,'regionIds':[],'geometryRef':file+'.json','displayGeometryRef':file+'-display.json','provenance':{'source':src['name'],'url':src['url'],'license':src['license'],'reviewed':True,'sourceKey':c['key'],'definition':src['definition'],'recognitionReason':c['reason'],'wikipediaEditions':len(links),'wikidata':'https://www.wikidata.org/wiki/'+qid}})
        geometries[file+'.json']=feature(id_,name,g);geometries[file+'-display.json']=feature(id_,name,g.simplify(.00015,preserve_topology=True))
    sources=[{'name':v['name'],'url':v['url'],'license':v['license']} for v in config['sources'].values()]
    sources.append({'name':'Wikidata','url':'https://www.wikidata.org/wiki/Wikidata:Licensing','license':'CC0'})
    publish('alpine-valleys',targets,[],geometries,sources,{'excluded':excluded,'sources':[{'name':name,'url':src['url'],'sha256':hashlib.sha256((CACHE/(name+'.zip')).read_bytes()).hexdigest()} for name,src in config['sources'].items()]})

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--offline',action='store_true');parser.add_argument('--mode',choices=['world','valleys','all'],default='all');args=parser.parse_args()
    if args.mode in ['world','all']:world(args.offline)
    if args.mode in ['valleys','all']:valleys(args.offline)
