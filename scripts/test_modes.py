"""Validate published mode assets without network access or raw download caches."""
import json,unittest,hashlib
from pathlib import Path
from shapely.geometry import shape,Point
from prepare_modes import coordinates,valid_geometry
ROOT=Path(__file__).resolve().parents[1]

class ModeDataTests(unittest.TestCase):
    def test_published_catalogues(self):
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
                    count=t['provenance']['wikipediaEditions'];self.assertGreaterEqual(count,20)
                    default='easy' if count>=60 else 'medium' if count>=35 else 'hard'
                    override=t['provenance'].get('override',{})
                    self.assertEqual(t['difficulty'],override.get('tier',default))
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
