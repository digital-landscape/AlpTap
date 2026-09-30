import unittest
from shapely.geometry import Polygon,Point
from prepare import import_sections, countries_for, difficulty, numeric
class GeographyTests(unittest.TestCase):
    def test_actual_hierarchy_and_multipart(self):
        geoms,units,issues=import_sections()
        sections=[u for u in units if u['level']=='section']
        self.assertEqual(len(sections),36)
        self.assertEqual(len(next(u for u in units if u['id']=='SZ.36')['sourceFeatures']),3)
        self.assertIn('aux:klagenfurt-basin',geoms)
        self.assertEqual(next(u for u in units if u['id']=='SZ.14')['parentId'],'western-alps')
        self.assertEqual(next(u for u in units if u['id']=='SZ.15')['parentId'],'eastern-alps')
        self.assertTrue(geoms['SZ.9'].covers(Point(7.6586,45.9763)))
        self.assertTrue(geoms['SZ.17'].covers(Point(12.6939,47.0745)))
        self.assertTrue(all(g.is_valid for g in geoms.values()))
    def test_country_shared_border(self):
        countries={'AT':Polygon([(0,0),(1,0),(1,1),(0,1)]),'IT':Polygon([(1,0),(2,0),(2,1),(1,1)])}
        self.assertEqual(countries_for(Point(1,.5),countries)[0],['AT','IT'])
        confirmed,near=countries_for(Point(.9995,.5),countries)
        self.assertEqual(confirmed,['AT']);self.assertEqual(near,['IT'])
    def test_difficulty_missing_and_notoriety(self):
        base={'density':.5,'similarDensity':.5,'elevation':.7,'notoriety':0,'prominence':None,'isolation':None}
        self.assertGreater(difficulty(base),difficulty({**base,'notoriety':1}))
        self.assertEqual(difficulty({}),50)
        self.assertEqual(difficulty(base),difficulty(base))
    def test_numeric(self):
        self.assertEqual(numeric('4478 m'),4478)
        self.assertIsNone(numeric('unknown'));self.assertIsNone(numeric('nan'))
if __name__=='__main__': unittest.main()
