import React, { useEffect, useRef } from 'react';
import { Radar } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useI18n } from '../i18n/I18nContext';
import { bearingDegrees, distanceMeters } from '../utils/geoMath';

interface RadarFrame {
  myLocation: { lat: number; lng: number } | null;
  heading: number;
  hiderLocations: { lat: number; lng: number }[];
  showBlips: boolean;
}

export const RadarViewLevel12: React.FC = () => {
  const {
    room,
    myLocation,
    myHeading,
    hiderLocations,
    isHunter,
    scanActive,
    cooldownRemainingSec,
    activateManualScan,
    requestCompass,
  } = useGame();
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<RadarFrame>({
    myLocation,
    heading: myHeading ?? 0,
    hiderLocations,
    showBlips: false,
  });

  const manual = room?.settings.difficulty === 2;
  const blinded = isHunter && room?.phase === 'hiding';
  const showBlips = !blinded && (!manual || scanActive);
  const heading = myHeading ?? 0;
  frameRef.current = {
    myLocation,
    heading,
    hiderLocations,
    showBlips,
  };
  const blocked = blinded || !myLocation;
  const status = blinded
    ? t.radarBlinded
    : !myLocation
      ? t.waitingForSignal
      : showBlips && hiderLocations.length === 0
        ? t.noHiderSignal
        : '';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let smoothHeading = frameRef.current.heading;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const css = canvas.clientWidth || 320;
      const next = Math.round(css * dpr);
      if (canvas.width !== next || canvas.height !== next) {
        canvas.width = next;
        canvas.height = next;
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const draw = (now: number) => {
      const { myLocation: origin, heading: target, hiderLocations: hiders, showBlips: visible } =
        frameRef.current;
      const dpr = window.devicePixelRatio || 1;
      const size = canvas.width / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;
      const radius = size / 2 - 12;

      let delta = ((target - smoothHeading + 540) % 360) - 180;
      smoothHeading += delta * 0.18;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#0B1F17';
      ctx.fill();

      const sweep = ((now / 18) % 360) * (Math.PI / 180);
      try {
        const grad = ctx.createConicGradient(sweep, cx, cy);
        grad.addColorStop(0, 'rgba(42, 255, 154, 0.0)');
        grad.addColorStop(0.82, 'rgba(42, 255, 154, 0.0)');
        grad.addColorStop(1, 'rgba(42, 255, 154, 0.35)');
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      } catch {
        // createConicGradient is unavailable
      }

      ctx.strokeStyle = 'rgba(42, 255, 154, 0.32)';
      ctx.lineWidth = 1.5;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (radius * i) / 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(42, 255, 154, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - radius, cy);
      ctx.lineTo(cx + radius, cy);
      ctx.moveTo(cx, cy - radius);
      ctx.lineTo(cx, cy + radius);
      ctx.stroke();

      ctx.strokeStyle = '#2AFF9A';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - radius);
      ctx.lineTo(cx, cy - radius + 14);
      ctx.stroke();

      if (visible && origin) {
        const maxRangeM = 200;
        for (const loc of hiders) {
          const targetPoint = { lat: loc.lat, lng: loc.lng };
          const distanceM = distanceMeters(origin, targetPoint);
          const bearing = bearingDegrees(origin, targetPoint);
          const relative = (bearing - smoothHeading + 360) % 360;
          const r =
            Math.min(1, Math.max(0, distanceM / maxRangeM)) * (radius - 8);
          const rad = ((relative - 90) * Math.PI) / 180;
          const x = cx + r * Math.cos(rad);
          const y = cy + r * Math.sin(rad);

          ctx.beginPath();
          ctx.arc(x, y, 11, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 82, 82, 0.25)';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fillStyle = '#FF5252';
          ctx.fill();
        }
      }

      ctx.beginPath();
      ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#2AFF9A';
      ctx.fill();

      raf = window.requestAnimationFrame(draw);
    };

    raf = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col items-center px-6 pt-4 pb-3">
      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center">
        <canvas
          ref={canvasRef}
          className="aspect-square h-auto w-[min(78vw,20rem)] max-h-full rounded-full shadow-[0_0_40px_rgba(42,255,154,0.12)]"
        />
        <p className="mt-3 text-center text-xs leading-relaxed text-white/55">
          {Math.round(heading)}° · MAX 200m
          {status ? (
            <>
              <br />
              {status}
            </>
          ) : null}
        </p>
        {myHeading == null && (
          <button
            type="button"
            onClick={() => void requestCompass()}
            className="mt-3 rounded-full border border-[#2AFF9A]/40 bg-[#2AFF9A]/10 px-4 py-2 text-xs font-semibold text-[#2AFF9A]"
          >
            {t.enableCompass}
          </button>
        )}
      </div>

      {manual && (
        <div className="w-full max-w-md shrink-0 pt-3">
          <button
            type="button"
            disabled={blocked || scanActive || cooldownRemainingSec > 0}
            onClick={activateManualScan}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2AFF9A] px-5 py-3.5 font-bold text-[#05120C] transition hover:bg-[#2AFF9A]/90 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
          >
            <Radar className="h-5 w-5" />
            <span>
              {scanActive
                ? t.scanningButton
                : cooldownRemainingSec > 0
                  ? t.cooldownButton(cooldownRemainingSec)
                  : blinded
                    ? t.radarBlinded
                    : !myLocation
                      ? t.waitingForSignal
                      : t.activateRadarScan}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
