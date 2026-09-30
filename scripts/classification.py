"""Versioned recognition bands, independent of the relative size of the catalogue."""
import json
from pathlib import Path
RULES=json.loads((Path(__file__).resolve().parents[1]/'data/config/difficulty.json').read_text())

def classify_peak(peak):
    editions=len(peak.get('wikipedia',{}))
    score=peak['difficulty']['score']
    prominence=peak.get('prominence');isolation=peak.get('isolation')
    easy=RULES['easy'];medium=RULES['medium']
    def distinct(rule):
        return (prominence is not None and prominence>=rule['minimumProminenceM']) or (isolation is not None and isolation>=rule['minimumIsolationKm'])
    if editions>=easy['widelyDocumentedEditions']:
        return 'easy', ['widely-documented-across-languages']
    if editions>=easy['minimumEditions'] and distinct(easy) and score<=easy['maximumScore']:
        return 'easy', ['multilingual-recognition','prominent-or-isolated','low-identification-score']
    if editions>=medium['minimumEditions'] and score<=medium['maximumScore'] and (editions>=medium['multipleEditions'] or distinct(medium)):
        return 'medium', ['wikipedia-documented','regional-recognition-or-distinctness','moderate-identification-score']
    return 'hard', ['documented-wikidata-summit','limited-recognition-or-high-identification-score']
