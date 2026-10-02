"""Validate published mode assets without network access or raw download caches."""
import json,unittest,hashlib
from pathlib import Path
from shapely.geometry import shape,Point
from prepare_modes import coordinates,valid_geometry
from world_policy import validate_admission,reviewed_difficulty,POLICY
from review_world_inventory import distance_m
ROOT=Path(__file__).resolve().parents[1]

class ModeDataTests(unittest.TestCase):
    def test_published_catalogues(self):
        review=json.loads((ROOT/'data/config/world-review.json').read_text())
        decisions={d['id']:d for d in review['decisions']}
        preserved=json.loads((ROOT/'public/data'/review['preserveVersion']/'manifest.json').read_text())
        previous={t['id']:t for t in preserved['targets']}
        for index in json.loads((ROOT/'data/processed/mode-index.json').read_text()):
            folder=ROOT/'public/data'/index['version']
            manifest=json.loads((folder/'manifest.json').read_text())
            self.assertEqual(manifest['mode'],index['mode'])
            targets=manifest['targets'];self.assertEqual(len(targets),len({t['id'] for t in targets}))
            for tier in ['easy','medium','hard']:self.assertGreaterEqual(sum(t['difficulty']==tier for t in targets),6)
            if index['mode']=='alpine-valleys':self.assertTrue({'FR','AT','IT','CH'}<={c for t in targets for c in t['countries']})
            regions={r['id']:r for r in manifest['regions']}
            for t in targets:
                self.assertTrue(t['provenance']['reviewed']);self.assertTrue(t['provenance']['license'])
                self.assertNotRegex(t['name'],r'^Q[0-9]+$');self.assertTrue(t['wikipedia'])
                refs=[{'id':t['id'],'geometryRef':t['geometryRef'],'displayGeometryRef':t['displayGeometryRef']}] if t['kind']=='valley' else [regions[id_] for id_ in t['regionIds']]
                self.assertTrue(refs)
                for ref in refs:
                    for key in ['geometryRef','displayGeometryRef']:
                        feature=json.loads((folder/ref[key]).read_text());g=shape(feature['geometry'])
                        self.assertTrue(valid_geometry(g),ref[key]);self.assertEqual(feature['properties']['id'],ref['id'])
                        if key=='geometryRef':self.assertTrue(g.covers(Point(t['position']['lon'],t['position']['lat'])),t['name'])
                if t['kind']=='summit':
                    count=t['provenance']['wikipediaEditions']
                    self.assertGreaterEqual(count,1)
                    default,_=reviewed_difficulty(decisions[t['id']],previous.get(t['id']))
                    override=t['provenance'].get('override',{})
                    self.assertEqual(t['difficulty'],default)
                    if override:self.assertTrue(override['reason'])
    def test_expanded_world_release_matches_reviewed_snapshot(self):
        source=ROOT/'data/processed/world-discovery.json'
        discovery=json.loads(source.read_text());review=json.loads((ROOT/'data/config/world-review.json').read_text())
        self.assertTrue(discovery['complete'])
        self.assertEqual(review['discoverySha256'],hashlib.sha256(source.read_bytes()).hexdigest())
        decisions={r['id']:r for r in review['decisions']}
        self.assertEqual(len(decisions),len(review['decisions']))
        self.assertEqual(set(decisions),{c['id'] for c in discovery['candidates']})
        index=next(i for i in json.loads((ROOT/'data/processed/mode-index.json').read_text()) if i['mode']=='world-peaks')
        manifest=json.loads((ROOT/'public/data'/index['version']/'manifest.json').read_text())
        self.assertEqual({t['id'] for t in manifest['targets']},{id_ for id_,r in decisions.items() if r['include']})
        self.assertGreater(len(manifest['targets']),700)
        self.assertGreater(sum(t['provenance']['featureType']=='volcano' for t in manifest['targets']),200)
        self.assertFalse(decisions['wikidata:Q2611798']['include'])  # North Col: pass.
        self.assertFalse(decisions['wikidata:Q2334182']['include'])  # Cape Fold Belt.
        self.assertTrue((ROOT/'public/data/mode-c21e681de816/manifest.json').exists())
        by_id={c['id']:c for c in discovery['candidates']}
        preserved=json.loads((ROOT/'public/data'/review['preserveVersion']/'manifest.json').read_text())
        previous={t['id']:t for t in preserved['targets']}
        for t in manifest['targets']:
            self.assertEqual(t['provenance']['admissionPolicy'],POLICY)
            self.assertEqual(validate_admission(by_id[t['id']],decisions[t['id']],previous),t['provenance']['admissionRoute'])
        baseline=json.loads((ROOT/'public/data'/review['baselineVersion']/'manifest.json').read_text())
        current={t['id']:t for t in manifest['targets']}
        for old in baseline['targets']:
            for field in ['position','difficulty','regionIds','name']:
                self.assertEqual(current[old['id']][field],old[field])
        for region in baseline['regions']:
            for field in ['geometryRef','displayGeometryRef']:
                original=(ROOT/'public/data'/review['baselineVersion']/region[field]).read_bytes()
                published=(ROOT/'public/data'/index['version']/region[field]).read_bytes()
                self.assertEqual(hashlib.sha256(original).digest(),hashlib.sha256(published).digest())

    def test_coverage_includes_all_source_regions_and_accounts_for_targets(self):
        audit=json.loads((ROOT/'data/processed/world-coverage.json').read_text())
        self.assertEqual(len(audit['regions']),291)
        self.assertEqual(sum(r['included'] for r in audit['regions']),audit['after']['targets'])
        self.assertTrue(any(r['included']==0 for r in audit['regions']))
        expected=[r['id'] for r in sorted(audit['regions'],key=lambda r:(r['included'],r['id'])) if r['included']<20 and r['validGeometry']]
        self.assertEqual(audit['reviewQueue'],expected)
        self.assertGreater(next(r for r in audit['regions'] if r['id']=='gmba:13064')['included'],16)
        domains={d['name']:d for d in audit['domains']}
        for name in ['Africa','Asia','Europe','North America','South America','Oceania']:
            self.assertGreater(domains[name]['added'],0,name)
        self.assertEqual(sum(d['included'] for d in audit['domains']),audit['after']['targets'])
        self.assertEqual(sum(d['added'] for d in audit['domains']),audit['after']['targets']-audit['previous']['targets'])

    def test_global_batch_is_explicit_and_keeps_ambiguous_identities_held(self):
        batch=json.loads((ROOT/'data/config/world-global-batch.json').read_text())
        review=json.loads((ROOT/'data/config/world-review.json').read_text())
        decisions={d['id']:d for d in review['decisions']}
        previous=json.loads((ROOT/'public/data'/review['preserveVersion']/'manifest.json').read_text())
        old={t['id'] for t in previous['targets']}
        self.assertEqual(set(batch['approvedIds']),{d['id'] for d in decisions.values() if d['include'] and d['id'] not in old})
        self.assertEqual(len(batch['approvedIds']),len(set(batch['approvedIds'])))
        for id_ in batch['heldSourceMatches']:self.assertFalse(decisions[id_]['include'],id_)
        for id_ in batch['approvedIds']:
            e=decisions[id_]['evidence']
            if e['category']=='topographic-prominence':
                v=e['coordinateVerification']
                self.assertLessEqual(distance_m(v['position'],v['referencePosition']),300)
                self.assertEqual(e['sourceSha256'],batch['sourceSha256'])
        self.assertEqual(decisions['wikidata:Q1895254']['difficultyReview']['tier'],'medium')
    def test_valley_report_agrees_with_release_gate(self):
        report=json.loads((ROOT/'data/processed/alpine-valleys-report.json').read_text())
        ready=all(report['counts'][tier]>=6 for tier in ['easy','medium','hard']) and {'CH','FR','IT','AT'}<=set(report['countries'])
        self.assertEqual(report['ready'],ready)
        indexes=json.loads((ROOT/'data/processed/mode-index.json').read_text())
        self.assertEqual(any(i['mode']=='alpine-valleys' for i in indexes),ready)
    def test_no_invented_or_ambiguous_coordinates(self):
        self.assertIsNone(coordinates({'claims':{}}))
        def claim(lon,globe='Q2'):
            return {'rank':'normal','mainsnak':{'snaktype':'value','datavalue':{'value':{'longitude':lon,'latitude':46,'globe':'http://www.wikidata.org/entity/'+globe}}}}
        self.assertIsNone(coordinates({'claims':{'P625':[claim(7),claim(8)]}}))
        self.assertIsNone(coordinates({'claims':{'P625':[claim(7,'Q111')]}}))
        self.assertEqual(coordinates({'claims':{'P625':[claim(7)]}}),{'lon':7,'lat':46})

if __name__=='__main__':unittest.main()
