/** NOAA fractional-year solar position; longitude east, UTC milliseconds. */
export function solarPosition(latitude: number, longitude: number, utcMs: number) {
  const date = new Date(utcMs), year = date.getUTCFullYear(), start = Date.UTC(year, 0, 1);
  const days = (Date.UTC(year + 1, 0, 1) - start) / 86400000;
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const gamma = 2 * Math.PI / days * (Math.floor((utcMs - start) / 86400000) + (hour - 12) / 24);
  const equation = 229.18 * (.000075 + .001868 * Math.cos(gamma) - .032077 * Math.sin(gamma) - .014615 * Math.cos(2 * gamma) - .040849 * Math.sin(2 * gamma));
  const declination = .006918 - .399912 * Math.cos(gamma) + .070257 * Math.sin(gamma) - .006758 * Math.cos(2 * gamma) + .000907 * Math.sin(2 * gamma) - .002697 * Math.cos(3 * gamma) + .00148 * Math.sin(3 * gamma);
  const rad = Math.PI / 180, angle = (hour * 15 + equation / 4 + longitude - 180) * rad, lat = latitude * rad;
  const east = -Math.cos(declination) * Math.sin(angle);
  const north = Math.cos(lat) * Math.sin(declination) - Math.sin(lat) * Math.cos(declination) * Math.cos(angle);
  const up = Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(angle);
  return { azimuth: (Math.atan2(east, north) / rad + 360) % 360, altitude: Math.asin(Math.max(-1, Math.min(1, up))) / rad, direction: [east, north, up] as [number, number, number] };
}
