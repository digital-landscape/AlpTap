"""Suggest matches to the Peaklist world inventory; never approves or publishes targets.

Raw source archives and suggestions belong in .cache/modes/review/. Only reviewed
facts, source URLs, hashes and explicit decisions belong in tracked provenance.
"""
import argparse
import hashlib
import json
import math
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path


def inventory(path):
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read('doc.kml'))
    ns = {'k': root.tag.split('}')[0][1:]}
    records = []
    for index, point in enumerate(root.findall('.//k:Placemark', ns)):
        fields = dict(re.findall(r'<B>([^<]+)</B> = (.*?)(?:<BR>|$)', point.findtext('k:description', '', ns)))
        lon, lat, elevation = map(float, point.findtext('k:Point/k:coordinates', namespaces=ns).split(','))
        # Original source IDs are sometimes missing or reused. Ordinal + archive hash identifies a record.
        records.append({'record': index, 'id': fields['ID'], 'name': fields['NAME'], 'aliases': fields.get('ALT_NAME', ''),
                        'position': {'lon': lon, 'lat': lat}, 'elevationMeters': elevation,
                        'prominenceMeters': float(fields['PROMINENCE']), 'countries': fields.get('COUNTRY', '')})
    return records


def distance_m(a, b):
    lat1, lat2 = math.radians(a['lat']), math.radians(b['lat'])
    dlat, dlon = lat2-lat1, math.radians(b['lon']-a['lon'])
    h = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 12742000 * math.asin(min(1, math.sqrt(h)))


def suggest(candidates, references, maximum=300):
    suggestions = []
    for c in candidates:
        if not c['position'] or not references:
            continue
        nearest = min(references, key=lambda r: distance_m(c['position'], r['position']))
        separation = distance_m(c['position'], nearest['position'])
        if separation <= maximum:
            suggestions.append({'id': c['id'], 'name': c['name'], 'reference': nearest,
                                'separationMeters': round(separation), 'requiresIdentityReview': True,
                                'checks': c['checks']})
    return suggestions


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--discovery', type=Path, default=Path('data/processed/world-discovery.json'))
    parser.add_argument('--output', type=Path, default=Path('.cache/modes/review/global/suggestions.json'))
    args = parser.parse_args()
    refs = inventory(args.source)
    data = {'sourceSha256': hashlib.sha256(args.source.read_bytes()).hexdigest(), 'sourceRecords': len(refs),
            'maximumSeparationMeters': 300, 'suggestions': suggest(json.loads(args.discovery.read_text())['candidates'], refs)}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
    print(f"{len(data['suggestions'])} suggestions; none automatically approved")
