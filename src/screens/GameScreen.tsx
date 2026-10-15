import React, { useEffect, useState } from 'react';
import {
  EyeOff,
  Globe,
  Home,
  LogOut,
  QrCode,
  ScanLine,
  ShieldAlert,
} from 'lucide-react';
import { MapViewLevel0 } from '../components/MapViewLevel0';
import { ProximityViewLevel34 } from '../components/ProximityViewLevel34';
import { HiderCatchQrModal, QrScannerModal } from '../components/QrModals';
import { RadarViewLevel12 } from '../components/RadarViewLevel12';
import { useGame } from '../context/GameContext';
import { useI18n } from '../i18n/I18nContext';

export const GameScreen: React.FC<{ onToast: (msg: string) => void }> = ({
  onToast,
}) => {
  const {
    room,
    isHunter,
    isHider,
    hidersRemaining,
    stealthMode,
    error,
    clearError,
    toggleStealth,
    catchFromQr,
    leaveRoom,
  } = useGame();
  const { t, toggleLocale } = useI18n();

  const [showCatchQr, setShowCatchQr] = useState(false);
  const [showHunterScanner, setShowHunterScanner] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (!room?.hidingEndsAt || room.phase !== 'hiding') {
      setSecondsLeft(0);
      return;
    }
    const update = () => {
      const diff = Math.ceil(
        (room.hidingEndsAt!.getTime() - Date.now()) / 1000,
      );
      setSecondsLeft(Math.max(0, diff));
    };
    update();
    const id = window.setInterval(update, 500);
    return () => window.clearInterval(id);
  }, [room?.hidingEndsAt, room?.phase]);

  useEffect(() => {
    if (!error) return;
    if (error === 'INVALID_CATCH_QR') {
      onToast(t.invalidCatchQrError);
    } else if (error === 'WRONG_ROOM_QR') {
      onToast(t.wrongRoomQrError);
    } else {
      onToast(error);
    }
    clearError();
  }, [error, onToast, clearError, t.invalidCatchQrError, t.wrongRoomQrError]);

  if (!room) return null;

  // Stealth / Pocket Blackout Mode
  if (stealthMode) {
    return (
      <div
        onClick={toggleStealth}
        className="fixed inset-0 z-[2000] flex cursor-pointer select-none flex-col items-center justify-center bg-black text-center"
      >
        <p className="text-base font-bold tracking-widest text-neutral-800">
          {t.stealthTitle}
        </p>
        <p className="mt-1 text-xs text-neutral-800">{t.stealthSubtitle}</p>
      </div>
    );
  }

  const ended = room.phase === 'ended';
  const difficulty = room.settings.difficulty;
  const diffMeta = t.difficulties[difficulty];

  let phaseBannerText = t.lobbyBanner;
  if (room.phase === 'hiding') {
    phaseBannerText =
      secondsLeft > 0
        ? t.headStartBanner(secondsLeft)
        : t.headStartEnding;
  } else if (room.phase === 'hunting') {
    phaseBannerText = t.huntingBanner(hidersRemaining);
  } else if (room.phase === 'ended') {
    phaseBannerText = t.gameOverBanner;
  }

  const handleCatchScanned = async (raw: string) => {
    setShowHunterScanner(false);
    await catchFromQr(raw);
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#0B120E] text-white">
      {/* App Bar */}
      <header className="flex items-center justify-between border-b border-white/10 bg-[#152018] px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              isHunter
                ? 'bg-[#FF5252] shadow-[0_0_10px_#FF5252]'
                : 'bg-[#2AFF9A] shadow-[0_0_10px_#2AFF9A]'
            }`}
          />
          <span
            className={`text-base font-extrabold tracking-wider ${
              isHunter ? 'text-[#FF5252]' : 'text-[#2AFF9A]'
            }`}
          >
            {isHunter ? t.hunterRole : t.hiderRole}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleLocale}
            className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/85 hover:bg-white/10"
          >
            <Globe className="h-3.5 w-3.5 text-[#2AFF9A]" />
            <span>{t.langToggleLabel}</span>
          </button>

          {!ended && (
            <button
              type="button"
              onClick={toggleStealth}
              title={t.stealthTooltip}
              className="rounded-lg p-2 text-white/75 hover:bg-white/10 hover:text-white"
            >
              <EyeOff className="h-5 w-5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => void leaveRoom()}
            title={t.leaveRoom}
            className="rounded-lg p-2 text-white/75 hover:bg-white/10 hover:text-red-400"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Status Banner */}
      <div className="border-b border-white/10 bg-[#152018]/70 px-4 py-2.5">
        <div className="text-sm font-bold text-white">{phaseBannerText}</div>
        <div className="text-xs text-white/55">
          {t.roomLabel(room.code)} · {diffMeta.label}
        </div>
      </div>

      {ended && (
        <div className="px-4 pt-3">
          <button
            type="button"
            onClick={() => void leaveRoom()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2AFF9A] px-4 py-3 font-bold text-[#05120C]"
          >
            <Home className="h-4 w-4" />
            <span>{t.backToHome}</span>
          </button>
        </div>
      )}

      {/* Main Difficulty Body */}
      <div className="relative flex-1 overflow-hidden">
        {isHider ? (
          difficulty === 0 ? (
            <MapViewLevel0 />
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2AFF9A]/10 text-[#2AFF9A]">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <p className="max-w-sm text-lg font-semibold text-white/90">
                {ended ? t.hiderEndedMessage : t.hiderStayHiddenMessage}
              </p>
            </div>
          )
        ) : difficulty === 0 ? (
          <MapViewLevel0 />
        ) : difficulty === 1 || difficulty === 2 ? (
          <RadarViewLevel12 />
        ) : (
          <ProximityViewLevel34 />
        )}
      </div>

      {/* Bottom Action Bar */}
      {!ended && (
        <div className="border-t border-white/10 bg-[#152018] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {isHider ? (
            <button
              type="button"
              onClick={() => setShowCatchQr(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2AFF9A] px-5 py-3.5 text-base font-bold text-[#05120C] shadow-lg active:scale-[0.99]"
            >
              <QrCode className="h-5 w-5" />
              <span>{t.showCatchQr}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={room.phase !== 'hunting'}
              onClick={() => setShowHunterScanner(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF5252] px-5 py-3.5 text-base font-bold text-white shadow-lg active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none"
            >
              <ScanLine className="h-5 w-5" />
              <span>
                {room.phase === 'hiding' ? t.radarBlinded : t.scanToCatch}
              </span>
            </button>
          )}
        </div>
      )}

      {showCatchQr && (
        <HiderCatchQrModal
          onClose={() => setShowCatchQr(false)}
          onToast={onToast}
        />
      )}

      {showHunterScanner && (
        <QrScannerModal
          title={t.scanCatchModalTitle}
          placeholder={t.pasteCatchCodePlaceholder}
          submitLabel={t.submitCatchCode}
          onDetected={(raw) => void handleCatchScanned(raw)}
          onClose={() => setShowHunterScanner(false)}
        />
      )}
    </div>
  );
};
