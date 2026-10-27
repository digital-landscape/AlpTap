import type {Locale} from '../core/types';
import {cloudless} from '../map/config';

const label: Record<Locale, string> = {en: 'Satellite imagery', de: 'Satellitenbilder', fr: 'Images satellites', it: 'Immagini satellitari'};

// The credit itself stays in English: it is EOX's required attribution wording.
export function ImageryCredit({locale}: {locale: Locale}) {
  return <p className="imagery-credit">{label[locale]}{locale === 'fr' ? ' : ' : ': '}<span lang="en">EOxCloudless <a href={cloudless.url} target="_blank" rel="noreferrer">{cloudless.url}</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data {cloudless.year})</span></p>;
}
