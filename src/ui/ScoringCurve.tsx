import { useState } from 'react';
import { scoreWithSection } from '../core/scoring';
import { interactionMessages } from '../core/interaction-i18n';
import type { Locale } from '../core/types';
export function ScoringCurve({locale}: {locale: Locale}) {
  const [distance, setDistance] = useState(50);
  const t = interactionMessages[locale];
  const x = (km: number) => 34 + km * 1.5, y = (points: number) => 148 - points * .12;
  const path = (section: boolean) => Array.from({length:101},(_,i)=>`${i?'L':'M'}${x(i*2)},${y(scoreWithSection(i*2,section).score)}`).join(' ');
  return <section className="scoring-curve">
    <h3>{t.curveTitle}</h3><p className="score-formula">1,000 × e<sup>−km / 50</sup></p>
    <svg viewBox="0 0 350 175" role="img" aria-label={t.curveTitle}>
      {[0,500,1000].map(n=><g key={n}><line x1="34" y1={y(n)} x2="334" y2={y(n)} stroke="#dfe5d7"/><text x="28" y={y(n)+3} textAnchor="end">{n}</text></g>)}
      {[0,50,100,150,200].map(n=><text key={n} x={x(n)} y="166" textAnchor="middle">{n} km</text>)}
      <path d={path(false)} fill="none" stroke="#819083" strokeWidth="2"/>
      <path d={path(true)} fill="none" stroke="#598344" strokeWidth="2.5"/>
      <line x1={x(distance)} x2={x(distance)} y1="20" y2="148" stroke="#9eaa96" strokeDasharray="3 3"/>
      {[false,true].map(section=><circle key={String(section)} cx={x(distance)} cy={y(scoreWithSection(distance,section).score)} r="4" fill={section?'#598344':'#819083'}/>)}
    </svg>
    <label><span>{distance} km</span><input aria-label={t.curveTitle} type="range" min="0" max="200" value={distance} onChange={event=>setDistance(Number(event.target.value))}/></label>
    <div className="curve-values"><span>{t.curveDistance}<b>{scoreWithSection(distance,false).score}</b></span><span>{t.curveSection}<b>{scoreWithSection(distance,true).score}</b></span></div>
    <p>{t.curveHint}</p>
  </section>;
}
