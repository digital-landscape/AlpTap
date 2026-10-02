import unittest
from audit_osm import compare, distance, indices, valid


class CoordinateAuditTests(unittest.TestCase):
    def setUp(self):
        self.target = {'id': 'wikidata:Q1', 'name': 'Piz Éxample', 'lat': 46, 'lon': 8, 'modes': ['alpine-peaks']}

    def node(self, id=1, lon=8, **tags):
        return {'type': 'node', 'id': id, 'lat': 46, 'lon': lon, 'tags': {'natural': 'peak', **tags}}

    def run_match(self, elements, available=True):
        return compare(self.target, *indices(elements), available)

    def test_identity_match_can_find_large_error(self):
        r = self.run_match([self.node(lon=10, wikidata='Q1', name='Different name')])
        self.assertEqual(r['matchMethod'], 'wikidata-id')
        self.assertEqual(r['status'], 'over-1km')

    def test_names_are_candidates_and_explicit_conflicts_are_excluded(self):
        r = self.run_match([self.node(name='Piz Example')])
        self.assertEqual(r['matchMethod'], 'name-within-10km')
        self.assertEqual(r['status'], 'within-100m')
        self.assertEqual(self.run_match([self.node(name='Piz Example', wikidata='Q2')])['status'], 'unmatched')
        self.assertEqual(self.run_match([self.node(lon=9, name='Piz Example')])['status'], 'unmatched')

    def test_multiple_nodes_are_ambiguous_not_nearest_wins(self):
        self.assertEqual(self.run_match([self.node(wikidata='Q1'), self.node(id=2, lon=8.01, wikidata='Q1')])['status'], 'ambiguous')

    def test_duplicate_cache_records_are_deduplicated(self):
        n = self.node(wikidata='Q1')
        self.assertEqual(self.run_match([n, n])['status'], 'within-100m')

    def test_way_center_is_not_a_summit(self):
        w = {'type': 'way', 'id': 2, 'center': {'lat': 46, 'lon': 8}, 'tags': {'wikidata': 'Q1'}}
        r = self.run_match([w, self.node(name='Piz Example')])
        self.assertEqual(r['status'], 'non-point-only')
        self.assertEqual(r['candidates'], [])

    def test_incomplete_sources_are_not_missing_summits(self):
        self.assertEqual(self.run_match([], False)['status'], 'source-unavailable')
        with self.assertRaises(ValueError):
            valid({'elements': [], 'remark': 'runtime timeout'})

    def test_distance_across_dateline(self):
        self.assertAlmostEqual(distance({'lat': 0, 'lon': 179.999}, {'lat': 0, 'lon': -179.999}), 222.39, places=1)


if __name__ == '__main__':
    unittest.main()
