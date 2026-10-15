import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed } from 'lucide-react';
import { AMAP_JS_KEY, AMAP_SECURITY_JS_CODE } from '../config/supabase';
import { useGame } from '../context/GameContext';
import { useI18n } from '../i18n/I18nContext';
import { loadAMapSdk } from '../utils/amapLoader';
import { SHANGHAI_CENTER_WGS84, wgs84ToGcj02 } from '../utils/geoMath';
import type { LatLng } from '../types/game';

interface VisibleMarker {
  id: string;
  label: string;
  isHunter: boolean;
  isMe: boolean;
  heading: number | null;
  gcj02: LatLng;
}

export const MapViewLevel0: React.FC = () => {
  const {
    room,
    players,
    locations,
    myLocation,
    myHeading,
    me,
    isHunter,
    isHider,
  } = useGame();
  const { t } = useI18n();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletMarkersRef = useRef<L.LayerGroup | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const amapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const amapNamespaceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const amapOverlaysRef = useRef<any[]>([]);

  const [engine, setEngine] = useState<'amap-sdk' | 'amap-tiles'>(() =>
    AMAP_JS_KEY ? 'amap-sdk' : 'amap-tiles',
  );
  const [mapReady, setMapReady] = useState(false);
  const hasCenteredOnUserRef = useRef(false);

  const centerGcj02 = useMemo(() => {
    const raw = myLocation ?? SHANGHAI_CENTER_WGS84;
    return wgs84ToGcj02(raw);
  }, [myLocation]);

  const proximityRadiusM = room?.settings.proximityRadiusM ?? 50;

  const visibleMarkers = useMemo<VisibleMarker[]>(() => {
    const phase = room?.phase;
    const list: VisibleMarker[] = [];

    for (const p of players) {
      if (
        isHunter &&
        phase === 'hiding' &&
        p.role === 'hider' &&
        p.id !== me?.id
      ) {
        continue;
      }
      if (isHider && p.role === 'hunter') {
        continue;
      }
      const loc = locations[p.id];
      const isMe = p.id === me?.id;
      const rawPoint: LatLng | null = isMe
        ? myLocation ?? (loc ? { lat: loc.lat, lng: loc.lng } : null)
        : loc
          ? { lat: loc.lat, lng: loc.lng }
          : null;
      if (!rawPoint) continue;

      const heading = isMe
        ? (myHeading ?? loc?.heading ?? null)
        : (loc?.heading ?? null);

      list.push({
        id: p.id,
        label: isMe ? `${p.displayName} (${t.youBadge})` : p.displayName,
        isHunter: p.role === 'hunter',
        isMe,
        heading: typeof heading === 'number' ? heading : null,
        gcj02: wgs84ToGcj02(rawPoint),
      });
    }
    return list;
  }, [
    room?.phase,
    players,
    isHunter,
    isHider,
    me?.id,
    locations,
    myLocation,
    myHeading,
    t.youBadge,
  ]);

  // Initialize either Official AMap JS API 2.0 or Keyless AMap Retina Tiles via Leaflet
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let disposed = false;

    async function initMap() {
      if (AMAP_JS_KEY) {
        try {
          const AMap = await loadAMapSdk({
            key: AMAP_JS_KEY,
            securityJsCode: AMAP_SECURITY_JS_CODE || undefined,
            version: '2.0',
            plugins: ['AMap.Scale', 'AMap.Geolocation'],
          });
          if (disposed || !containerRef.current) return;
          amapNamespaceRef.current = AMap;
          const map = new AMap.Map(containerRef.current, {
            viewMode: '2D',
            zoom: 17,
            center: [centerGcj02.lng, centerGcj02.lat],
            mapStyle: 'amap://styles/dark',
          });
          amapInstanceRef.current = map;
          setEngine('amap-sdk');
          setMapReady(true);
          return;
        } catch {
          // Automatically fall back to keyless AMap Retina XYZ tiles if JS key fails
          setEngine('amap-tiles');
        }
      }

      if (disposed || !containerRef.current) return;
      const map = L.map(containerRef.current, {
        center: [centerGcj02.lat, centerGcj02.lng],
        zoom: 17,
        zoomControl: false,
        attributionControl: false,
      });

      // Keyless AMap (AutoNavi 高德地图) High-DPI Chinese Road Tiles (GCJ-02)
      L.tileLayer(
        'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=2&style=8&x={x}&y={y}&z={z}',
        {
          subdomains: ['1', '2', '3', '4'],
          maxZoom: 19,
          minZoom: 3,
        },
      ).addTo(map);

      const group = L.layerGroup().addTo(map);
      leafletMapRef.current = map;
      leafletMarkersRef.current = group;
      setMapReady(true);
    }

    void initMap();

    return () => {
      disposed = true;
      if (amapInstanceRef.current) {
        amapInstanceRef.current.destroy?.();
        amapInstanceRef.current = null;
      }
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        leafletMarkersRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-pan to user's real GPS position the first time it arrives
  useEffect(() => {
    if (!mapReady || !myLocation || hasCenteredOnUserRef.current) return;
    if (!amapInstanceRef.current && !leafletMapRef.current) return;
    hasCenteredOnUserRef.current = true;
    const gcj = wgs84ToGcj02(myLocation);
    if (amapInstanceRef.current) {
      amapInstanceRef.current.setZoomAndCenter(17, [gcj.lng, gcj.lat]);
    } else if (leafletMapRef.current) {
      leafletMapRef.current.setView([gcj.lat, gcj.lng], 17);
    }
  }, [mapReady, myLocation]);

  // Render player markers + directional heading cone + proximity radius circle
  useEffect(() => {
    const buildMarkerHtml = (m: VisibleMarker) => {
      const color = m.isHunter ? '#FF5252' : '#2AFF9A';
      const ring = m.isMe
        ? `box-shadow: 0 0 0 4px ${color}44, 0 0 14px ${color};`
        : `box-shadow: 0 0 8px ${color}88;`;

      // Directional heading cone SVG (points North at 0deg, rotated by m.heading)
      const coneHtml =
        m.heading !== null
          ? `<div style="position:absolute;top:9px;left:50%;width:56px;height:56px;transform:translate(-50%,-50%) rotate(${Math.round(m.heading)}deg);pointer-events:none;">
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <path d="M28 28 L14 4 A26 26 0 0 1 42 4 Z" fill="${color}" fill-opacity="0.28"/>
              </svg>
            </div>`
          : '';

      return `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-9px);pointer-events:none;">
          ${coneHtml}
          <div style="position:relative;z-index:2;width:18px;height:18px;border-radius:9999px;background:${color};border:2.5px solid #0B120E;${ring}"></div>
          <span style="position:relative;z-index:2;margin-top:4px;padding:1px 6px;border-radius:6px;background:rgba(11,18,14,0.9);color:${color};font-size:11px;font-weight:700;white-space:nowrap;border:1px solid ${color}55;">
            ${m.label.replace(/</g, '&lt;')}
          </span>
        </div>
      `;
    };

    const selfMarker = visibleMarkers.find((m) => m.isMe);
    const selfColor = isHunter ? '#FF5252' : '#2AFF9A';

    if (
      engine === 'amap-sdk' &&
      amapInstanceRef.current &&
      amapNamespaceRef.current
    ) {
      const AMap = amapNamespaceRef.current;
      const map = amapInstanceRef.current;
      if (amapOverlaysRef.current.length > 0) {
        map.remove(amapOverlaysRef.current);
        amapOverlaysRef.current = [];
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const overlays: any[] = [];

      // Proximity radius ring around self (AMap.Circle)
      if (selfMarker && proximityRadiusM > 0) {
        const circle = new AMap.Circle({
          center: new AMap.LngLat(selfMarker.gcj02.lng, selfMarker.gcj02.lat),
          radius: proximityRadiusM,
          strokeColor: selfColor,
          strokeOpacity: 0.45,
          strokeWeight: 1.5,
          strokeStyle: 'dashed',
          fillColor: selfColor,
          fillOpacity: 0.08,
          bubble: true,
        });
        overlays.push(circle);
      }

      for (const m of visibleMarkers) {
        overlays.push(
          new AMap.Marker({
            position: new AMap.LngLat(m.gcj02.lng, m.gcj02.lat),
            content: buildMarkerHtml(m),
            offset: new AMap.Pixel(0, 0),
          }),
        );
      }

      if (overlays.length > 0) {
        map.add(overlays);
      }
      amapOverlaysRef.current = overlays;
      return;
    }

    const group = leafletMarkersRef.current;
    if (!group) return;
    group.clearLayers();

    if (selfMarker && proximityRadiusM > 0) {
      L.circle([selfMarker.gcj02.lat, selfMarker.gcj02.lng], {
        radius: proximityRadiusM,
        color: selfColor,
        weight: 1.5,
        opacity: 0.45,
        dashArray: '6 4',
        fillColor: selfColor,
        fillOpacity: 0.08,
      }).addTo(group);
    }

    for (const m of visibleMarkers) {
      const icon = L.divIcon({
        className: 'manhunt-player-marker',
        html: buildMarkerHtml(m),
        iconSize: [0, 0],
      });
      L.marker([m.gcj02.lat, m.gcj02.lng], { icon }).addTo(group);
    }
  }, [visibleMarkers, engine, proximityRadiusM, isHunter, mapReady]);

  const handleRecenter = () => {
    if (amapInstanceRef.current && amapNamespaceRef.current) {
      const AMap = amapNamespaceRef.current;
      const map = amapInstanceRef.current;
      try {
        const geo = new AMap.Geolocation({
          enableHighAccuracy: true,
          timeout: 8000,
          GeoLocationFirst: true,
          noIpLocate: 0,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        geo.getCurrentPosition((status: string, result: any) => {
          if (status === 'complete' && result?.position) {
            const lng =
              typeof result.position.getLng === 'function'
                ? result.position.getLng()
                : result.position.lng;
            const lat =
              typeof result.position.getLat === 'function'
                ? result.position.getLat()
                : result.position.lat;
            map.setZoomAndCenter(17, [lng, lat]);
            return;
          }
          const fallback = wgs84ToGcj02(myLocation ?? SHANGHAI_CENTER_WGS84);
          map.setZoomAndCenter(17, [fallback.lng, fallback.lat]);
        });
        return;
      } catch {
        // fall through
      }
    }
    const target = wgs84ToGcj02(myLocation ?? SHANGHAI_CENTER_WGS84);
    if (amapInstanceRef.current) {
      amapInstanceRef.current.setZoomAndCenter(17, [target.lng, target.lat]);
    } else if (leafletMapRef.current) {
      leafletMapRef.current.setView([target.lat, target.lng], 17, {
        animate: true,
      });
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={containerRef} className="h-full w-full bg-[#0B120E]" />

      {/* AMap mode badge */}
      <div className="pointer-events-none absolute top-3 left-3 z-[500] rounded-full border border-white/10 bg-[#0B120E]/85 px-3 py-1 text-xs text-white/70 backdrop-blur">
        {engine === 'amap-sdk' ? t.amapSdkModeBadge : t.amapTileModeBadge}
      </div>

      {/* Re-center button */}
      <button
        type="button"
        onClick={handleRecenter}
        title={t.recenterMap}
        className="absolute right-3 bottom-4 z-[500] flex items-center gap-1.5 rounded-full border border-[#2AFF9A]/40 bg-[#0B120E]/90 px-3.5 py-2 text-xs font-semibold text-[#2AFF9A] shadow-lg backdrop-blur active:scale-95"
      >
        <LocateFixed className="h-4 w-4" />
        <span>{t.recenterMap}</span>
      </button>
    </div>
  );
};
