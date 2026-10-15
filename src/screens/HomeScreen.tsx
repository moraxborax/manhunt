import React, { useEffect, useState } from 'react';
import { Globe, QrCode, Users, X, Zap } from 'lucide-react';
import { QrScannerModal } from '../components/QrModals';
import { useGame } from '../context/GameContext';
import { useI18n } from '../i18n/I18nContext';
import { parseRoomCodeFromScan } from '../types/game';

export const HomeScreen: React.FC<{ onToast: (msg: string) => void }> = ({
  onToast,
}) => {
  const {
    savedDisplayName,
    urlRoomCode,
    busy,
    reconnecting,
    error,
    clearError,
    createRoom,
    joinRoom,
  } = useGame();
  const { t, toggleLocale } = useI18n();

  const [name, setName] = useState(() => savedDisplayName);
  const [code, setCode] = useState(() => urlRoomCode ?? '');
  const [scanningRoomQr, setScanningRoomQr] = useState(false);

  useEffect(() => {
    if (error) {
      onToast(error);
      clearError();
    }
  }, [error, onToast, clearError]);

  if (reconnecting) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#0B120E] p-6 text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-[#2AFF9A] border-t-transparent" />
        <p className="text-sm text-white/70">{t.reconnecting}</p>
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onToast(t.enterYourNameError);
      return;
    }
    await createRoom(name.trim());
  };

  const handleJoin = async (targetCode?: string) => {
    const finalCode = (targetCode ?? code).trim().toUpperCase();
    if (!name.trim() || !finalCode) {
      onToast(t.enterNameAndCodeError);
      return;
    }
    await joinRoom(finalCode, name.trim());
  };

  const handleScanDetected = (raw: string) => {
    setScanningRoomQr(false);
    const parsed = parseRoomCodeFromScan(raw);
    if (!parsed) {
      onToast(t.invalidRoomQrError);
      return;
    }
    setCode(parsed);
    if (name.trim()) {
      void handleJoin(parsed);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[#0B120E] text-white">
      {/* Top Bar with Language Toggle */}
      <header className="flex items-center justify-between px-6 pt-5 pb-2">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#2AFF9A] shadow-[0_0_10px_#2AFF9A]" />
          <span className="text-xs font-semibold tracking-widest text-[#2AFF9A] uppercase">
            SHANGHAI · GCJ-02 READY
          </span>
        </div>
        <button
          type="button"
          onClick={toggleLocale}
          className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/10"
        >
          <Globe className="h-3.5 w-3.5 text-[#2AFF9A]" />
          <span>{t.langToggleLabel}</span>
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2AFF9A] sm:text-4xl">
            {t.appName}
          </h1>
          <p className="mt-1.5 text-sm text-white/65">{t.appSubtitle}</p>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/75">
              {t.yourName}
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.namePlaceholder}
                maxLength={24}
                className="w-full rounded-xl border border-white/15 bg-[#152018] py-3 pr-10 pl-4 text-base text-white placeholder-white/35 focus:border-[#2AFF9A] focus:outline-none"
              />
              {name.length > 0 && (
                <button
                  type="button"
                  onClick={() => setName('')}
                  aria-label="Clear name"
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg p-1 text-white/45 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2AFF9A] px-5 py-3.5 text-base font-bold text-[#05120C] shadow-[0_0_25px_rgba(42,255,154,0.2)] transition hover:bg-[#2AFF9A]/90 disabled:opacity-50"
          >
            <Zap className="h-5 w-5" />
            <span>{busy ? t.creatingRoom : t.createRoom}</span>
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs font-semibold tracking-wider text-white/40 uppercase">
            {t.orJoinExisting}
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="space-y-3">
          <div className="flex gap-2.5">
            <div className="relative flex-1">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={t.roomCodePlaceholder}
                maxLength={8}
                className="w-full rounded-xl border border-white/15 bg-[#152018] py-3 pr-9 pl-4 font-mono text-base tracking-widest text-white uppercase placeholder:font-sans placeholder:tracking-normal placeholder-white/35 focus:border-[#2AFF9A] focus:outline-none"
              />
              {code.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCode('')}
                  aria-label="Clear room code"
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg p-1 text-white/45 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleJoin()}
              className="flex items-center gap-1.5 rounded-xl border border-[#2AFF9A]/50 bg-[#2AFF9A]/10 px-5 py-3 font-bold text-[#2AFF9A] hover:bg-[#2AFF9A]/20 disabled:opacity-50"
            >
              <Users className="h-4 w-4" />
              <span>{t.join}</span>
            </button>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => setScanningRoomQr(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-white/85 hover:bg-white/10 disabled:opacity-50"
          >
            <QrCode className="h-4 w-4 text-[#2AFF9A]" />
            <span>{t.scanRoomQr}</span>
          </button>
        </div>
      </main>

      {scanningRoomQr && (
        <QrScannerModal
          title={t.scanRoomModalTitle}
          subtitle={t.scanRoomModalSubtitle}
          placeholder={t.pasteRoomCodePlaceholder}
          submitLabel={t.join}
          onDetected={handleScanDetected}
          onClose={() => setScanningRoomQr(false)}
        />
      )}
    </div>
  );
};
