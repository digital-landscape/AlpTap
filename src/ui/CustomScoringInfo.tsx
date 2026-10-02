import {customMessages} from '../core/custom-i18n';
import type {ScoringProfile} from '../core/scoring';
import type {Locale} from '../core/types';

export function CustomScoringInfo({locale,scoring,areaKm2}:{locale:Locale;scoring:ScoringProfile;areaKm2?:number}) {
  const t=customMessages[locale];
  const number=(n:number)=>new Intl.NumberFormat(locale,{maximumFractionDigits:3}).format(n);
  return <>
    {areaKm2!==undefined&&<p>{t.area}: <b>{number(areaKm2)} km²</b></p>}
    <p>{t.scoring}</p>
    <p>{t.fullPoints}: <b>{number(scoring.perfectRadiusKm)} km</b><br/>{t.farPoints}: <b>{number(scoring.farDistanceKm)} km</b></p>
  </>;
}
