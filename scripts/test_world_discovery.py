import json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import discover_world as world

class WorldDiscoveryTests(unittest.TestCase):
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
