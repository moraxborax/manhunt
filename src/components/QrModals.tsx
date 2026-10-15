import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, Copy, QrCode, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useGame } from '../context/GameContext';
import { useI18n } from '../i18n/I18nContext';
import { encodeCatchPayload, parseCatchPayload, parseRoomCodeFromScan } from '../types/game';

export const HiderCatchQrModal: React.FC<{
  onClose: () => void;
  onToast: (msg: string) => void;
}> = ({ onClose, onToast }) => {
  const { room, me, catchSecret } = useGame();
  const { t } = useI18n();

  if (!room || !me || !catchSecret) return null;

  const payload = encodeCatchPayload({
    roomCode: room.code,
    playerId: me.id,
    catchSecret,
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      onToast(t.catchCodeCopiedToast);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#152018] p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[#2AFF9A]" />
            <h3 className="text-lg font-bold text-white">
              {t.catchQrModalTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-sm text-white/70">{t.catchQrModalSubtitle}</p>

        <div className="my-6 flex justify-center">
          <div className="rounded-2xl bg-white p-4 shadow-inner">
            <QRCodeSVG value={payload} size={220} level="M" />
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-medium text-white/80 hover:bg-white/10"
        >
          <Copy className="h-4 w-4" />
          <span>{t.copyCatchCodeFallback}</span>
        </button>
      </div>
    </div>
  );
};

export const LobbyInviteQrModal: React.FC<{
  onClose: () => void;
  onToast: (msg: string) => void;
}> = ({ onClose, onToast }) => {
  const { room, buildInviteUrl } = useGame();
  const { t } = useI18n();

  if (!room) return null;
  const inviteUrl = buildInviteUrl();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      onToast(t.joinLinkCopiedToast);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#152018] p-6 text-center shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">
            {t.inviteSheetTitle(room.code)}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-sm text-white/70">{t.inviteSheetSubtitle}</p>

        <div className="my-5 flex justify-center">
          <div className="rounded-2xl bg-white p-4 shadow-inner">
            <QRCodeSVG value={inviteUrl} size={220} level="M" />
          </div>
        </div>

        <div className="mb-4 font-mono text-2xl font-extrabold tracking-[0.25em] text-[#2AFF9A]">
          {room.code}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2AFF9A] px-4 py-3 font-bold text-[#05120C] hover:bg-[#2AFF9A]/90"
        >
          <Copy className="h-4 w-4" />
          <span>{t.copyInviteLink}</span>
        </button>
      </div>
    </div>
  );
};

export const QrScannerModal: React.FC<{
  title: string;
  subtitle?: string;
  placeholder: string;
  submitLabel: string;
  onDetected: (value: string) => void;
  onClose: () => void;
}> = ({
  title,
  subtitle,
  placeholder,
  submitLabel,
  onDetected,
  onClose,
}) => {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onDetectedRef = useRef(onDetected);
  const [manualInput, setManualInput] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const handledRef = useRef(false);
  onDetectedRef.current = onDetected;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let rafId: number | null = null;
    let cancelled = false;
    let lastScan = 0;
    let busy = false;

    const Detector = (
      window as Window & {
        BarcodeDetector?: new (opts: { formats: string[] }) => {
          detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
        };
      }
    ).BarcodeDetector;
    let detector: {
      detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
    } | null = null;
    if (typeof Detector === 'function') {
      try {
        detector = new Detector({ formats: ['qr_code'] });
      } catch {
        detector = null;
      }
    }

    function accept(text: string) {
      if (
        !text ||
        handledRef.current ||
        (parseCatchPayload(text) == null && parseRoomCodeFromScan(text) == null)
      ) {
        return;
      }
      handledRef.current = true;
      onDetectedRef.current(text);
    }

    async function startCamera() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setCameraError('Camera requires HTTPS');
        }
        return;
      }
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const scanLoop = (now: number) => {
          if (cancelled || handledRef.current) return;
          rafId = window.requestAnimationFrame(scanLoop);
          if (busy || now - lastScan < 200) return;
          lastScan = now;

          const v = videoRef.current;
          const c = canvasRef.current;
          if (!v || !c || v.readyState < v.HAVE_ENOUGH_DATA) return;
          const vw = v.videoWidth;
          const vh = v.videoHeight;
          if (!vw || !vh) return;

          // object-cover in a square shows the center square; the viewfinder
          // is inset inside that square.
          const frame = Math.min(vw, vh);
          const inner = frame * 0.72;
          const sx = (vw - inner) / 2;
          const sy = (vh - inner) / 2;
          const scale = Math.min(1, 480 / inner);
          const side = Math.max(1, Math.round(inner * scale));
          if (c.width !== side) c.width = side;
          if (c.height !== side) c.height = side;
          const ctx = c.getContext('2d', { willReadFrequently: true });
          if (!ctx) return;
          ctx.drawImage(v, sx, sy, inner, inner, 0, 0, side, side);

          busy = true;
          void (async () => {
            try {
              if (detector) {
                const codes = await detector.detect(c);
                accept(codes[0]?.rawValue?.trim() ?? '');
                return;
              }
              const img = ctx.getImageData(0, 0, side, side);
              const code = jsQR(img.data, img.width, img.height, {
                inversionAttempts: 'attemptBoth',
              });
              accept(code?.data?.trim() ?? '');
            } catch {
              // A detector failure falls through to the next frame.
            } finally {
              busy = false;
            }
          })();
        };
        rafId = window.requestAnimationFrame(scanLoop);
      } catch (err) {
        if (!cancelled) {
          setCameraError(
            err instanceof Error ? err.message : 'Camera permission denied',
          );
        }
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      if (stream) {
        stream.getTracks().forEach((tr) => tr.stop());
      }
    };
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handledRef.current = true;
    onDetected(manualInput.trim());
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#152018] p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-[#2AFF9A]" />
            <h3 className="text-lg font-bold text-white">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {subtitle && <p className="mt-1 text-xs text-white/60">{subtitle}</p>}

        <div className="relative my-4 aspect-square w-full overflow-hidden rounded-xl border border-white/15 bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          <div className="pointer-events-none absolute inset-10 rounded-2xl border-2 border-[#2AFF9A]/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/85 p-4 text-center text-xs text-red-400">
              {cameraError}
            </div>
          )}
        </div>

        <p className="mb-2 text-xs text-white/60">
          {t.cameraUnavailableFallback}
        </p>

        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder={placeholder}
            className="flex-1 rounded-xl border border-white/15 bg-[#0B120E] px-3.5 py-2.5 text-sm text-white placeholder-white/35 focus:border-[#2AFF9A] focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-[#2AFF9A] px-4 py-2.5 text-sm font-bold text-[#05120C] hover:bg-[#2AFF9A]/90"
          >
            {submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
};
