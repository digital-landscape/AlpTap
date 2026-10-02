import unittest
from review_world_inventory import distance_m, suggest


class WorldInventoryTests(unittest.TestCase):
    def test_distance_wraps_at_dateline(self):
        self.assertLess(distance_m({'lat': 0, 'lon': 179.999}, {'lat': 0, 'lon': -179.999}), 230)

    def test_proximity_is_only_a_suggestion_not_identity_approval(self):
        candidates = [{'id': 'wikidata:Q1', 'name': 'Unresolved range', 'position': {'lat': 1, 'lon': 2},
                       'checks': ['unresolved-gmba-region']}]
        refs = [{'name': 'Different summit', 'position': {'lat': 1, 'lon': 2}}]
        result = suggest(candidates, refs)
        self.assertTrue(result[0]['requiresIdentityReview'])
        self.assertNotIn('include', result[0])
        self.assertEqual(result[0]['checks'], candidates[0]['checks'])
        refs[0]['position']['lat'] = 1.01
        self.assertEqual(suggest(candidates, refs), [])


if __name__ == '__main__': unittest.main()
