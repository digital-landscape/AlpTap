import unittest
from shapely.geometry import Polygon
from wikidata_peaks import build_peak, coordinate, quantity

def row(field,value,lang=None,unit=None):
    r={'field':{'value':field},'value':{'value':value}}
    if lang:r['value']['xml:lang']=lang
    if unit:r['unit']={'value':'http://www.wikidata.org/entity/'+unit}
    return r

class WikidataTests(unittest.TestCase):
    def setUp(self):
        self.geoms={'SZ.9':Polygon([(7,45),(8,45),(8,47),(7,47)]),'aux:klagenfurt-basin':Polygon([(0,0),(1,0),(1,1),(0,1)])}
    def test_primary_identity_coordinates_names_and_border_countries(self):
        rows=[row('label','Matterhorn','de'),row('label','Cervino','it'),row('P17','http://www.wikidata.org/entity/Q39'),row('P17','http://www.wikidata.org/entity/Q38'),row('P2044','4478',unit='Q11573'),row('article','https://it.wikipedia.org/wiki/Cervino')]
        p=build_peak('Q1374',{'Point(7.6586 45.9764)'},rows,self.geoms,[])
        self.assertEqual(p['id'],'wikidata:Q1374');self.assertEqual(p['countries'],['CH','IT'])
        self.assertEqual(p['names']['it'],'Cervino');self.assertEqual(p['elevation'],4478)
        self.assertEqual(p['wikipedia']['it'],'https://it.wikipedia.org/wiki/Cervino')
        self.assertEqual(p['soiusa']['regionIds'],['alps','western-alps'])
        self.assertEqual(p['provenance']['source'],'Wikidata')
    def test_missing_optional_metadata(self):
        p=build_peak('Q1',{'Point(7.5 46)'},[row('label','Peak','en')],self.geoms,[])
        self.assertIsNone(p['elevation']);self.assertIsNone(p['prominence']);self.assertEqual(p['countries'],[])
    def test_conflicting_coordinates_excluded(self):
        issues=[]
        self.assertIsNone(build_peak('Q1',{'Point(7.5 46)','Point(7.6 46)'},[],self.geoms,issues))
        self.assertEqual(issues[0]['type'],'ambiguous-coordinate')
        self.assertIsNone(coordinate('Point(181 91)'))
    def test_units_and_conflicting_quantities(self):
        self.assertEqual(quantity([row('P2659','2',unit='Q828224')],'P2659',[],'Q1',10000),2000)
        issues=[]
        self.assertIsNone(quantity([row('P2044','100',unit='Q11573'),row('P2044','200',unit='Q11573')],'P2044',issues,'Q1',5000))
        self.assertEqual(issues[0]['type'],'ambiguous-quantity')
