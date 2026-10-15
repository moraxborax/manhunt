import React, { useEffect, useMemo, useRef } from 'react';
import { Radar } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useI18n } from '../i18n/I18nContext';
import { bearingDegrees, distanceMeters } from '../utils/geoMath';

interface Blip {
  relativeDegrees: number;
  distanceM: number;
}

export const RadarViewLevel12: React.FC = () => {
  const {
    room,
    me,
    myLocation,
    myHeading,
    hiderLocations,
    isHunter,
    scanActive,
    cooldownRemainingSec,
    activateManualScan,
  } = useGame();
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const manual = room?.settings.difficulty === 2;
  const blinded = isHunter && room?.phase === 'hiding';
  const showBlips = !blinded && (!manual || scanActive);
  const heading = myHeading ?? 0;

  const blips = useMemo<Blip[]>(() => {
    if (!showBlips || !myLocation) return [];
    const list: Blip[] = [];
    for (const loc of hiderLocations) {
      if (loc.playerId === me?.id) continue;
      const target = { lat: loc.lat, lng: loc.lng };
      const dist = distanceMeters(myLocation, target);
      const bearing = bearingDegrees(myLocation, target);
      const relative = (bearing - heading + 360) % 360;
      list.push({ relativeDegrees: relative, distanceM: dist });
    }
    return list;
  }, [showBlips, myLocation, hiderLocations, me?.id, heading]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 320;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 12;

    ctx.clearRect(0, 0, size, size);

    // Radar dark background circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#0B1F17';
    ctx.fill();

    // Conic / sector glow aligned with heading
    try {
      const grad = ctx.createConicGradient(
        ((-heading - 90) * Math.PI) / 180,
        cx,
        cy,
      );
      grad.addColorStop(0, 'rgba(42, 255, 154, 0.28)');
      grad.addColorStop(0.25, 'rgba(42, 255, 154, 0.05)');
      grad.addColorStop(1, 'rgba(42, 255, 154, 0.0)');
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    } catch {
      // fallback if createConicGradient unsupported
    }

    // Distance rings (66m, 133m, 200m)
    ctx.strokeStyle = 'rgba(42, 255, 154, 0.32)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, (radius * i) / 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Crosshairs
    ctx.strokeStyle = 'rgba(42, 255, 154, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.stroke();

    // Forward/North notch at top of phone
    ctx.strokeStyle = '#2AFF9A';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy - radius + 14);
    ctx.stroke();

    // Hider blips (clamped to 200m range)
    const maxRangeM = 200;
    for (const b of blips) {
      const r = Math.min(1, Math.max(0, b.distanceM / maxRangeM)) * (radius - 8);
      const rad = ((b.relativeDegrees - 90) * Math.PI) / 180;
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

    // Center self dot
    ctx.beginPath();
    ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#2AFF9A';
    ctx.fill();
  }, [heading, blips]);

  return (
    <div className="flex h-full flex-col items-center justify-between p-6">
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="relative flex items-center justify-center">
          <canvas
            ref={canvasRef}
            className="h-72 w-72 max-w-[80vw] rounded-full shadow-[0_0_40px_rgba(42,255,154,0.12)] sm:h-80 sm:w-80"
          />
          <div className="pointer-events-none absolute -bottom-7 text-xs tracking-wider text-white/50">
            {Math.round(heading)}° · MAX 200m
          </div>
        </div>
      </div>

      {manual && (
        <div className="w-full max-w-md pt-4">
          <button
            type="button"
            disabled={scanActive || cooldownRemainingSec > 0}
            onClick={activateManualScan}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2AFF9A] px-5 py-3.5 font-bold text-[#05120C] transition hover:bg-[#2AFF9A]/90 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
          >
            <Radar className="h-5 w-5" />
            <span>
              {scanActive
                ? t.scanningButton
                : cooldownRemainingSec > 0
                  ? t.cooldownButton(cooldownRemainingSec)
                  : t.activateRadarScan}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
