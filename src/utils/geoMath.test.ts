import { describe, expect, it } from 'vitest';
import {
  bearingDegrees,
  distanceMeters,
  gcj02ToWgs84,
  SHANGHAI_CENTER_WGS84,
  wgs84ToGcj02,
} from './geoMath';
import {
  encodeCatchPayload,
  parseCatchPayload,
  parseRoomCodeFromScan,
} from '../types/game';

describe('geoMath & GCJ-02 China Coordinate Transform', () => {
  it('computes Haversine distance accurately', () => {
    const a = { lat: 31.2304, lng: 121.4737 }; // People's Square, Shanghai
    const b = { lat: 31.2397, lng: 121.4998 }; // Oriental Pearl Tower
    const dist = distanceMeters(a, b);
    expect(dist).toBeGreaterThan(2600);
    expect(dist).toBeLessThan(2800);
  });

  it('computes forward azimuth bearing in [0, 360)', () => {
    const south = { lat: 31.2, lng: 121.47 };
    const north = { lat: 31.25, lng: 121.47 };
    expect(bearingDegrees(south, north)).toBeCloseTo(0, 1);
    expect(bearingDegrees(north, south)).toBeCloseTo(180, 1);
  });

  it('transforms Shanghai WGS-84 to GCJ-02 and back with <2m round-trip error', () => {
    const gcj = wgs84ToGcj02(SHANGHAI_CENTER_WGS84);
    expect(gcj.lat).not.toBe(SHANGHAI_CENTER_WGS84.lat);
    expect(gcj.lng).not.toBe(SHANGHAI_CENTER_WGS84.lng);
    // In Shanghai, GCJ-02 shifts ~450m east-southeast relative to WGS-84
    const shiftMeters = distanceMeters(SHANGHAI_CENTER_WGS84, gcj);
    expect(shiftMeters).toBeGreaterThan(350);
    expect(shiftMeters).toBeLessThan(650);

    const roundTrip = gcj02ToWgs84(gcj);
    const errorMeters = distanceMeters(SHANGHAI_CENTER_WGS84, roundTrip);
    expect(errorMeters).toBeLessThan(2);
  });

  it('leaves coordinates outside Mainland China unchanged', () => {
    const tokyo = { lat: 35.6812, lng: 139.7671 };
    expect(wgs84ToGcj02(tokyo)).toEqual(tokyo);
    expect(gcj02ToWgs84(tokyo)).toEqual(tokyo);
  });
});

describe('QR payload and room code parsers', () => {
  it('encodes and parses catch payloads', () => {
    const raw = encodeCatchPayload({
      roomCode: 'HUNT42',
      playerId: 'p-123',
      catchSecret: 'sec-999',
    });
    expect(raw).toBe('manhunt:HUNT42:p-123:sec-999');
    expect(parseCatchPayload(raw)).toEqual({
      roomCode: 'HUNT42',
      playerId: 'p-123',
      catchSecret: 'sec-999',
    });
    expect(parseCatchPayload('invalid:data')).toBeNull();
  });

  it('parses room code from invite URL or plain code', () => {
    expect(
      parseRoomCodeFromScan('https://example.github.io/manhunt/?room=hunt42'),
    ).toBe('HUNT42');
    expect(parseRoomCodeFromScan('  abcd99 ')).toBe('ABCD99');
  });
});
