"""Read-only comparison of active summit catalogues with cached/live OSM records.

Standard library only. Never publishes or changes game coordinates.
"""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import html
import json
import math
from pathlib import Path
import re
import subprocess
import time
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache/osm-audit'
OUTPUT = ROOT / 'output/osm-audit'
STRIPES = [(4, 6), (6, 8), (8, 10), (10, 12), (12, 14), (14, 17)]


def read(path):
    return json.loads(path.read_text())


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temp.replace(path)


def valid(data):
    if data.get('remark') or not isinstance(data.get('elements'), list):
        raise ValueError('Incomplete Overpass response: ' + str(data.get('remark')))
    return data


def query(text, offline, endpoint, sources):
    key = hashlib.sha256(text.encode()).hexdigest()
    path = CACHE / (key + '.json')
    if not path.exists():
        if offline:
            raise RuntimeError('Missing query cache ' + key[:12])
        CACHE.mkdir(parents=True, exist_ok=True)
        request = CACHE / (key + '.overpass')
        request.write_text(text)
        temp = CACHE / (key + '.download')
        print('Fetching OSM batch ' + key[:12], flush=True)
        subprocess.run(['curl', '--fail', '--silent', '--show-error', '--max-time', '110',
                        '--user-agent', 'AlpTap-coordinate-audit/0.1', '--data-urlencode', 'data@' + str(request), endpoint, '-o', str(temp)], check=True)
        valid(read(temp))
        temp.replace(path)
        write(path.with_suffix('.source.json'), {'url': endpoint, 'downloadedAt': datetime.now(timezone.utc).isoformat(), 'query': text})
        time.sleep(2)
    data = valid(read(path))
    metadata = read(path.with_suffix('.source.json')) if path.with_suffix('.source.json').exists() else {}
    sources.append({'file': str(path.relative_to(ROOT)), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                    'osmTimestamp': data.get('osm3s', {}).get('timestamp_osm_base'), **metadata})
    return data['elements']


def normalize(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', value.casefold()) if c.isalnum())


def names(record, osm=False):
    if osm:
        values = [v for k, v in record.get('tags', {}).items() if k in ('name', 'alt_name', 'official_name', 'loc_name') or k.startswith(('name:', 'alt_name:', 'official_name:', 'loc_name:'))]
    else:
        values = [record['name'], *record.get('names', {}).values(), *record.get('aliases', [])]
    return {normalize(part) for value in values for part in value.split(';') if normalize(part)}


def distance(a, b):
    lat1, lat2 = math.radians(a['lat']), math.radians(b['lat'])
    dlat = lat2 - lat1
    dlon = math.radians(b['lon'] - a['lon'])
    h = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
    return 6371008.8 * 2 * math.asin(math.sqrt(min(1, max(0, h))))


def point(e):
    return e.get('type') == 'node' and all(isinstance(e.get(k), (int, float)) and math.isfinite(e[k]) and abs(e[k]) <= limit for k, limit in [('lat', 90), ('lon', 180)])


def indices(elements):
    byid, byname = defaultdict(list), defaultdict(list)
    unique = {(e['type'], e['id']): e for e in elements}
    for e in unique.values():
        for q in e.get('tags', {}).get('wikidata', '').split(';'):
            if re.fullmatch(r'Q\d+', q.strip()):
                byid[q.strip()].append(e)
        if point(e):
            for name in names(e, True):
                byname[name].append(e)
    return byid, byname


def compare(target, byid, byname, available=True):
    qid = target['id'].split(':')[-1]
    pos = target.get('position', target)
    linked = byid.get(qid, [])
    candidates = [e for e in linked if point(e)]
    method = 'wikidata-id'
    if not linked:
        nearby = {}
        for name in names(target):
            for e in byname.get(name, []):
                # Another explicit identity is never silently matched by its name.
                if not e.get('tags', {}).get('wikidata') and distance(pos, e) <= 10000:
                    nearby[(e['type'], e['id'])] = e
        candidates = list(nearby.values())
        method = 'name-within-10km'
    rows = []
    for e in sorted(candidates, key=lambda e: distance(pos, e)):
        rows.append({'osmId': f"{e['type']}/{e['id']}", 'osmUrl': f"https://www.openstreetmap.org/{e['type']}/{e['id']}",
                     'name': e.get('tags', {}).get('name', ''), 'position': {'lat': e['lat'], 'lon': e['lon']},
                     'distanceM': round(distance(pos, e), 1), 'elevation': e.get('tags', {}).get('ele')})
    if len(rows) > 1:
        status = 'ambiguous'
    elif len(rows) == 1:
        d = rows[0]['distanceM']
        status = 'within-100m' if d <= 100 else '100m-to-500m' if d <= 500 else '500m-to-1km' if d <= 1000 else 'over-1km'
    else:
        status = 'non-point-only' if linked else 'unmatched' if available else 'source-unavailable'
    return {'id': target['id'], 'name': target['name'], 'modes': target['modes'],
            'position': {'lat': pos['lat'], 'lon': pos['lon']}, 'wikidataUrl': 'https://www.wikidata.org/wiki/' + qid,
            'status': status, 'matchMethod': method if linked or rows else None, 'candidates': rows,
            'linkedNonPoints': [f"{e['type']}/{e['id']}" for e in linked if not point(e)]}


def catalogue():
    manifest = read(ROOT / 'public/data/manifest.json')
    # Read precisely the currently published shards rather than a possibly newer processed export.
    folder = ROOT / 'public/data' / manifest['version']
    targets = {}
    for path in sorted(folder.glob('peaks-*.json')):
        for peak in read(path).values():
            targets[peak['id']] = {**peak, 'modes': ['alpine-peaks']}
    if not targets:
        raise ValueError('No Alpine targets found')
    versions = {'alpine-peaks': manifest['version']}
    for mode in read(ROOT / 'data/processed/mode-index.json'):
        if mode['mode'] != 'world-peaks' or not mode.get('validated'):
            continue
        versions['world-peaks'] = mode['version']
        for target in read(ROOT / 'public/data' / mode['version'] / 'manifest.json')['targets']:
            if target['id'] in targets:
                # Preserve differing published coordinates as separate audit rows.
                old = targets[target['id']]
                if old['lat'] == target['position']['lat'] and old['lon'] == target['position']['lon']:
                    old['modes'].append('world-peaks')
                    continue
            targets['world:' + target['id']] = {**target, 'modes': ['world-peaks']}
    return list(targets.values()), versions


def report_html(report):
    esc = lambda v: html.escape(str(v), quote=True)
    rows = []
    ordered = sorted(report['targets'], key=lambda r: max((c['distanceM'] for c in r['candidates']), default=-1), reverse=True)
    for r in ordered:
        candidates = '<br>'.join(f'<a href="{esc(c["osmUrl"])}">{esc(c["osmId"])}</a>: {c["distanceM"]:,.1f} m — {esc(c["name"])}' for c in r['candidates'])
        rows.append(f'<tr><td><a href="{esc(r["wikidataUrl"])}">{esc(r["name"])}</a><br>{esc(r["id"])}</td><td>{esc(", ".join(r["modes"]))}</td><td>{esc(r["status"])}</td><td>{esc(r["matchMethod"] or "—")}</td><td>{candidates}</td></tr>')
    return '''<!doctype html><meta charset="utf-8"><title>AlpTap coordinate audit</title>
<style>body{font:15px system-ui;margin:32px;color:#152c37}table{border-collapse:collapse;width:100%}td,th{padding:9px;text-align:left;border-bottom:1px solid #ddd}th{position:sticky;top:0;background:#e8f2f5}input{padding:10px;width:420px}a{color:#136180}</style>
<h1>Wikidata–OpenStreetMap coordinate audit</h1><p>''' + esc(report['generatedAt']) + '''</p><p>Comparison only. OSM is not ground truth; agreement is not independent verification. Name matches need identity review. Multiple candidates are ambiguous. Way/relation centers are not summit coordinates. Unmatched means no match within this audit's source coverage.</p><pre>''' + esc(json.dumps(report['summary'], indent=2)) + '''</pre><h2>Direct ID matches and tentative name matches</h2><pre>''' + esc(json.dumps(report['summaryByMethod'], indent=2)) + '''</pre><p>OSM comparison data © OpenStreetMap contributors, ODbL; Wikidata CC0.</p><p>Source errors: ''' + esc(report['errors']) + '''</p><input id="filter" placeholder="Filter by name, ID, status or mode" aria-label="Filter audit rows"><table><thead><tr><th>Summit</th><th>Mode</th><th>Distance / status</th><th>Match basis</th><th>OSM candidates</th></tr></thead><tbody>''' + '\n'.join(rows) + '''</tbody></table><script>document.querySelector('#filter').addEventListener('input',e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('tbody tr').forEach(r=>r.hidden=!r.textContent.toLowerCase().includes(q))});</script>'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true')
    parser.add_argument('--endpoint', default='https://overpass.private.coffee/api/interpreter')
    args = parser.parse_args()
    targets, versions = catalogue()
    elements, sources, errors = [], [], []
    alpine_complete = True
    for west, east in STRIPES:
        path = ROOT / f'.cache/data/osm/peaks-{west}-{east}.json'
        try:
            if path.exists():
                data = valid(read(path))
                elements.extend(data['elements'])
                source = read(path.with_suffix('.source.json')) if path.with_suffix('.source.json').exists() else {}
                sources.append({'file': str(path.relative_to(ROOT)), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'osmTimestamp': data.get('osm3s', {}).get('timestamp_osm_base'), **source})
            else:
                elements.extend(query(f'[out:json][timeout:90];nwr["natural"="peak"](43,{west},49,{east});out body;', args.offline, args.endpoint, sources))
        except (RuntimeError, ValueError, subprocess.CalledProcessError) as error:
            alpine_complete = False
            errors.append(str(error))
    world = [t for t in targets if 'world-peaks' in t['modes']]
    ids = '|'.join(sorted({t['id'].split(':')[-1] for t in world}))
    linked_query = f'[out:json][timeout:90];nwr["natural"~"^(peak|volcano)$"]["wikidata"~"^({ids})$"];out body;'
    world_complete = True
    try:
        if world:
            elements.extend(query(linked_query, args.offline, args.endpoint, sources))
    except (RuntimeError, ValueError, subprocess.CalledProcessError) as error:
        world_complete = False
        errors.append(str(error))
        args.offline = True  # Stop live requests after an outage; still use successful caches.
    byid, byname = indices(elements)
    # Name-based fallback around worldwide targets lacking a point identity match.
    missing = [t for t in world if not any(point(e) for e in byid.get(t['id'].split(':')[-1], []))]
    searched = set()
    for start in range(0, len(missing), 40):
        batch = missing[start:start + 40]
        clauses = []
        for t in batch:
            p = t.get('position', t)
            clauses.append(f'nwr["natural"~"^(peak|volcano)$"](around:10000,{p["lat"]},{p["lon"]});')
        try:
            elements.extend(query('[out:json][timeout:90];(' + ''.join(clauses) + ');out body;', args.offline, args.endpoint, sources))
            searched.update(t['id'] for t in batch)
        except (RuntimeError, ValueError, subprocess.CalledProcessError) as error:
            errors.append(str(error))
            args.offline = True
    byid, byname = indices(elements)
    results = []
    for t in targets:
        available = alpine_complete if 'alpine-peaks' in t['modes'] else world_complete and (t not in missing or t['id'] in searched)
        results.append(compare(t, byid, byname, available))
    summary = {mode: dict(Counter(r['status'] for r in results if mode in r['modes'])) for mode in versions}
    report = {'generatedAt': datetime.now(timezone.utc).isoformat(), 'versions': versions,
              'complete': not errors, 'scope': 'All active published summit coordinates; Alpine cached peak stripes, worldwide linked peaks/volcanoes and 10 km name fallback.',
              'license': 'OSM comparison data © OpenStreetMap contributors, ODbL; Wikidata CC0.',
              'thresholdsM': [100, 500, 1000], 'summaryByMethod': {mode: {method: dict(Counter(r['status'] for r in results if mode in r['modes'] and r['matchMethod'] == method)) for method in ['wikidata-id', 'name-within-10km']} for mode in versions}, 'summary': summary, 'errors': errors, 'sources': sources, 'targets': results}
    write(OUTPUT / 'report.json', report)
    (OUTPUT / 'report.html').write_text(report_html(report))
    print(json.dumps({'complete': report['complete'], 'summary': summary, 'errors': errors}, indent=2))
    print('Report: ' + str(OUTPUT / 'report.html'))


if __name__ == '__main__':
    main()
