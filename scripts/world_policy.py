"""Versioned worldwide admission rules, independent of discovery and difficulty."""
import math
import re
from urllib.parse import urlparse

POLICY = 'world-admission-v3'
SIGNIFICANCE = {'regional-high-point', 'climbing-objective', 'landmark', 'topographic-prominence'}


def source_url(url):
    # Several original specialist inventories are served only over HTTP.
    parsed = urlparse(url)
    return parsed.scheme in {'http', 'https'} and bool(parsed.hostname)


def validate_admission(candidate, decision, legacy_ids=()):
    """Return the explicit route; editorial evidence never bypasses spatial checks."""
    if not re.fullmatch(r'wikidata:Q[1-9][0-9]*', candidate.get('id', '')) or decision.get('include') is not True:
        raise ValueError('Admission requires an explicitly approved Wikidata identity')
    position = candidate.get('position') or {}
    if any(not isinstance(position.get(key), (float, int)) or isinstance(position.get(key), bool) or
           not math.isfinite(position[key]) or abs(position[key]) > limit
           for key, limit in [('lon', 180), ('lat', 85)]):
        raise ValueError('Invalid summit coordinates')
    count = len(candidate['wikipedia'])
    if count != candidate['wikipediaEditions'] or count < 1:
        raise ValueError('At least one real Wikipedia article is required')
    if any(urlparse(url).scheme != 'https' or
           not (urlparse(url).hostname or '').endswith('.wikipedia.org') or
           not urlparse(url).path.startswith('/wiki/') or len(urlparse(url).path) <= 6
           for url in candidate['wikipedia'].values()):
        raise ValueError('Invalid Wikipedia article')
    issues = [issue for issue in candidate['checks'] if issue != 'fewer-than-20-wikipedia-editions']
    if issues or not candidate['position'] or len(candidate['gmbaRegions']) != 1:
        raise ValueError('Review cannot bypass geographic checks')
    route = decision.get('admissionRoute')
    if route == 'legacy-reviewed':
        if candidate['id'] not in legacy_ids:
            raise ValueError('Legacy admission is restricted to the preserved reviewed release')
    elif route == 'regional-significance':
        evidence = decision.get('evidence', {})
        if evidence.get('category') not in SIGNIFICANCE or not evidence.get('rationale', '').strip():
            raise ValueError('Regional significance needs a category and rationale')
        sources = evidence.get('sources', [])
        if not sources or any(not s.get('title', '').strip() or
                              not source_url(s.get('url', '')) or
                              s.get('type') not in {'authoritative', 'specialist'} for s in sources):
            raise ValueError('Regional significance needs authoritative or specialist sources')
        verification = evidence.get('coordinateVerification', {})
        if (verification.get('position') != candidate['position'] or
                not source_url(verification.get('sourceUrl', '')) or
                not verification.get('method', '').strip()):
            raise ValueError('Regional significance needs verified summit coordinates')
        if evidence['category'] == 'topographic-prominence':
            prominence = evidence.get('prominenceMeters')
            if not isinstance(prominence, (int, float)) or not math.isfinite(prominence) or prominence < 1500:
                raise ValueError('Prominence route requires a sourced value of at least 1500 m')
    else:
        raise ValueError('Unknown admission route')
    if not decision.get('reason', '').strip():
        raise ValueError('Admission needs a review reason')
    return route


def reviewed_difficulty(decision, previous=None):
    """Translation counts neither set difficulty nor promote newly admitted peaks."""
    if previous is not None:
        return previous['difficulty'], {'basis': 'preserved-reviewed-tier', 'rationale': 'Retained from the previous reviewed release; not recalculated from language counts.'}
    assessment = decision.get('difficultyReview', {})
    tier = assessment.get('tier')
    if tier not in {'easy', 'medium', 'hard'} or not assessment.get('rationale', '').strip():
        raise ValueError('New targets need an explicit difficulty assessment independent of language counts')
    if tier != 'hard' and (not assessment.get('sources') or not all(source_url(url) for url in assessment['sources'])):
        raise ValueError('Easy/Medium assessments need sources establishing recognition or a clear geographic anchor')
    return tier, assessment
