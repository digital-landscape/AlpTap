import catalogue from '../../data/config/area-names.json';
import type { GeographicUnit } from './types';
type AreaName = {original:string; names:Record<string,string>};
const records:Record<string,AreaName>=catalogue.records;
/** Static, source-backed labels also work with manifests cached before localization. */
export function getAreaName(id:string, locale:string, unit?:Pick<GeographicUnit,'name'|'names'>):string {
  const record=records[id];
  const original=unit?.name||record?.original||id;
  const language=locale.toLowerCase().split('-')[0];
  const translated=record?.names[language]||unit?.names[language];
  return translated && translated.trim().toLocaleLowerCase()!==original.trim().toLocaleLowerCase()
    ? `${original} (${translated})` : original;
}
