"""Deterministic coverage audit of every original GMBA Standard 300 unit."""
from collections import Counter

TIERS = ('easy', 'medium', 'hard')


def coverage_audit(shapes, candidates, decisions, targets, baseline, expanded_regions, previous=None):
    previous_release = baseline if previous is None else previous
    def totals(items):
        alpine = sum('gmba:10001' in t['regionIds'] for t in items)
        return {'targets': len(items), 'representedRegions': len({r for t in items for r in t['regionIds']}),
                'alpineTargets': alpine, 'alpineShare': alpine / len(items) if items else 0,
                'difficulty': dict(Counter(t['difficulty'] for t in items))}
    regions = []
    for row, geometry in shapes:
        id_ = 'gmba:' + str(row['GMBA_V2_ID'])
        current = [t for t in targets if id_ in t['regionIds']]
        previous = [t for t in baseline if id_ in t['regionIds']]
        records = [c for c in candidates if id_ in [r['id'] for r in c['gmbaRegions']]]
        holds = Counter(decisions[c['id']]['reason'] for c in records if not decisions[c['id']]['include'])
        valid = geometry.is_valid and not geometry.is_empty and geometry.geom_type in {'Polygon', 'MultiPolygon'}
        regions.append({'id': id_, 'name': row['MapName'], 'validGeometry': valid,
                        'domain': ('Europe' if row.get('Level_02') == 'Europe' else 'Asia') if row.get('Level_01') == 'Eurasia' else row.get('Level_01', 'Unspecified'),
                        'before': len(previous), 'included': len(current), 'added': len(current)-len(previous),
                        'difficulty': {tier: sum(t['difficulty'] == tier for t in current) for tier in TIERS},
                        'discovered': len(records), 'heldReasons': dict(sorted(holds.items())),
                        'geographicDiscoveryComplete': id_ in expanded_regions})
    regions.sort(key=lambda r: r['id'])
    domain_by_region = {r['id']: r['domain'] for r in regions}
    domains = []
    for domain in sorted(set(domain_by_region.values())):
        def count(items):
            return sum(any(domain_by_region.get(id_) == domain for id_ in t['regionIds']) for t in items)
        domains.append({'name': domain, 'baseline': count(baseline), 'previous': count(previous_release), 'included': count(targets), 'added': count(targets)-count(previous_release)})
    return {'schemaVersion': 2, 'before': totals(baseline), 'after': totals(targets), 'previous': totals(previous_release), 'domains': domains, 'regions': regions,
            'reviewQueue': [r['id'] for r in sorted(regions, key=lambda r: (r['included'], r['id']))
                            if r['included'] < 20 and r['validGeometry']],
            'unassignedHolds': [{'id': c['id'], 'name': c['name'], 'reason': decisions[c['id']]['reason']}
                                for c in candidates if not c['gmbaRegions'] and not decisions[c['id']]['include']]}


def coverage_markdown(audit):
    before, after = audit['before'], audit['after']
    lines = ['# Worldwide coverage audit', '',
             f"Reviewed targets: **{before['targets']} → {after['targets']}**. "
             f"Alpine share: **{before['alpineShare']:.1%} → {after['alpineShare']:.1%}**. "
             f"Represented GMBA regions: **{before['representedRegions']} → {after['representedRegions']}**.", '',
             'Counts refer to the original GMBA Standard 300 units, including zero-target and invalid units. '
             'A completed geographic search is not a claim of a complete physical mountain inventory. '
             'The machine-readable audit in `data/processed/world-coverage.json` records held reasons, '
             'unassigned candidates and the next review queue (fewer than 20 targets, ordered by count and stable ID).', '',
             '## Worldwide domains', '',
             'Domains follow GMBA hierarchy (Eurasia split into Europe and Asia). Ocean island units retain their original group. '
             'The source has no Antarctic scoring units, so Antarctic candidates remain unassigned rather than receiving invented polygons.', '',
             '| Domain | Original baseline | Previous release | Now | Added this batch |',
             '| --- | ---: | ---: | ---: | ---: |']
    for d in audit['domains']:
        lines.append(f"| {d['name']} | {d['baseline']} | {d['previous']} | {d['included']} | {d['added']} |")
    lines += ['', '## Every GMBA region', '',
             '| Region | ID | Before | Now | Easy / Medium / Hard | Geographic search | Held |',
             '| --- | --- | ---: | ---: | --- | --- | ---: |']
    for r in sorted(audit['regions'], key=lambda r: (r['included'], r['id'])):
        tiers=' / '.join(str(r['difficulty'][t]) for t in TIERS)
        status='invalid polygon' if not r['validGeometry'] else 'complete' if r['geographicDiscoveryComplete'] else 'not expanded'
        lines.append(f"| {r['name']} | {r['id']} | {r['before']} | {r['included']} | {tiers} | {status} | {sum(r['heldReasons'].values())} |")
    return '\n'.join(lines)+'\n'


def batch_markdown(audit, targets, previous):
    old_ids = {t['id'] for t in previous}
    added = [t for t in targets if t['id'] not in old_ids]
    regions = {r['id']: r for r in audit['regions']}
    lines = ['# Global mountain expansion', '',
             f"**{len(added)} additions: {audit['previous']['targets']} → {audit['after']['targets']} targets.** "
             f"Represented GMBA regions: **{audit['previous']['representedRegions']} → {audit['after']['representedRegions']}**.", '',
             'Translation counts are descriptive metadata, not admission or difficulty scores. '
             'Every new target has explicit evidence and a difficulty assessment in `data/config/world-review.json`. '
             'Existing targets and tiers are preserved; the new Hard assessments are provisional where recognition has not been independently established.', '',
             '| GMBA domain | Before this batch | After | Added |', '| --- | ---: | ---: | ---: |']
    for d in audit['domains']:
        lines.append(f"| {d['name']} | {d['previous']} | {d['included']} | {d['added']} |")
    lines += ['', '## Evidence and gaps', '',
              'The main batch uses the [Peaklist worldwide summit inventory](http://www.peaklist.org/ultras.html) '
              'by Aaron Maizlish, Jonathan de Ferranti and regional contributors, including its linked '
              '[2007 coordinate file](http://peaklist.org/misc/ultrasgoogle052007.KMZ). '
              'Named individual summits were compared with Wikidata points within 300 m and original GMBA polygons. '
              'Names, aliases, duplicate identities and range references were reviewed separately; proximity alone is insufficient. '
              'Exact reference points, source records and archive hashes remain in provenance. '
              'Historical map coordinates are not survey-precision measurements.', '',
              'Margherita Peak also has [Uganda Wildlife Authority evidence](https://ugandawildlife.org/national-parks/rwenzori-mountains/); '
              'its two recorded article editions do not prevent a Medium assessment. '
              '[Mount Bogong](https://www.parks.vic.gov.au/places-to-see/parks/alpine-national-park/attractions/mount-bogong) '
              'qualifies through its state-high-point status, demonstrating that prominence is not a universal threshold.', '',
              'Source matches with ambiguous names, ranges or duplicate physical summits remain held in `data/config/world-global-batch.json`. '
              'Other unmatched or unreviewed discovery records remain held. '
              'Antarctica has no original GMBA Standard 300 scoring units; no Antarctic targets were released. '
              'Geographic coverage, source age and name/coordinate conflicts still need further work. '
              'The [full regional audit](WORLD_COVERAGE.md) includes every zero-target region and links the continuing review queue.', '',
              '## Added targets', '', '| Target / article | Wikidata | GMBA region | Difficulty |', '| --- | --- | --- | --- |']
    for t in sorted(added, key=lambda t: (regions[t['regionIds'][0]]['domain'], regions[t['regionIds'][0]]['name'], t['name'])):
        links = t['wikipedia']
        url = next((links[k] for k in ['en', 'de', 'fr', 'it'] if k in links), next(iter(links.values())))
        name = t['name'].replace('|', '\\|')
        lines.append(f"| [{name}]({url}) | {t['id']} | {regions[t['regionIds'][0]]['name']} | {t['difficulty'].title()} |")
    return '\n'.join(lines)+'\n'
