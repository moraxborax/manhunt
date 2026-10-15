import type { LatLng } from '../types/game';

/** Default fallback center: People's Square, Shanghai (上海人民广场, WGS-84) */
export const SHANGHAI_CENTER_WGS84: LatLng = {
  lat: 31.2304,
  lng: 121.4737,
};

const EARTH_RADIUS_M = 6371000;
const KRASOVSKY_A = 6378245.0;
const KRASOVSKY_EE = 0.00669342162296594323;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Great-circle Haversine distance in meters between two coordinates.
 */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Forward azimuth (initial bearing) in degrees [0, 360) from `from` to `to`
 * where 0 = True North, 90 = East.
 */
export function bearingDegrees(from: LatLng, to: LatLng): number {
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLon = toRad(to.lng - from.lng);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

/**
 * Coarse bounding-box check for Mainland China.
 */
export function isInChinaBbox(lat: number, lng: number): boolean {
  return lng >= 72.004 && lng <= 137.8347 && lat >= 0.8293 && lat <= 55.8271;
}

function transformLat(x: number, y: number): number {
  let ret =
    -100.0 +
    2.0 * x +
    3.0 * y +
    0.2 * y * y +
    0.1 * x * y +
    0.2 * Math.sqrt(Math.abs(x));
  ret +=
    ((20.0 * Math.sin(6.0 * x * Math.PI) +
      20.0 * Math.sin(2.0 * x * Math.PI)) *
      2.0) /
    3.0;
  ret +=
    ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) *
      2.0) /
    3.0;
  ret +=
    ((160.0 * Math.sin((y / 12.0) * Math.PI) +
      320 * Math.sin((y * Math.PI) / 30.0)) *
      2.0) /
    3.0;
  return ret;
}

function transformLng(x: number, y: number): number {
  let ret =
    300.0 +
    x +
    2.0 * y +
    0.1 * x * x +
    0.1 * x * y +
    0.1 * Math.sqrt(Math.abs(x));
  ret +=
    ((20.0 * Math.sin(6.0 * x * Math.PI) +
      20.0 * Math.sin(2.0 * x * Math.PI)) *
      2.0) /
    3.0;
  ret +=
    ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) *
      2.0) /
    3.0;
  ret +=
    ((150.0 * Math.sin((x / 12.0) * Math.PI) +
      300.0 * Math.sin((x / 30.0) * Math.PI)) *
      2.0) /
    3.0;
  return ret;
}

function delta(lat: number, lng: number): { dLat: number; dLng: number } {
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - KRASOVSKY_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat =
    (dLat * 180.0) /
    (((KRASOVSKY_A * (1 - KRASOVSKY_EE)) / (magic * sqrtMagic)) * Math.PI);
  dLng =
    (dLng * 180.0) / ((KRASOVSKY_A / sqrtMagic) * Math.cos(radLat) * Math.PI);
  return { dLat, dLng };
}

/**
 * Convert standard GPS WGS-84 coordinates (`navigator.geolocation`) to
 * GCJ-02 ("Mars Coordinates" 火星坐标系) used by AMap (高德地图).
 * Outside Mainland China, returns the original coordinates unchanged.
 */
export function wgs84ToGcj02(coord: LatLng): LatLng {
  const { lat, lng } = coord;
  if (!isInChinaBbox(lat, lng)) {
    return coord;
  }
  const { dLat, dLng } = delta(lat, lng);
  return {
    lat: lat + dLat,
    lng: lng + dLng,
  };
}

/**
 * Convert GCJ-02 ("Mars Coordinates" returned by `AMap.Geolocation`) back to
 * canonical WGS-84 coordinates using 2-step fixed-point refinement (<0.01m error)
 * so distance & radar math stay uniform across devices.
 */
export function gcj02ToWgs84(coord: LatLng): LatLng {
  const { lat, lng } = coord;
  if (!isInChinaBbox(lat, lng)) {
    return coord;
  }
  let wgsLat = lat;
  let wgsLng = lng;
  for (let i = 0; i < 2; i++) {
    const { dLat, dLng } = delta(wgsLat, wgsLng);
    wgsLat = lat - dLat;
    wgsLng = lng - dLng;
  }
  return {
    lat: wgsLat,
    lng: wgsLng,
  };
}
