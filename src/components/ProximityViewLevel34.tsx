import React from 'react';
import { Radio } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useI18n } from '../i18n/I18nContext';

export const ProximityViewLevel34: React.FC = () => {
  const {
    room,
    isHunter,
    scanActive,
    cooldownRemainingSec,
    nearbyHiderCount,
    activateManualScan,
  } = useGame();
  const { t } = useI18n();

  const manual = room?.settings.difficulty === 4;
  const blinded = isHunter && room?.phase === 'hiding';
  const show = !blinded && (!manual || scanActive);
  const radius = room?.settings.proximityRadiusM ?? 50;

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="flex h-44 w-44 items-center justify-center rounded-full border-2 border-[#2AFF9A]/30 bg-[#152018] shadow-[0_0_50px_rgba(42,255,154,0.1)]">
        <span className="text-7xl font-extrabold tracking-tight text-[#2AFF9A]">
          {show ? nearbyHiderCount : '—'}
        </span>
      </div>

      <p className="mt-6 text-lg font-medium text-white/80">
        {show
          ? t.hidersWithinRadius(nearbyHiderCount, radius)
          : manual
            ? t.tapSensePrompt
            : t.waitingForSignal}
      </p>

      {manual && (
        <div className="mt-8 w-full max-w-sm">
          <button
            type="button"
            disabled={scanActive || cooldownRemainingSec > 0}
            onClick={activateManualScan}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2AFF9A] px-5 py-3.5 font-bold text-[#05120C] transition hover:bg-[#2AFF9A]/90 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
          >
            <Radio className="h-5 w-5" />
            <span>
              {scanActive
                ? t.sensingButton
                : cooldownRemainingSec > 0
                  ? t.cooldownButton(cooldownRemainingSec)
                  : t.senseNearbyHiders}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
