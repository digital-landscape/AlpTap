"""Discover mountain/volcano candidates without a hand-picked title list.

Baseline retrieval uses the historical >=20 sitelink prefilter worldwide.
Regional expansion uses cached geographic batches with no sitelink floor or LIMIT.
Global prominence discovery offers a language-independent, worldwide starting set.
Exact article counts and GMBA membership follow enrichment; neither path publishes.
"""
import argparse,hashlib,json,math,time,urllib.error,urllib.parse,urllib.request
from datetime import datetime,timezone
from pathlib import Path
from prepare_modes import CACHE,OUT,GMBA_URL,articles,coordinates,read_shapes,unpack,valid_geometry,write
from shapely.geometry import Point
DISCOVERY=CACHE/'discovery'
ENDPOINT='https://query.wikidata.org/sparql'
ROOTS={'mountain':'Q8502','volcano':'Q8072'}

def discover_prominent(minimum, offline):
    if type(minimum) is not int or minimum<1:raise ValueError('Prominence minimum must be a positive integer')
    query=f'SELECT DISTINCT ?item WHERE {{ ?item wdt:P2660 ?prominence; wdt:P625 ?location. FILTER(?prominence >= {minimum}) }}'
    key=hashlib.sha256(query.encode()).hexdigest()[:20]
    path=DISCOVERY/'prominence'/f'{key}.json'
    data=request_json(ENDPOINT+'?'+urllib.parse.urlencode({'query':query,'format':'json'}),path,offline,True)
    bindings=data.get('results',{}).get('bindings')
    if not isinstance(bindings,list):raise ValueError('Incomplete prominence query response')
    found={}
    for row in bindings:
        qid=row['item']['value'].rsplit('/',1)[-1]
        if not qid.startswith('Q') or not qid[1:].isdigit():raise ValueError('Invalid prominence result')
        found[qid]=['mountain']
    return found,[{'kind':'global-prominence','minimumMeters':minimum,'query':query,'endpoint':ENDPOINT,
                   'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'count':len(bindings)}]

def geographic_batches(geometry, size=10):
    """Fixed boxes are resumable cache keys; exact GMBA membership follows retrieval."""
    from shapely.geometry import box
    west,south,east,north=geometry.bounds
    for x in range(math.floor(west/size)*size,math.ceil(east/size)*size,size):
        for y in range(math.floor(south/size)*size,math.ceil(north/size)*size,size):
            bounds=(x,max(-85,y),min(180,x+size),min(85,y+size))
            if bounds[1]<bounds[3] and geometry.intersects(box(*bounds)):
                yield bounds

def discover_regions(ranges, region_ids, offline):
    found={};queries=[]
    wanted=set(region_ids)
    available={'gmba:'+str(row['GMBA_V2_ID']) for row,g in ranges}
    if wanted-available:raise ValueError('Unknown or invalid GMBA regions: '+str(sorted(wanted-available)))
    boxes=sorted({bounds for row,g in ranges if 'gmba:'+str(row['GMBA_V2_ID']) in wanted for bounds in geographic_batches(g)})
    for west,south,east,north in boxes:
        query=f'''SELECT DISTINCT ?item ?kind WHERE {{
          SERVICE wikibase:box {{ ?item wdt:P625 ?location.
            bd:serviceParam wikibase:cornerSouthWest "Point({west} {south})"^^geo:wktLiteral;
                            wikibase:cornerNorthEast "Point({east} {north})"^^geo:wktLiteral. }}
          {{ ?item wdt:P31/wdt:P279* wd:Q8502. BIND("mountain" AS ?kind) }}
          UNION {{ ?item wdt:P31/wdt:P279* wd:Q8072. BIND("volcano" AS ?kind) }}
        }}'''
        key=hashlib.sha256(query.encode()).hexdigest()[:20]
        path=DISCOVERY/'geographic'/f'{key}.json'
        print(f'Discovering geographic batch {west},{south},{east},{north}…',flush=True)
        data=request_json(ENDPOINT+'?'+urllib.parse.urlencode({'query':query,'format':'json'}),path,offline,True)
        bindings=data.get('results',{}).get('bindings')
        if not isinstance(bindings,list):raise ValueError('Incomplete geographic query response')
        for row in bindings:
            qid=row['item']['value'].rsplit('/',1)[-1];kind=row['kind']['value']
            if not qid.startswith('Q') or not qid[1:].isdigit() or kind not in ROOTS:raise ValueError('Invalid geographic result')
            if kind not in found.setdefault(qid,[]):found[qid].append(kind)
        queries.append({'kind':'geographic','bounds':[west,south,east,north],'query':query,'endpoint':ENDPOINT,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'count':len(bindings)})
    return found,queries

def candidate_record(qid, entity, kinds, ranges):
    links=articles(entity);position=coordinates(entity)
    names={k:v['value'] for k,v in entity.get('labels',{}).items()}
    article_name=urllib.parse.unquote(next(iter(links.values()),'').split('/wiki/')[-1]).replace('_',' ')
    name=names.get('en') or names.get('mul') or next(iter(names.values()),article_name or qid)
    regions=[] if not position else [{'id':'gmba:'+str(row['GMBA_V2_ID']),'name':row['MapName']} for row,g in ranges if g.covers(Point(position['lon'],position['lat']))]
    issues=[]
    if not links:issues.append('no-wikipedia-article')
    if not position:issues.append('missing-ambiguous-or-non-earth-coordinate')
    if len(regions)!=1:issues.append('unresolved-gmba-region')
    return {'id':'wikidata:'+qid,'name':name,'names':names,'discoveredAs':sorted(kinds),'position':position,'wikipediaEditions':len(links),'wikipedia':links,'gmbaRegions':regions,'suggestedTier':None,'checks':issues,'reviewed':False,'instanceOf':[c['mainsnak'].get('datavalue',{}).get('value',{}).get('id') for c in entity.get('claims',{}).get('P31',[]) if c.get('rank')!='deprecated'],'provenance':{'source':'Wikidata','url':'https://www.wikidata.org/wiki/'+qid,'license':'CC0'}}

def expand_regions(region_ids, offline=False, prominence_min=None):
    """Merge completed geographic batches; never activate or auto-review additions."""
    state=OUT/'world-regional-discovery-status.json'
    write(state,{'complete':False,'regions':region_ids})
    try:
        path=OUT/'world-discovery.json';previous=json.loads(path.read_text())
        if not previous.get('complete'):raise ValueError('A complete baseline snapshot is required')
        source=unpack('gmba',GMBA_URL,offline)
        ranges=[(r,g) for r,g in read_shapes(next(source.glob('*.shp'))) if valid_geometry(g)]
        found,queries=discover_prominent(prominence_min,offline) if prominence_min is not None else discover_regions(ranges,region_ids,offline)
        old={c['id']:c for c in previous['candidates']}
        ids=sorted((q for q in found if 'wikidata:'+q not in old),key=lambda q:int(q[1:]))
        records=enrich(ids,offline)
        for qid in ids:old['wikidata:'+qid]=candidate_record(qid,records[qid],found[qid],ranges)
        previous.update(schemaVersion=3,scope='Historical baseline plus completed language-independent geographic and global prominence searches. Source coverage and editorial review remain incomplete; not a complete physical mountain inventory.',candidates=sorted(old.values(),key=lambda c:int(c['id'].split('Q')[-1])))
        batches={json.dumps(q,sort_keys=True):q for q in previous.get('queries',[])+queries}
        previous['queries']=list(batches.values())
        previous['expandedRegions']=sorted(set(previous.get('expandedRegions',[])+region_ids))
        if prominence_min is not None:previous['completedProminenceSearches']=sorted(set(previous.get('completedProminenceSearches',[])+[prominence_min]))
        cs=previous['candidates']
        previous['counts']={'discovered':len(cs),'wikipediaEligible':sum(bool(c['wikipedia']) for c in cs),'atLeast20WikipediaEditions':sum(c['wikipediaEditions']>=20 for c in cs),'geometryEligible':sum(bool(c['position']) and len(c['gmbaRegions'])==1 for c in cs),'volcanoes':sum('volcano' in c['discoveredAs'] for c in cs)}
        temporary=path.with_suffix('.download');write(temporary,previous);temporary.replace(path)
        write(state,{'complete':True,'regions':region_ids,'prominenceMinimum':prominence_min,'batchCandidates':len(found),'counts':previous['counts']})
        write(OUT/'world-discovery-status.json',{'complete':True,'scope':previous['scope'],'expandedRegions':previous['expandedRegions'],'completedProminenceSearches':previous.get('completedProminenceSearches',[]),'counts':previous['counts']})
        print(json.dumps(previous['counts']),flush=True)
        return previous
    except Exception as error:
        write(state,{'complete':False,'regions':region_ids,'error':str(error)});raise

def request_json(url,path,offline=False,wdqs=False):
    path=Path(path)
    if path.exists():return json.loads(path.read_text())
    if offline:raise RuntimeError('Missing cached response: '+str(path))
    path.parent.mkdir(parents=True,exist_ok=True)
    stamp=DISCOVERY/'last-wdqs-request.txt'
    cooldown=DISCOVERY/'wdqs-retry-after.txt'
    for attempt in range(4):
        if wdqs:
            last=float(stamp.read_text()) if stamp.exists() else 0
            not_before=float(cooldown.read_text()) if cooldown.exists() else 0
            delay=max(0,65-(time.time()-last),not_before-time.time())
            if delay:
                write(DISCOVERY/'retrieval-status.json',{'complete':False,'stage':'waiting-for-query-service','retryAt':datetime.fromtimestamp(time.time()+delay,timezone.utc).isoformat()})
                print(f'Wikidata query rate limit: waiting {delay:.0f}s',flush=True);time.sleep(delay)
            stamp.parent.mkdir(parents=True,exist_ok=True);stamp.write_text(str(time.time()))
        try:
            request=urllib.request.Request(url,headers={'User-Agent':'AlpTap/0.2 (educational mountain geography data preparation)','Accept':'application/json'})
            with urllib.request.urlopen(request,timeout=100) as response:data=json.load(response)
            if 'error' in data:raise RuntimeError(str(data['error']))
            temporary=path.with_suffix('.download');write(temporary,data);temporary.replace(path)
            return data
        except (urllib.error.URLError,TimeoutError) as error:
            if attempt==3:raise
            retry=getattr(error,'headers',{}).get('Retry-After','65')
            delay=max(65,float(retry) if str(retry).isdigit() else 65)
            if wdqs:cooldown.write_text(str(time.time()+delay))
            write(DISCOVERY/'retrieval-status.json',{'complete':False,'stage':'waiting-for-service','error':str(error),'retryAt':datetime.fromtimestamp(time.time()+delay,timezone.utc).isoformat()})
            print(f'Request failed: {error}; retrying in {delay:.0f}s',flush=True);time.sleep(delay)
    raise RuntimeError('Retrieval failed')

def discover(offline):
    found={};queries=[]
    for kind,root in ROOTS.items():
        query=f'SELECT DISTINCT ?item WHERE {{ ?item wdt:P31/wdt:P279* wd:{root}; wikibase:sitelinks ?count. FILTER(?count >= 20) }}'
        key=hashlib.sha256(query.encode()).hexdigest()[:20]
        path=DISCOVERY/f'{kind}-{key}.json'
        print(f'Discovering worldwide {kind} entities (no result limit)…',flush=True)
        data=request_json(ENDPOINT+'?'+urllib.parse.urlencode({'query':query,'format':'json'}),path,offline,True)
        bindings=data.get('results',{}).get('bindings')
        if not isinstance(bindings,list) or not bindings:raise ValueError('Empty or incomplete SPARQL response')
        for row in bindings:
            qid=row['item']['value'].rsplit('/',1)[-1]
            if not qid.startswith('Q') or not qid[1:].isdigit():raise ValueError('Invalid entity ID')
            found.setdefault(qid,[]).append(kind)
        queries.append({'kind':kind,'query':query,'endpoint':ENDPOINT,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'count':len(bindings)})
        print(f'{kind}: {len(bindings)} entities',flush=True)
    return found,queries

def enrich(ids,offline):
    records={}
    for offset in range(0,len(ids),50):
        batch=ids[offset:offset+50]
        query={'action':'wbgetentities','ids':'|'.join(batch),'props':'labels|claims|sitelinks/urls','languages':'en|de|fr|it|mul','format':'json'}
        url='https://www.wikidata.org/w/api.php?'+urllib.parse.urlencode(query)
        path=DISCOVERY/'entities'/(hashlib.sha256(url.encode()).hexdigest()[:20]+'.json')
        data=request_json(url,path,offline)
        entities=data.get('entities',{})
        if any(q not in entities or 'missing' in entities[q] for q in batch):raise ValueError('Missing entity metadata; retrieval is incomplete')
        records.update(entities)
        print(f'Metadata: {min(offset+50,len(ids))}/{len(ids)}',flush=True)
        if not offline:time.sleep(3)
    return records

def run(offline=False):
    snapshot=OUT/'world-discovery.json'
    if snapshot.exists() and json.loads(snapshot.read_text()).get('expandedRegions'):
        raise ValueError('Use --region or --next-regions to preserve the expanded catalogue; baseline discovery cannot replace it')
    state=OUT/'world-discovery-status.json'
    write(state,{'complete':False,'startedAt':datetime.now(timezone.utc).isoformat()})
    try:
        found,queries=discover(offline)
        ids=sorted(found,key=lambda q:int(q[1:]))
        records=enrich(ids,offline)
        source=unpack('gmba',GMBA_URL,offline)
        ranges=[(r,g) for r,g in read_shapes(next(source.glob('*.shp'))) if valid_geometry(g)]
        candidates=[]
        for qid in ids:
            entity=records[qid];links=articles(entity);position=coordinates(entity)
            names={k:v['value'] for k,v in entity.get('labels',{}).items()}
            name=names.get('en') or entity.get('sitelinks',{}).get('enwiki',{}).get('title') or names.get('mul') or next(iter(names.values()),qid)
            regions=[] if not position else [{'id':'gmba:'+str(row['GMBA_V2_ID']),'name':row['MapName']} for row,g in ranges if g.covers(Point(position['lon'],position['lat']))]
            issues=[]
            if len(links)<20:issues.append('fewer-than-20-wikipedia-editions')
            if not position:issues.append('missing-ambiguous-or-non-earth-coordinate')
            if len(regions)!=1:issues.append('unresolved-gmba-region')
            candidates.append({'id':'wikidata:'+qid,'name':name,'names':names,'discoveredAs':found[qid],'position':position,'wikipediaEditions':len(links),'wikipedia':links,'gmbaRegions':regions,'suggestedTier':'easy' if len(links)>=60 else 'medium' if len(links)>=35 else 'hard' if len(links)>=20 else None,'checks':issues,'reviewed':False,'instanceOf':[c['mainsnak'].get('datavalue',{}).get('value',{}).get('id') for c in entity.get('claims',{}).get('P31',[]) if c.get('rank')!='deprecated'],'provenance':{'source':'Wikidata','url':'https://www.wikidata.org/wiki/'+qid,'license':'CC0'}})
        output={'schemaVersion':1,'complete':True,'scope':'All returned Wikidata instances/subclasses of mountain Q8502 or volcano Q8072 with at least 20 total Wikimedia sitelinks; no LIMIT and no geographic bounding box. Wikipedia-only thresholds and GMBA checks follow. Not a claim of a complete inventory of every physical mountain.','queries':queries,'gmba':{'source':GMBA_URL,'version':'2.0 Standard 300','license':'CC BY 4.0'},'counts':{'discovered':len(candidates),'wikipediaEligible':sum(c['wikipediaEditions']>=20 for c in candidates),'geometryEligible':sum(not c['checks'] for c in candidates),'volcanoes':sum('volcano' in c['discoveredAs'] for c in candidates)},'candidates':candidates}
        write(OUT/'world-discovery.json',output)
        write(state,{'complete':True,'finishedAt':datetime.now(timezone.utc).isoformat(),'counts':output['counts']})
        print(json.dumps(output['counts']),flush=True)
        return output
    except Exception as error:
        write(state,{'complete':False,'error':str(error),'stoppedAt':datetime.now(timezone.utc).isoformat()});raise

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--offline',action='store_true')
    selection=parser.add_mutually_exclusive_group()
    selection.add_argument('--region',action='append',help='GMBA ID to expand without a sitelink floor; repeat for multiple regions')
    selection.add_argument('--next-regions',type=int,help='Discover the next N unexpanded regions from the coverage audit queue')
    selection.add_argument('--prominence-min',type=int,help='Worldwide Wikidata prominence search in metres; no Wikipedia-language filter; requires specialist review before publication')
    args=parser.parse_args()
    if args.next_regions is not None:
        if args.next_regions<1:parser.error('--next-regions must be positive')
        audit=json.loads((OUT/'world-coverage.json').read_text())
        snapshot=json.loads((OUT/'world-discovery.json').read_text())
        args.region=[id_ for id_ in audit['reviewQueue'] if id_ not in snapshot.get('expandedRegions',[])][:args.next_regions]
        if not args.region:parser.exit(message='No unexpanded regions remain in the audit queue.\n')
    if args.prominence_min is not None:expand_regions([],args.offline,args.prominence_min)
    elif args.region:expand_regions(args.region,args.offline)
    else:expand_regions([],args.offline,1500)
