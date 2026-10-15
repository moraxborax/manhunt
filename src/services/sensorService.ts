import { AMAP_JS_KEY, AMAP_SECURITY_JS_CODE } from '../config/supabase';
import type { LatLng } from '../types/game';
import { loadAMapSdk } from '../utils/amapLoader';
import { distanceMeters, gcj02ToWgs84 } from '../utils/geoMath';

export type LocationCallback = (coord: LatLng) => void;
export type HeadingCallback = (headingDegrees: number) => void;

interface DeviceOrientationEventiOS extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

interface DeviceOrientationEventConstructoriOS {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

export class SensorService {
  private watchId: number | null = null;
  private amapPollTimer: number | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private amapGeolocation: any = null;
  private wakeLockSentinel: WakeLockSentinel | null = null;
  private orientationListener: ((e: DeviceOrientationEvent) => void) | null =
    null;

  public lastLocation: LatLng | null = null;
  public lastHeading: number | null = null;
  private lastEmittedLocation: LatLng | null = null;
  private lastLocationEmitAt = 0;
  private lastEmittedHeading: number | null = null;
  private lastHeadingEmitAt = 0;
  private lastAbsoluteHeadingAt = 0;
  private browserAccuracyM: number | null = null;

  async startTracking(
    onLocation: LocationCallback,
    onHeading: HeadingCallback,
    onError?: (err: string) => void,
  ): Promise<void> {
    this.stopTracking();

    // Browser GPS is immediate WGS-84. AMap is the China fused source and
    // must not replace a precise browser fix with a coarse IP result.
    this.startBrowserWatch(onLocation, onHeading, onError);
    if (AMAP_JS_KEY) {
      void this.startAMapGeolocation(onLocation);
    }

    this.attachCompassListener(onHeading);
    await this.requestWakeLock();
  }

  private startBrowserWatch(
    onLocation: LocationCallback,
    onHeading: HeadingCallback,
    onError?: (err: string) => void,
  ): void {
    if (this.watchId !== null || !('geolocation' in navigator)) return;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const accuracy = pos.coords.accuracy;
        this.browserAccuracyM =
          typeof accuracy === 'number' && Number.isFinite(accuracy)
            ? accuracy
            : null;
        this.emitLocation(
          {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          },
          onLocation,
        );

        if (
          typeof pos.coords.heading === 'number' &&
          !Number.isNaN(pos.coords.heading) &&
          pos.coords.heading >= 0
        ) {
          this.emitHeading(pos.coords.heading, onHeading, false);
        }
      },
      (err) => {
        if (!this.lastLocation) onError?.(err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 15000,
      },
    );
  }

  private async startAMapGeolocation(onLocation: LocationCallback): Promise<void> {
    try {
      const AMap = await loadAMapSdk({
        key: AMAP_JS_KEY,
        securityJsCode: AMAP_SECURITY_JS_CODE || undefined,
        version: '2.0',
        plugins: ['AMap.Scale', 'AMap.Geolocation'],
      });

      const geolocation = new AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: 10000,
        convert: true,
        noIpLocate: 3,
        showButton: false,
        showMarker: false,
        showCircle: false,
        panToLocation: false,
        zoomToAccuracy: false,
      });
      this.amapGeolocation = geolocation;

      const fetchOnce = () => {
        if (!this.amapGeolocation) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.amapGeolocation.getCurrentPosition((status: string, result: any) => {
          if (status !== 'complete' || !result?.position) return;
          const rawLat =
            typeof result.position.getLat === 'function'
              ? Number(result.position.getLat())
              : Number(result.position.lat);
          const rawLng =
            typeof result.position.getLng === 'function'
              ? Number(result.position.getLng())
              : Number(result.position.lng);
          if (Number.isNaN(rawLat) || Number.isNaN(rawLng)) return;

          const amapAccuracy =
            typeof result.accuracy === 'number' ? result.accuracy : null;
          const coarse = amapAccuracy == null || amapAccuracy > 100;
          const browserIsPrecise =
            this.browserAccuracyM != null && this.browserAccuracyM <= 100;
          if (coarse && browserIsPrecise) return;

          const raw = { lat: rawLat, lng: rawLng };
          this.emitLocation(
            result.isConverted ? gcj02ToWgs84(raw) : raw,
            onLocation,
          );
        });
      };

      fetchOnce();
      this.amapPollTimer = window.setInterval(fetchOnce, 3000);
    } catch {
      // The browser watch started above remains the fix.
    }
  }

  private attachCompassListener(onHeading: HeadingCallback): void {
    if (this.orientationListener) return;
    this.orientationListener = (e: DeviceOrientationEvent) => {
      const iosEvent = e as DeviceOrientationEventiOS;
      const absolute =
        e.type === 'deviceorientationabsolute' ||
        typeof iosEvent.webkitCompassHeading === 'number';
      // Phones emit both absolute and relative orientation. Mixing them
      // makes the radar jump back and forth every frame.
      if (!absolute && Date.now() - this.lastAbsoluteHeadingAt < 1500) {
        return;
      }
      let heading: number | null = null;
      if (typeof iosEvent.webkitCompassHeading === 'number') {
        heading = iosEvent.webkitCompassHeading;
      } else if (typeof e.alpha === 'number') {
        heading = (360 - e.alpha) % 360;
      }
      if (heading !== null && !Number.isNaN(heading)) {
        this.emitHeading(heading, onHeading, absolute);
      }
    };
    window.addEventListener(
      'deviceorientationabsolute' as keyof WindowEventMap,
      this.orientationListener as EventListener,
      true,
    );
    window.addEventListener(
      'deviceorientation',
      this.orientationListener,
      true,
    );
  }

  async requestCompassPermission(): Promise<boolean> {
    try {
      const ctor =
        window.DeviceOrientationEvent as unknown as DeviceOrientationEventConstructoriOS;
      if (ctor && typeof ctor.requestPermission === 'function') {
        const state = await ctor.requestPermission();
        return state === 'granted';
      }
      return true;
    } catch {
      return false;
    }
  }

  async requestWakeLock(): Promise<void> {
    try {
      if ('wakeLock' in navigator && navigator.wakeLock) {
        this.wakeLockSentinel = await navigator.wakeLock.request('screen');
      }
    } catch {
      // Ignore if browser blocks or doesn't support WakeLock
    }
  }

  async releaseWakeLock(): Promise<void> {
    try {
      await this.wakeLockSentinel?.release();
      this.wakeLockSentinel = null;
    } catch {
      // ignore
    }
  }

  private emitLocation(coord: LatLng, onLocation: LocationCallback): void {
    this.lastLocation = coord;
    const now = Date.now();
    const moved =
      !this.lastEmittedLocation ||
      distanceMeters(this.lastEmittedLocation, coord) >= 3;
    if (!moved && now - this.lastLocationEmitAt < 1000) return;
    this.lastEmittedLocation = coord;
    this.lastLocationEmitAt = now;
    onLocation(coord);
  }

  private emitHeading(
    heading: number,
    onHeading: HeadingCallback,
    absolute: boolean,
  ): void {
    this.lastHeading = heading;
    if (absolute) this.lastAbsoluteHeadingAt = Date.now();
    const now = Date.now();
    const delta =
      this.lastEmittedHeading === null
        ? 360
        : Math.abs(
            ((heading - this.lastEmittedHeading + 540) % 360) - 180,
          );
    if (delta < 6 && now - this.lastHeadingEmitAt < 250) return;
    this.lastEmittedHeading = heading;
    this.lastHeadingEmitAt = now;
    onHeading(heading);
  }

  stopTracking(): void {
    if (this.watchId !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.amapPollTimer !== null) {
      window.clearInterval(this.amapPollTimer);
      this.amapPollTimer = null;
    }
    this.amapGeolocation = null;
    this.lastEmittedLocation = null;
    this.lastLocationEmitAt = 0;
    this.lastEmittedHeading = null;
    this.lastHeadingEmitAt = 0;
    this.lastAbsoluteHeadingAt = 0;
    this.browserAccuracyM = null;

    if (this.orientationListener) {
      window.removeEventListener(
        'deviceorientationabsolute' as keyof WindowEventMap,
        this.orientationListener as EventListener,
        true,
      );
      window.removeEventListener(
        'deviceorientation',
        this.orientationListener,
        true,
      );
      this.orientationListener = null;
    }
    void this.releaseWakeLock();
  }
}
