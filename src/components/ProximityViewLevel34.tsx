import React from 'react';
import { Radio } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useI18n } from '../i18n/I18nContext';

export const ProximityViewLevel34: React.FC = () => {
  const {
    room,
    myLocation,
    isHunter,
    scanActive,
    cooldownRemainingSec,
    hiderLocations,
    nearbyHiderCount,
    activateManualScan,
  } = useGame();
  const { t } = useI18n();

  const manual = room?.settings.difficulty === 4;
  const blinded = isHunter && room?.phase === 'hiding';
  const sensing = !blinded && (!manual || scanActive);
  const radius = room?.settings.proximityRadiusM ?? 50;
  const blocked = blinded || !myLocation;

  let readout: string | number = '—';
  let caption = t.waitingForSignal;
  if (blinded) {
    caption = t.radarBlinded;
  } else if (!myLocation) {
    caption = t.waitingForSignal;
  } else if (manual && !scanActive) {
    caption = t.tapSensePrompt;
  } else if (hiderLocations.length === 0) {
    caption = t.noHiderSignal;
  } else {
    readout = nearbyHiderCount;
    caption = t.hidersWithinRadius(nearbyHiderCount, radius);
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="flex h-44 w-44 items-center justify-center rounded-full border-2 border-[#2AFF9A]/30 bg-[#152018] shadow-[0_0_50px_rgba(42,255,154,0.1)]">
        <span className="text-7xl font-extrabold tracking-tight text-[#2AFF9A]">
          {sensing && myLocation && hiderLocations.length > 0
            ? readout
            : '—'}
        </span>
      </div>

      <p className="mt-6 text-lg font-medium text-white/80">{caption}</p>

      {manual && (
        <div className="mt-8 w-full max-w-sm">
          <button
            type="button"
            disabled={blocked || scanActive || cooldownRemainingSec > 0}
            onClick={activateManualScan}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2AFF9A] px-5 py-3.5 font-bold text-[#05120C] transition hover:bg-[#2AFF9A]/90 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
          >
            <Radio className="h-5 w-5" />
            <span>
              {scanActive
                ? t.sensingButton
                : cooldownRemainingSec > 0
                  ? t.cooldownButton(cooldownRemainingSec)
                  : blinded
                    ? t.radarBlinded
                    : !myLocation
                      ? t.waitingForSignal
                      : t.senseNearbyHiders}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
