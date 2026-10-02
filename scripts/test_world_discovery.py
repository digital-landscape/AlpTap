import json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from shapely.geometry import box
import discover_world as world

class WorldDiscoveryTests(unittest.TestCase):
    def test_global_prominence_search_has_no_language_filter(self):
        with tempfile.TemporaryDirectory() as folder:
            def response(url,path,*args):
                data={'results':{'bindings':[{'item':{'value':'http://www.wikidata.org/entity/Q1'}}]}}
                path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data));return data
            with patch.object(world,'DISCOVERY',Path(folder)),patch.object(world,'request_json',side_effect=response):
                found,queries=world.discover_prominent(1500,True)
            self.assertEqual(found,{'Q1':['mountain']})
            self.assertIn('P2660',queries[0]['query'])
            self.assertNotIn('sitelinks',queries[0]['query'])
            self.assertNotIn('LIMIT',queries[0]['query'])
        with self.assertRaises(ValueError):world.discover_prominent(0,True)

    def test_candidate_difficulty_is_not_suggested_from_translations(self):
        entity={'labels':{},'claims':{},'sitelinks':{str(i)+'wiki':{'url':f'https://en.wikipedia.org/wiki/Peak_{i}'} for i in range(80)}}
        self.assertIsNone(world.candidate_record('Q1',entity,['mountain'],[])['suggestedTier'])

    def test_geographic_discovery_has_no_recognition_floor_and_deduplicates(self):
        with tempfile.TemporaryDirectory() as folder:
            def response(url,path,*args):
                data={'results':{'bindings':[{'item':{'value':'http://www.wikidata.org/entity/Q1'},'kind':{'value':kind}} for kind in ['mountain','volcano']]}}
                path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data));return data
            with patch.object(world,'DISCOVERY',Path(folder)),patch.object(world,'request_json',side_effect=response):
                found,queries=world.discover_regions([({'GMBA_V2_ID':1},box(1,1,12,12))],['gmba:1'],True)
            self.assertEqual(found,{'Q1':['mountain','volcano']})
            self.assertEqual(len(queries),4)
            self.assertTrue(all('sitelinks' not in q['query'] and 'LIMIT' not in q['query'] for q in queries))

    def test_geographic_empty_response_is_valid_but_malformed_is_not(self):
        ranges=[({'GMBA_V2_ID':1},box(1,1,2,2))]
        with tempfile.TemporaryDirectory() as folder:
            def response(url,path,*args):
                path.parent.mkdir(parents=True,exist_ok=True);path.write_text('{}')
                return {'results':{'bindings':[]}}
            with patch.object(world,'DISCOVERY',Path(folder)),patch.object(world,'request_json',side_effect=response):
                self.assertEqual(world.discover_regions(ranges,['gmba:1'],True)[0],{})
            with patch.object(world,'request_json',return_value={}):
                with self.assertRaisesRegex(ValueError,'Incomplete'):world.discover_regions(ranges,['gmba:1'],True)

    def test_failed_expansion_preserves_snapshot(self):
        with tempfile.TemporaryDirectory() as folder:
            snapshot=Path(folder)/'world-discovery.json';snapshot.write_text('{"complete":true,"candidates":[]}')
            before=snapshot.read_bytes()
            with patch.object(world,'OUT',Path(folder)),patch.object(world,'unpack',side_effect=RuntimeError('unavailable')):
                with self.assertRaises(RuntimeError):world.expand_regions(['gmba:1'],True)
            self.assertEqual(snapshot.read_bytes(),before)
            self.assertFalse(json.loads((Path(folder)/'world-regional-discovery-status.json').read_text())['complete'])

    def test_completed_expansion_is_resumable_and_retains_existing_records(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'source.shp').touch()
            snapshot=root/'world-discovery.json'
            old={'id':'wikidata:Q1','wikipedia':{'en':'https://en.wikipedia.org/wiki/Old'},'wikipediaEditions':20,
                 'position':{'lon':1,'lat':1},'gmbaRegions':[{'id':'gmba:1'}],'discoveredAs':['mountain']}
            snapshot.write_text(json.dumps({'complete':True,'candidates':[old],'queries':[]}))
            new={**old,'id':'wikidata:Q2','wikipediaEditions':1}
            ranges=[({'GMBA_V2_ID':1},box(0,0,2,2))]
            with patch.object(world,'OUT',root),patch.object(world,'unpack',return_value=root),\
                 patch.object(world,'read_shapes',return_value=ranges),\
                 patch.object(world,'discover_regions',return_value=({'Q1':['mountain'],'Q2':['mountain']},[{'sha256':'recorded-batch'}])),\
                 patch.object(world,'enrich',side_effect=[{'Q2':{}},{}]) as enrich,\
                 patch.object(world,'candidate_record',return_value=new):
                world.expand_regions(['gmba:1'],True);first=snapshot.read_bytes()
                world.expand_regions(['gmba:1'],True)
            self.assertEqual(first,snapshot.read_bytes())
            self.assertEqual(json.loads(first)['candidates'][0],old)
            self.assertEqual(enrich.call_args_list[0].args[0],['Q2'])
            self.assertEqual(enrich.call_args_list[1].args[0],[])

    def test_discovers_and_deduplicates_both_classes_without_limit(self):
        with tempfile.TemporaryDirectory() as folder:
            def response(url,path,*args):
                ids=['Q1','Q2'] if 'mountain' in str(path) else ['Q2','Q3']
                data={'results':{'bindings':[{'item':{'value':'http://www.wikidata.org/entity/'+qid}} for qid in ids]}}
                Path(path).write_text(json.dumps(data));return data
            with patch.object(world,'DISCOVERY',Path(folder)),patch.object(world,'request_json',side_effect=response):
                found,queries=world.discover(True)
            self.assertEqual(found,{'Q1':['mountain'],'Q2':['mountain','volcano'],'Q3':['volcano']})
            self.assertTrue(all('LIMIT' not in q['query'] for q in queries))
    def test_missing_metadata_batch_is_not_complete(self):
        with patch.object(world,'request_json',return_value={'entities':{'Q1':{}}}):
            with self.assertRaisesRegex(ValueError,'incomplete'):world.enrich(['Q1','Q2'],True)
    def test_failed_discovery_records_incomplete_and_does_not_publish(self):
        with tempfile.TemporaryDirectory() as folder:
            with patch.object(world,'OUT',Path(folder)),patch.object(world,'discover',side_effect=RuntimeError('service unavailable')):
                with self.assertRaises(RuntimeError):world.run(True)
            self.assertFalse(json.loads((Path(folder)/'world-discovery-status.json').read_text())['complete'])
            self.assertFalse((Path(folder)/'world-discovery.json').exists())

if __name__=='__main__':unittest.main()
