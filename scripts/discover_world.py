"""Discover worldwide mountain/volcano candidates without a hand-picked title list.

A total-sitelink prefilter of 20 is safe: an item with 20 Wikipedia editions
necessarily has at least 20 total sitelinks. Wikipedia-only counts follow enrichment.
No LIMIT or geographic bounding box is used. Retrieval never activates a catalogue.
"""
import argparse,hashlib,json,time,urllib.error,urllib.parse,urllib.request
from datetime import datetime,timezone
from pathlib import Path
from prepare_modes import CACHE,OUT,GMBA_URL,articles,coordinates,read_shapes,unpack,valid_geometry,write
from shapely.geometry import Point
DISCOVERY=CACHE/'discovery'
ENDPOINT='https://query.wikidata.org/sparql'
ROOTS={'mountain':'Q8502','volcano':'Q8072'}

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
                write(OUT/'world-discovery-status.json',{'complete':False,'stage':'waiting-for-query-service','retryAt':datetime.fromtimestamp(time.time()+delay,timezone.utc).isoformat()})
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
            write(OUT/'world-discovery-status.json',{'complete':False,'stage':'waiting-for-service','error':str(error),'retryAt':datetime.fromtimestamp(time.time()+delay,timezone.utc).isoformat()})
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
        if not offline:time.sleep(1)
    return records

def run(offline=False):
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
    parser=argparse.ArgumentParser();parser.add_argument('--offline',action='store_true');args=parser.parse_args();run(args.offline)
