import { useState } from 'react';
import { SCORING } from '../core/config';
import { scoreWithSection, type ScoringProfile } from '../core/scoring';
import { interactionMessages } from '../core/interaction-i18n';
import type { Locale } from '../core/types';
export function ScoringCurve({locale,profile=SCORING.alpine}: {locale: Locale;profile?:ScoringProfile}) {
  const [fraction, setFraction] = useState(1/6);
  const distance = fraction * profile.farDistanceKm;
  const number = (n:number) => new Intl.NumberFormat(locale,{maximumFractionDigits:3}).format(n);
  const t = interactionMessages[locale];
  const limit = profile.farDistanceKm;
  const x = (km: number) => 34 + km / limit * 300, y = (points: number) => 148 - points * .12;
  const path = (section: boolean) => Array.from({length:201},(_,i)=>`${i?'L':'M'}${x(i*limit/200)},${y(scoreWithSection(i*limit/200,section,profile).score)}`).join(' ');
  return <section className="scoring-curve">
    <h3>{t.curveTitle}</h3><p className="score-formula">1,000 × e<sup>−ln(100) × (max(0, km − {number(profile.perfectRadiusKm)}) / {number(limit - profile.perfectRadiusKm)})<sup>1.5</sup></sup></p>
    <svg viewBox="0 0 350 175" role="img" aria-label={t.curveTitle}>
      {[0,500,1000].map(n=><g key={n}><line x1="34" y1={y(n)} x2="334" y2={y(n)} stroke="#dfe5d7"/><text x="28" y={y(n)+3} textAnchor="end">{n}</text></g>)}
      {[0,.25,.5,.75,1].map(f=>f*limit).map(n=><text key={n} x={x(n)} y="166" textAnchor="middle">{number(n)} km</text>)}
      <path d={path(false)} fill="none" stroke="#819083" strokeWidth="2"/>
      <path d={path(true)} fill="none" stroke="#598344" strokeWidth="2.5"/>
      <line x1={x(distance)} x2={x(distance)} y1="20" y2="148" stroke="#9eaa96" strokeDasharray="3 3"/>
      {[false,true].map(section=><circle key={String(section)} cx={x(distance)} cy={y(scoreWithSection(distance,section,profile).score)} r="4" fill={section?'#598344':'#819083'}/>)}
    </svg>
    <label><span>{number(distance)} km</span><input aria-label={t.curveTitle} type="range" min="0" max={limit} step={limit/300} value={distance} onChange={event=>setFraction(Number(event.target.value)/limit)}/></label>
    <div className="curve-values"><span>{t.curveDistance}<b>{scoreWithSection(distance,false,profile).score}</b></span><span>{t.curveSection}<b>{scoreWithSection(distance,true,profile).score}</b></span></div>
    <p>{t.curveHint}</p>
  </section>;
}
