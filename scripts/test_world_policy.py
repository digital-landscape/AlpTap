import copy
import unittest
from shapely.geometry import box
from world_policy import validate_admission,reviewed_difficulty
from world_coverage import coverage_audit


class WorldPolicyTests(unittest.TestCase):
    def setUp(self):
        self.candidate = {'id': 'wikidata:Q1', 'name': 'Peak', 'wikipedia': {'es': 'https://es.wikipedia.org/wiki/Pico'},
                          'wikipediaEditions': 1, 'checks': [], 'position': {'lon': 1, 'lat': 2},
                          'gmbaRegions': [{'id': 'gmba:1'}]}
        self.decision = {'include': True, 'reason': 'Reviewed summit', 'admissionRoute': 'regional-significance',
                         'evidence': {'category': 'climbing-objective', 'rationale': 'Documented summit routes',
                                      'sources': [{'url': 'https://example.org/guide', 'title': 'Guide', 'type': 'specialist'}],
                                      'coordinateVerification': {'position': {'lon': 1, 'lat': 2},
                                                                 'sourceUrl': 'https://example.org/map', 'method': 'Compared summit coordinates'}}}

    def test_local_language_only_candidate_with_evidence(self):
        self.assertEqual(validate_admission(self.candidate, self.decision), 'regional-significance')
        self.candidate['checks'] = ['fewer-than-20-wikipedia-editions']
        self.assertEqual(validate_admission(self.candidate, self.decision), 'regional-significance')

    def test_evidence_and_coordinate_verification_required(self):
        for key in ['category', 'rationale', 'sources', 'coordinateVerification']:
            with self.subTest(key=key):
                decision = copy.deepcopy(self.decision)
                del decision['evidence'][key]
                with self.assertRaises(ValueError): validate_admission(self.candidate, decision)
        self.candidate['position']['lat'] = 3
        with self.assertRaisesRegex(ValueError, 'coordinates'): validate_admission(self.candidate, self.decision)

    def test_no_geometry_or_article_bypass(self):
        for field, value in [('checks', ['unresolved-gmba-region']), ('position', None),
                             ('gmbaRegions', []), ('wikipedia', {}), ('wikipediaEditions', 2),
                             ('position', {'lon': float('nan'), 'lat': 2}), ('position', {'lon': 181, 'lat': 2}),
                             ('id', 'wikidata:invalid'),
                             ('wikipedia', {'es': 'https://evil.org/.wikipedia.org/wiki/Pico'})]:
            with self.subTest(field=field):
                candidate = copy.deepcopy(self.candidate); candidate[field] = value
                with self.assertRaises(ValueError): validate_admission(candidate, self.decision)

    def test_translation_count_is_not_an_admission_route(self):
        decision = {'include': True, 'reason': 'Reviewed', 'admissionRoute': 'international-recognition'}
        with self.assertRaisesRegex(ValueError, 'Unknown'): validate_admission(self.candidate, decision)
        self.candidate['wikipedia'] = {str(i): 'https://en.wikipedia.org/wiki/Peak' for i in range(20)}
        self.candidate['wikipediaEditions'] = 20
        with self.assertRaisesRegex(ValueError, 'Unknown'): validate_admission(self.candidate, decision)

    def test_legacy_cannot_be_used_to_admit_new_identities(self):
        decision={'include':True,'reason':'Preserved','admissionRoute':'legacy-reviewed'}
        with self.assertRaisesRegex(ValueError,'preserved'):validate_admission(self.candidate,decision)
        self.assertEqual(validate_admission(self.candidate,decision,{'wikidata:Q1'}),'legacy-reviewed')

    def test_difficulty_requires_an_independent_assessment(self):
        with self.assertRaisesRegex(ValueError,'assessment'):reviewed_difficulty(self.decision)
        self.decision['difficultyReview']={'tier':'medium','rationale':'Named regional high point and visitor landmark','sources':['https://example.org/park']}
        self.assertEqual(reviewed_difficulty(self.decision)[0],'medium')
        self.assertEqual(validate_admission(self.candidate,self.decision),'regional-significance')  # One article is sufficient.
        self.decision['difficultyReview']['sources']=[]
        with self.assertRaisesRegex(ValueError,'sources'):reviewed_difficulty(self.decision)
        self.assertEqual(reviewed_difficulty(self.decision,{'difficulty':'easy'})[0],'easy')

    def test_prominence_does_not_replace_other_significance_routes(self):
        self.decision['evidence']['category']='topographic-prominence'
        with self.assertRaisesRegex(ValueError,'1500'):validate_admission(self.candidate,self.decision)
        self.decision['evidence']['prominenceMeters']=1600
        self.assertEqual(validate_admission(self.candidate,self.decision),'regional-significance')
        self.decision['evidence']['category']='landmark'
        self.decision['evidence']['prominenceMeters']=200
        self.assertEqual(validate_admission(self.candidate,self.decision),'regional-significance')

    def test_audit_includes_zero_regions_and_stable_review_queue(self):
        shapes = [({'GMBA_V2_ID': i, 'MapName': str(i)}, box(0, 0, 2, 2)) for i in [3, 2, 1]]
        targets = [{'id': 'wikidata:Q1', 'regionIds': ['gmba:1'], 'difficulty': 'hard'}]
        audit = coverage_audit(shapes, [self.candidate], {'wikidata:Q1': self.decision}, targets, [], ['gmba:1'])
        self.assertEqual(len(audit['regions']), 3)
        self.assertEqual(audit['reviewQueue'], ['gmba:2', 'gmba:3', 'gmba:1'])
        self.assertEqual(audit['after']['targets'], 1)


if __name__ == '__main__': unittest.main()
