import unittest
from classification import classify_peak

class RecognitionTests(unittest.TestCase):
    def peak(self, editions=0, score=50, prominence=None, isolation=None):
        return dict(wikipedia={str(i):'article' for i in range(editions)},difficulty={'score':score},prominence=prominence,isolation=isolation)
    def test_famous_dense_summit(self):
        self.assertEqual(classify_peak(self.peak(56,score=60))[0],'easy')
    def test_recognition_and_distinctness(self):
        self.assertEqual(classify_peak(self.peak(8,40,500))[0],'easy')
        self.assertEqual(classify_peak(self.peak(8,40))[0],'medium')
    def test_regional_and_obscure(self):
        self.assertEqual(classify_peak(self.peak(2,60))[0],'medium')
        self.assertEqual(classify_peak(self.peak(1,60,300))[0],'medium')
        self.assertEqual(classify_peak(self.peak(1,60))[0],'hard')
        self.assertEqual(classify_peak(self.peak(2,70))[0],'hard')
    def test_missing_metadata_is_not_evidence(self):
        self.assertEqual(classify_peak(self.peak(0,10))[0],'hard')
        self.assertTrue(classify_peak(self.peak())[1])
