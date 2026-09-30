"""Wikidata-first Alpine catalogue; OSM is not required for peak discovery or identity."""
import argparse, hashlib, json, math, os, re, time
from urllib.parse import urlencode
from shapely import prepare
from shapely.geometry import Point
from prepare import CACHE, OUT, download, import_sections, publish, write

ENDPOINT = os.getenv('WIKIDATA_QUERY_URL', 'https://query.wikidata.org/sparql')
COUNTRIES = {'Q40':'AT','Q142':'FR','Q38':'IT','Q39':'CH','Q183':'DE','Q215':'SI','Q347':'LI'}
UNITS = {'Q11573':1, 'Q828224':1000, 'Q3710':0.3048}
PREFIXES = '''PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX psv: <http://www.wikidata.org/prop/statement/value/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX bd: <http://www.bigdata.com/rdf#>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX schema: <http://schema.org/>
'''

def query(text, offline):
    text=PREFIXES+text
    key=hashlib.sha256(text.encode()).hexdigest()[:20]
    path=CACHE/'wikidata-primary'/f'query-{key}.json'
    if not path.exists() and not offline: time.sleep(1)
    data=download(path,ENDPOINT+'?'+urlencode({'query':text,'format':'json'}),offline=offline)
    if 'results' not in data: raise ValueError('Invalid Wikidata query response; not publishing')
    return data['results']['bindings']

def coordinate(value):
    match=re.fullmatch(r'Point\(([-+\d.eE]+) ([-+\d.eE]+)\)',value)
    if not match:return None
    lon,lat=map(float,match.groups())
    return (lon,lat) if math.isfinite(lon) and math.isfinite(lat) and -180<=lon<=180 and -90<=lat<=90 else None

def quantity(rows,field,issues,id_,maximum):
    values=set()
    for row in rows:
        if row['field']['value']!=field:continue
        unit=row.get('unit',{}).get('value','').split('/')[-1]
        if unit not in UNITS:
            issues.append({'id':id_,'type':'unsupported-unit','field':field,'unit':unit});continue
        amount=float(row['value']['value'])*UNITS[unit]
        if not math.isfinite(amount) or not 0<=amount<=maximum:
            issues.append({'id':id_,'type':'suspicious-quantity','field':field,'value':amount});continue
        values.add(round(amount,3))
    if len(values)>1:
        issues.append({'id':id_,'type':'ambiguous-quantity','field':field,'values':sorted(values)})
        return None
    return next(iter(values),None)

def build_peak(qid,coords,rows,geoms,issues):
    id_='wikidata:'+qid
    # Multiple best-ranked coordinates are not silently collapsed to a guessed summit.
    points=sorted(set(c for c in map(coordinate,coords) if c is not None))
    if len(points)!=1:
        issues.append({'id':id_,'type':'ambiguous-coordinate','coordinates':points});return None
    lon,lat=points[0]; point=Point(lon,lat)
    sections=[k for k,g in geoms.items() if k.startswith('SZ.') and g.covers(point)]
    if not sections:
        issues.append({'id':id_,'type':'uncoded-basin' if geoms['aux:klagenfurt-basin'].covers(point) else 'outside-domain'});return None
    names={};aliases=[];countries=[];articles={}
    for row in rows:
        field=row['field']['value'];value=row['value']['value'];lang=row['value'].get('xml:lang')
        if field=='label' and lang:names[lang]=value
        elif field=='alias':aliases.append(value)
        elif field=='P17' and value.split('/')[-1] in COUNTRIES:countries.append(COUNTRIES[value.split('/')[-1]])
        elif field=='article':
            match=re.fullmatch(r'https://([a-z-]+)\.wikipedia\.org/wiki/.+',value)
            if match:articles[match[1]]=value
    if not names:
        issues.append({'id':id_,'type':'missing-label-excluded'});return None
    if not countries:issues.append({'id':id_,'type':'missing-country'})
    elevation=quantity(rows,'P2044',issues,id_,5000)
    prominence=quantity(rows,'P2660',issues,id_,5000)
    isolation=quantity(rows,'P2659',issues,id_,20000000)
    return {'id':id_,'wikidata':qid,'lat':lat,'lon':lon,'name':next((names[l] for l in ['mul','de','fr','it','en'] if l in names),next(iter(names.values()))),'names':names,'aliases':sorted(set(aliases)),'wikipedia':articles,'elevation':elevation,'countries':sorted(set(countries)),'countryCandidates':[],'soiusa':{'sectionIds':sections,'regionIds':['alps']+sorted(set('western-alps' if int(k[3:])<=14 else 'eastern-alps' for k in sections))},'prominence':prominence,'isolation':None if isolation is None else isolation/1000,'provenance':{'source':'Wikidata','id':qid,'url':'https://www.wikidata.org/wiki/'+qid,'coordinateSource':'Wikidata P625, best rank','nameSource':'Wikidata labels and aliases','elevationSource':'Wikidata P2044, best rank','countrySource':'Wikidata P17; multiple memberships retained','prominenceSource':'Wikidata P2660, best rank','isolationSource':'Wikidata P2659, best rank; km','discovery':'P31/P279* Q8502 inside Alpine bounding stripes; exact SOIUSA spatial join'},'_wikipedia':bool(articles),'_notoriety':min(1,math.log1p(len(articles))/math.log(61))}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--offline',action='store_true');parser.add_argument('--geography-only',action='store_true');args=parser.parse_args()
    geoms,units,issues=import_sections()
    if args.geography_only:write(OUT/'hierarchy.json',units);return
    for geom in geoms.values():prepare(geom)
    discovered={}
    for west,east in [(4,6),(6,8),(8,10),(10,12),(12,14),(14,17)]:
        print(f'Wikidata mountain discovery {west}–{east}° E',flush=True)
        rows=query(f'''SELECT DISTINCT ?item ?coord WHERE {{ SERVICE wikibase:box {{ ?item wdt:P625 ?coord. bd:serviceParam wikibase:cornerWest "Point({west} 43)"^^geo:wktLiteral; wikibase:cornerEast "Point({east} 49)"^^geo:wktLiteral. }} ?item wdt:P31/wdt:P279* wd:Q8502. }}''',args.offline)
        for row in rows:discovered.setdefault(row['item']['value'].split('/')[-1],set()).add(row['coord']['value'])
    # Exclude outside-domain items before downloading metadata, independently of OSM.
    ids=sorted(q for q,coords in discovered.items() if any((c:=coordinate(v)) and any(g.covers(Point(*c)) for k,g in geoms.items() if k.startswith('SZ.')) for v in coords))
    eligible=set(ids)
    for qid,coords in discovered.items():
        if qid not in eligible:
            basin=any((c:=coordinate(v)) and geoms['aux:klagenfurt-basin'].covers(Point(*c)) for v in coords)
            issues.append({'id':'wikidata:'+qid,'type':'uncoded-basin' if basin else 'outside-domain'})
    print(f'{len(ids)} Wikidata mountain candidates inside SOIUSA',flush=True)
    peaks=[]; seen={}
    for start in range(0,len(ids),200):
        batch=ids[start:start+200];values=' '.join('wd:'+q for q in batch)
        rows=query('''SELECT DISTINCT ?item ?field ?value ?unit WHERE { VALUES ?item { '''+values+''' }
        { ?item rdfs:label ?value. BIND("label" AS ?field) }
        UNION { ?item skos:altLabel ?value. BIND("alias" AS ?field) }
        UNION { ?item wdt:P17 ?value. BIND("P17" AS ?field) }
        UNION { VALUES (?property ?valueProperty ?field) { (p:P2044 psv:P2044 "P2044") (p:P2660 psv:P2660 "P2660") (p:P2659 psv:P2659 "P2659") }
          ?item ?property ?statement. ?statement a wikibase:BestRank; ?valueProperty ?quantity.
          ?quantity wikibase:quantityAmount ?value; wikibase:quantityUnit ?unit. }
        UNION { ?value schema:about ?item; schema:isPartOf ?site. FILTER(CONTAINS(STR(?site),".wikipedia.org/")) BIND("article" AS ?field) }
        }''',args.offline)
        byid={qid:[] for qid in batch}
        for row in rows:byid[row['item']['value'].split('/')[-1]].append(row)
        for qid in batch:
            peak=build_peak(qid,discovered[qid],byid[qid],geoms,issues)
            if peak:
                signature=(round(peak['lat'],6),round(peak['lon'],6),peak['name'].casefold())
                if signature in seen:issues.append({'id':peak['id'],'type':'duplicate-coordinate-name','retained':seen[signature]})
                else:seen[signature]=peak['id'];peaks.append(peak)
        print(f'Metadata {min(start+200,len(ids))}/{len(ids)}; accepted {len(peaks)}',flush=True)
    if not peaks:raise ValueError('No usable Wikidata mountains; previous production data untouched')
    publish(peaks,geoms,units,issues,{'source':'Wikidata primary; no OSM peak dependency','discoveredEntities':len(discovered),'requestedEntities':len(ids),'cachedEntities':len(ids),'complete':True},primary='Wikidata')

if __name__=='__main__':main()
