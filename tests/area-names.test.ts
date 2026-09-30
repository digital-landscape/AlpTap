import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import catalogue from '../data/config/area-names.json';
import {getAreaName} from '../src/core/area-names';
import type {GeographicUnit} from '../src/core/types';
describe('permanent area name catalogue',()=>{
 it('covers every actual geographic unit in all four languages without replacing original names',()=>{
  const units=JSON.parse(readFileSync('data/processed/hierarchy.json','utf8')) as GeographicUnit[];
  expect(Object.keys(catalogue.records)).toHaveLength(40);
  for(const unit of units){
   const entry=(catalogue.records as Record<string,{original:string;names:Record<string,string>;source:string}>)[unit.id];
   expect(entry.original).toBe(unit.name);
   for(const language of ['en','de','fr','it'])expect(entry.names[language].trim().length).toBeGreaterThan(0);
   expect(entry.source.length).toBeGreaterThan(0);
  }
 });
 it('keeps the source name and appends the selected language, also with an old cached manifest',()=>{
  expect(getAreaName('SZ.32','en-GB',{name:'Prealpi Venete',names:{}})).toBe('Prealpi Venete (Venetian Prealps)');
  expect(getAreaName('SZ.32','fr')).toBe('Prealpi Venete (Préalpes vénitiennes)');
  expect(getAreaName('SZ.32','it')).toBe('Prealpi Venete');
 });
 it('preserves original spelling and safely falls back for unknown areas/languages',()=>{
  expect(getAreaName('SZ.19','en')).toBe('Steirische-Kärntnerishe Alpen (Carinthian-Styrian Alps)');
  expect(getAreaName('SZ.32','xx')).toBe('Prealpi Venete');
  expect(getAreaName('future','en',{name:'Recorded area',names:{en:'English area'}})).toBe('Recorded area (English area)');
  expect(getAreaName('unknown','en')).toBe('unknown');
 });
});
