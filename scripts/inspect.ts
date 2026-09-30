import { readFileSync } from 'node:fs';
import { generateChallenge } from '../src/core/challenge';
import { viennaDate } from '../src/core/date';
import type { Peak, PeakIndex } from '../src/core/types';
const report=JSON.parse(readFileSync('data/processed/report.json','utf8'));
const peaks=JSON.parse(readFileSync('data/processed/peaks.json','utf8')) as Peak[];
const index=JSON.parse(readFileSync('data/processed/api-index.json','utf8')) as {version:string;peaks:PeakIndex[]};
const argument=process.argv[2];
if(argument){const matches=peaks.filter(p=>p.id===argument||p.name.toLowerCase().includes(argument.toLowerCase()));console.log(JSON.stringify(matches.slice(0,20),null,2));}
else {const counts=(values:string[])=>Object.fromEntries([...new Set(values)].sort().map(v=>[v,values.filter(s=>s===v).length]));console.log(JSON.stringify({version:report.version,peakCount:peaks.length,pools:report.counts,countries:report.countries,sections:counts(peaks.flatMap(p=>p.soiusa.sectionIds)),missingElevation:report.missingElevation,missingLocalizedNames:report.missingLocalizedNames,difficultyBands:report.difficultyBands,issueTypes:counts(report.issues.map((i:{type:string})=>i.type)),today:generateChallenge(index.peaks,{date:viennaDate(),region:'alps',difficulty:'mixed',datasetVersion:index.version}),examples:report.representativePeaks},null,2));}
