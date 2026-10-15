import { AMAP_JS_KEY, AMAP_SECURITY_JS_CODE } from '../config/supabase';
import type { LatLng } from '../types/game';
import { loadAMapSdk } from '../utils/amapLoader';
import { gcj02ToWgs84 } from '../utils/geoMath';

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

  async startTracking(
    onLocation: LocationCallback,
    onHeading: HeadingCallback,
    onError?: (err: string) => void,
  ): Promise<void> {
    this.stopTracking();

    // 1. Start standard browser geolocation watch immediately for instant updates
    if ('geolocation' in navigator) {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const coord: LatLng = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          this.lastLocation = coord;
          onLocation(coord);

          if (
            typeof pos.coords.heading === 'number' &&
            !Number.isNaN(pos.coords.heading) &&
            pos.coords.heading >= 0
          ) {
            this.lastHeading = pos.coords.heading;
            onHeading(pos.coords.heading);
          }
        },
        (err) => {
          // Only report error if AMap.Geolocation hasn't provided a fix yet
          if (!this.lastLocation) {
            onError?.(err.message);
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 2000,
          timeout: 15000,
        },
      );
    }

    // 2. When AMap JS Key is configured, also initialize AMap.Geolocation
    // for high-reliability China Wi-Fi / cell / GPS fused positioning
    if (AMAP_JS_KEY) {
      void this.startAMapGeolocation(onLocation);
    }

    this.attachCompassListener(onHeading);
    await this.requestWakeLock();
  }

  private async startAMapGeolocation(
    onLocation: LocationCallback,
  ): Promise<void> {
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
        convert: true, // Returns GCJ-02 when converted by AMap
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
          if (status === 'complete' && result?.position) {
            const rawLat =
              typeof result.position.getLat === 'function'
                ? Number(result.position.getLat())
                : Number(result.position.lat);
            const rawLng =
              typeof result.position.getLng === 'function'
                ? Number(result.position.getLng())
                : Number(result.position.lng);
            if (Number.isNaN(rawLat) || Number.isNaN(rawLng)) return;

            // Normalize to canonical WGS-84 if AMap converted it to GCJ-02
            const wgs84 = result.isConverted
              ? gcj02ToWgs84({ lat: rawLat, lng: rawLng })
              : { lat: rawLat, lng: rawLng };

            this.lastLocation = wgs84;
            onLocation(wgs84);
          }
        });
      };

      fetchOnce();
      this.amapPollTimer = window.setInterval(fetchOnce, 3000);
    } catch {
      // Browser geolocation watch remains active as fallback
    }
  }

  private attachCompassListener(onHeading: HeadingCallback): void {
    if (this.orientationListener) return;
    this.orientationListener = (e: DeviceOrientationEvent) => {
      const iosEvent = e as DeviceOrientationEventiOS;
      let heading: number | null = null;
      if (typeof iosEvent.webkitCompassHeading === 'number') {
        heading = iosEvent.webkitCompassHeading;
      } else if (typeof e.alpha === 'number') {
        heading = (360 - e.alpha) % 360;
      }
      if (heading !== null && !Number.isNaN(heading)) {
        this.lastHeading = heading;
        onHeading(heading);
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
