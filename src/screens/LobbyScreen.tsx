import React, { useState } from 'react';
import {
  Check,
  Compass,
  Copy,
  Crown,
  Globe,
  LogOut,
  Minus,
  Pencil,
  Play,
  Plus,
  QrCode,
  Share2,
  User,
  X,
} from 'lucide-react';
import { LobbyInviteQrModal } from '../components/QrModals';
import { useGame } from '../context/GameContext';
import { useI18n } from '../i18n/I18nContext';
import { shareInviteUrl } from '../services/shareService';
import { clampDifficulty, type DifficultyLevel } from '../types/game';

export const LobbyScreen: React.FC<{ onToast: (msg: string) => void }> = ({
  onToast,
}) => {
  const {
    room,
    me,
    players,
    lobbySettings,
    isHost,
    busy,
    updateDisplayName,
    saveLobbySettings,
    startGame,
    requestCompass,
    leaveRoom,
    buildInviteUrl,
  } = useGame();
  const { t, toggleLocale } = useI18n();
  const [showInviteQr, setShowInviteQr] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');

  if (!room) return null;

  const startEditingName = () => {
    setDraftName(me?.displayName ?? '');
    setEditingName(true);
  };

  const commitEditingName = async () => {
    const trimmed = draftName.trim();
    if (!trimmed) {
      onToast(t.enterYourNameError);
      return;
    }
    const ok = await updateDisplayName(trimmed);
    if (ok) {
      setEditingName(false);
    }
  };

  const activeSettings = isHost ? lobbySettings : room.settings;
  const diffMeta = t.difficulties[activeSettings.difficulty];

  const handleShare = async () => {
    const res = await shareInviteUrl({
      title: `Manhunt · ${room.code}`,
      text: `${t.inviteSheetTitle(room.code)}`,
      url: buildInviteUrl(),
    });
    if (res === 'shared') onToast(t.inviteSharedToast);
    else if (res === 'copied') onToast(t.joinLinkCopiedToast);
    else onToast(t.shareFailedToast);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      onToast(t.roomCodeCopiedToast);
    } catch {
      // ignore
    }
  };

  const handleStartGame = async () => {
    await requestCompass();
    await startGame();
  };

  const handleCompass = async () => {
    const ok = await requestCompass();
    if (ok) onToast(t.compassEnabledToast);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[#0B120E] text-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 bg-[#152018]/80 px-4 py-3.5 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-lg font-extrabold tracking-wider text-[#2AFF9A]">
            {t.roomLabel(room.code)}
          </span>
          <button
            type="button"
            onClick={handleCopyCode}
            title={t.copyCode}
            className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <Copy className="h-4 w-4" />
          </button>
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
          <button
            type="button"
            onClick={() => void leaveRoom()}
            title={t.leaveRoom}
            className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-red-400"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 space-y-6 p-5">
        {/* Invite Card */}
        <section className="rounded-2xl border border-white/10 bg-[#152018] p-4 shadow-lg">
          <h2 className="text-base font-bold text-white">
            {t.inviteFriendsTitle}
          </h2>
          <p className="mt-1 text-xs text-white/60">
            {t.inviteFriendsSubtitle}
          </p>
          <div className="mt-3.5 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setShowInviteQr(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              <QrCode className="h-4 w-4 text-[#2AFF9A]" />
              <span>{t.showQr}</span>
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#2AFF9A] px-3 py-2.5 text-sm font-bold text-[#05120C] hover:bg-[#2AFF9A]/90"
            >
              <Share2 className="h-4 w-4" />
              <span>{t.shareLink}</span>
            </button>
          </div>
        </section>

        {/* Players Roster */}
        <section>
          <h3 className="mb-2.5 text-sm font-bold tracking-wide text-white/80 uppercase">
            {t.playersHeading(players.length)}
          </h3>
          <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-[#152018]">
            {players.map((p) => {
              const isMe = p.id === me?.id;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="flex flex-1 items-center gap-3 pr-2">
                    {p.isHost ? (
                      <Crown className="h-4 w-4 shrink-0 text-[#2AFF9A]" />
                    ) : (
                      <User className="h-4 w-4 shrink-0 text-white/50" />
                    )}
                    {isMe && editingName ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void commitEditingName();
                        }}
                        className="flex flex-1 items-center gap-1.5"
                      >
                        <input
                          type="text"
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          placeholder={t.namePlaceholder}
                          maxLength={24}
                          autoFocus
                          className="w-full rounded-lg border border-[#2AFF9A] bg-[#0B120E] px-2.5 py-1 text-sm text-white focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={busy}
                          className="rounded-lg bg-[#2AFF9A] p-1.5 text-[#05120C] hover:bg-[#2AFF9A]/90"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingName(false)}
                          className="rounded-lg bg-white/10 p-1.5 text-white/70 hover:bg-white/20"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    ) : (
                      <>
                        <span className="font-medium text-white">
                          {p.displayName}
                        </span>
                        {isMe && (
                          <>
                            <span className="rounded-md bg-[#2AFF9A]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#2AFF9A]">
                              {t.youBadge}
                            </span>
                            <button
                              type="button"
                              onClick={startEditingName}
                              aria-label="Edit display name"
                              className="rounded-md p-1 text-white/45 hover:bg-white/10 hover:text-[#2AFF9A]"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  <span className="text-xs text-white/50">
                    {p.isHost ? t.hostBadge : t.joinedBadge}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Difficulty & Rules Settings */}
        <section className="rounded-2xl border border-white/10 bg-[#152018] p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#2AFF9A]">
                {t.difficultyHeading(diffMeta.label)}
              </span>
            </div>
            <p className="mt-1 text-xs text-white/65">{diffMeta.description}</p>
          </div>

          {isHost ? (
            <>
              {/* 5 Difficulty Pills */}
              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {([0, 1, 2, 3, 4] as DifficultyLevel[]).map((lvl) => {
                  const selected = activeSettings.difficulty === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() =>
                        void saveLobbySettings({
                          ...activeSettings,
                          difficulty: clampDifficulty(lvl),
                        })
                      }
                      className={`rounded-xl py-2 text-xs font-bold transition ${
                        selected
                          ? 'bg-[#2AFF9A] text-[#05120C] shadow-[0_0_15px_rgba(42,255,154,0.3)]'
                          : 'border border-white/10 bg-[#0B120E] text-white/70 hover:bg-white/5'
                      }`}
                    >
                      Lv{lvl}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2.5 pt-2">
                <StepperRow
                  label={t.initialHunters}
                  value={activeSettings.hunterCount}
                  min={1}
                  max={5}
                  step={1}
                  onChange={(v) =>
                    void saveLobbySettings({ ...activeSettings, hunterCount: v })
                  }
                />
                <StepperRow
                  label={t.headStartSeconds}
                  value={activeSettings.headStartSeconds}
                  min={0}
                  max={180}
                  step={15}
                  onChange={(v) =>
                    void saveLobbySettings({
                      ...activeSettings,
                      headStartSeconds: v,
                    })
                  }
                />
                <StepperRow
                  label={t.scanCooldownSeconds}
                  value={activeSettings.scanCooldownSeconds}
                  min={15}
                  max={120}
                  step={15}
                  onChange={(v) =>
                    void saveLobbySettings({
                      ...activeSettings,
                      scanCooldownSeconds: v,
                    })
                  }
                />
                <StepperRow
                  label={t.proximityRadiusM}
                  value={activeSettings.proximityRadiusM}
                  min={20}
                  max={150}
                  step={10}
                  onChange={(v) =>
                    void saveLobbySettings({
                      ...activeSettings,
                      proximityRadiusM: v,
                    })
                  }
                />
              </div>

              <button
                type="button"
                disabled={busy || players.length < 2}
                onClick={() => void handleStartGame()}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2AFF9A] px-5 py-3.5 text-base font-bold text-[#05120C] shadow-[0_0_25px_rgba(42,255,154,0.2)] transition hover:bg-[#2AFF9A]/90 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none"
              >
                <Play className="h-5 w-5 fill-current" />
                <span>
                  {players.length < 2 ? t.needTwoPlayers : t.startGame}
                </span>
              </button>
            </>
          ) : (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-white/75">{t.waitingForHost}</p>
              <button
                type="button"
                onClick={() => void handleCompass()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white/85 hover:bg-white/10"
              >
                <Compass className="h-4 w-4 text-[#2AFF9A]" />
                <span>{t.enableCompass}</span>
              </button>
            </div>
          )}
        </section>
      </main>

      {showInviteQr && (
        <LobbyInviteQrModal
          onClose={() => setShowInviteQr(false)}
          onToast={onToast}
        />
      )}
    </div>
  );
};

const StepperRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
}> = ({ label, value, min, max, step, onChange }) => {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-white/85">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - step))}
          className="rounded-lg border border-white/15 bg-[#0B120E] p-1.5 text-white/80 hover:border-[#2AFF9A] disabled:opacity-30"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-10 text-center font-mono text-sm font-bold text-white">
          {value}
        </span>
        <button
          type="button"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + step))}
          className="rounded-lg border border-white/15 bg-[#0B120E] p-1.5 text-white/80 hover:border-[#2AFF9A] disabled:opacity-30"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
