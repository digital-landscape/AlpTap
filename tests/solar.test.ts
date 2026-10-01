import { describe, expect, it } from 'vitest';
import { solarPosition } from '../src/map/solar';
describe('current-time solar position',()=>{
 it('puts the equinox noon sun overhead at the equator',()=>{expect(solarPosition(0,0,Date.UTC(2026,2,20,12)).altitude).toBeGreaterThan(87);});
 it('moves from east to west and goes below the horizon at night',()=>{
  const morning=solarPosition(46,10,Date.UTC(2026,5,21,6));
  const evening=solarPosition(46,10,Date.UTC(2026,5,21,17));
  expect(morning.direction[0]).toBeGreaterThan(0);expect(evening.direction[0]).toBeLessThan(0);
  expect(solarPosition(46,10,Date.UTC(2026,5,21,0)).altitude).toBeLessThan(0);
 });
 it('uses the viewed longitude at the same UTC instant',()=>{
  const time=Date.UTC(2026,2,20,6);expect(solarPosition(0,90,time).altitude).toBeGreaterThan(87);
  expect(Math.abs(solarPosition(0,0,time).altitude)).toBeLessThan(3);
 });
});
