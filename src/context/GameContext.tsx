import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DEFAULT_ROOM_SETTINGS,
  parseCatchPayload,
  type LatLng,
  type Player,
  type PlayerLocation,
  type Room,
  type RoomSettings,
} from '../types/game';
import { RoomSyncService } from '../services/roomSyncService';
import { SensorService } from '../services/sensorService';
import { distanceMeters } from '../utils/geoMath';

const LS_NAME = 'manhunt_displayName';
const LS_ROOM = 'manhunt_roomCode';
const LS_PLAYER = 'manhunt_playerId';

export interface GameContextValue {
  room: Room | null;
  me: Player | null;
  catchSecret: string | null;
  players: Player[];
  locations: Record<string, PlayerLocation>;
  myLocation: LatLng | null;
  myHeading: number | null;
  lobbySettings: RoomSettings;
  stealthMode: boolean;
  busy: boolean;
  reconnecting: boolean;
  error: string | null;
  scanActive: boolean;
  cooldownRemainingSec: number;
  isHost: boolean;
  isHunter: boolean;
  isHider: boolean;
  hidersRemaining: number;
  hiderLocations: PlayerLocation[];
  nearbyHiderCount: number;
  savedDisplayName: string;
  urlRoomCode: string | null;
  clearError: () => void;
  createRoom: (displayName: string) => Promise<boolean>;
  joinRoom: (code: string, displayName: string) => Promise<boolean>;
  updateDisplayName: (displayName: string) => Promise<boolean>;
  saveLobbySettings: (next: RoomSettings) => Promise<void>;
  startGame: () => Promise<void>;
  catchFromQr: (raw: string) => Promise<boolean>;
  activateManualScan: () => void;
  toggleStealth: () => void;
  requestCompass: () => Promise<boolean>;
  leaveRoom: () => Promise<void>;
  buildInviteUrl: () => string;
}

const GameContext = createContext<GameContextValue | null>(null);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const syncRef = useRef<RoomSyncService>(new RoomSyncService());
  const sensorsRef = useRef<SensorService>(new SensorService());

  const [room, setRoom] = useState<Room | null>(null);
  const [me, setMe] = useState<Player | null>(null);
  const [catchSecret, setCatchSecret] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [locations, setLocations] = useState<Record<string, PlayerLocation>>(
    {},
  );
  const [myLocation, setMyLocation] = useState<LatLng | null>(null);
  const [myHeading, setMyHeading] = useState<number | null>(null);
  const [lobbySettings, setLobbySettings] = useState<RoomSettings>(
    DEFAULT_ROOM_SETTINGS,
  );
  const [stealthMode, setStealthMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reconnecting, setReconnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanActive, setScanActive] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  const meRef = useRef<Player | null>(null);
  meRef.current = me;
  const roomRef = useRef<Room | null>(null);
  roomRef.current = room;
  const trackingActiveRef = useRef(false);
  const scanTimerRef = useRef<number | null>(null);

  const [savedDisplayName, setSavedDisplayName] = useState<string>(() => {
    try {
      return localStorage.getItem(LS_NAME) || '';
    } catch {
      return '';
    }
  });

  const urlRoomCode = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('room')?.trim().toUpperCase();
      return raw || null;
    } catch {
      return null;
    }
  }, []);

  const persistSession = useCallback(
    (displayName: string, roomCode: string, playerId: string) => {
      setSavedDisplayName(displayName);
      try {
        localStorage.setItem(LS_NAME, displayName);
        localStorage.setItem(LS_ROOM, roomCode);
        localStorage.setItem(LS_PLAYER, playerId);
      } catch {
        // ignore storage errors
      }
    },
    [],
  );

  const clearSavedRoom = useCallback(() => {
    try {
      localStorage.removeItem(LS_ROOM);
      localStorage.removeItem(LS_PLAYER);
    } catch {
      // ignore
    }
  }, []);

  const syncCallbacks = useMemo(
    () => ({
      onPlayersChange: (list: Player[]) => {
        setPlayers(list);
        void syncRef.current.getUserId().then((uid) => {
          if (!uid) return;
          const found = list.find((p) => p.userId === uid);
          if (found) setMe(found);
        });
      },
      onRoomChange: (nextRoom: Room) => {
        setRoom(nextRoom);
        setLobbySettings(nextRoom.settings);
      },
      onLocationsChange: (nextLocs: Record<string, PlayerLocation>) => {
        setLocations({ ...nextLocs });
      },
    }),
    [],
  );

  // Start / stop GPS & compass sensors when in an active game phase
  useEffect(() => {
    const phase = room?.phase;
    const shouldTrack = phase === 'hiding' || phase === 'hunting';
    if (shouldTrack && !trackingActiveRef.current) {
      trackingActiveRef.current = true;
      void sensorsRef.current.startTracking(
        (coord) => setMyLocation(coord),
        (heading) => setMyHeading(heading),
        (errMsg) => setError(errMsg),
      );
    } else if (!shouldTrack && trackingActiveRef.current) {
      trackingActiveRef.current = false;
      sensorsRef.current.stopTracking();
    }
  }, [room?.phase]);

  // Broadcast own location every 2 seconds. Do not depend on GPS/compass
  // state here: those update many times a second and were restarting this
  // timer (and flooding the realtime channel) on every tick.
  useEffect(() => {
    const phase = room?.phase;
    if (phase !== 'hiding' && phase !== 'hunting') return;

    const publish = () => {
      const loc = sensorsRef.current.lastLocation;
      const currentMe = meRef.current;
      if (!loc || !currentMe) return;
      void syncRef.current.broadcastLocation({
        playerId: currentMe.id,
        userId: currentMe.userId,
        lat: loc.lat,
        lng: loc.lng,
        heading: sensorsRef.current.lastHeading,
        updatedAt: new Date().toISOString(),
      });
    };

    publish();
    const id = window.setInterval(publish, 2000);
    return () => window.clearInterval(id);
  }, [room?.phase]);

  // 1-second ticker for head-start countdown, scan cooldown, and location expiry
  useEffect(() => {
    const phase = room?.phase;
    const live = phase === 'hiding' || phase === 'hunting';
    const hasCooldown = cooldownUntil !== null && cooldownUntil > Date.now();
    if (!live && !hasCooldown) return;

    const id = window.setInterval(() => {
      const now = Date.now();
      setNowTick(now);
      if (cooldownUntil !== null && now >= cooldownUntil) {
        setCooldownUntil(null);
      }
      const r = roomRef.current;
      if (
        r &&
        r.phase === 'hiding' &&
        r.hidingEndsAt &&
        now >= r.hidingEndsAt.getTime()
      ) {
        void syncRef.current
          .advanceToHunting(r.id)
          .then((updated) => setRoom(updated))
          .catch(() => {});
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [room?.phase, room?.hidingEndsAt, cooldownUntil]);

  // Reconnect saved session on initial page load
  useEffect(() => {
    let cancelled = false;
    async function tryReconnect() {
      let savedCode: string | null = null;
      try {
        savedCode = localStorage.getItem(LS_ROOM);
      } catch {
        savedCode = null;
      }
      if (!savedCode) {
        if (!cancelled) setReconnecting(false);
        return;
      }
      try {
        const res = await syncRef.current.tryResumeRoom(
          savedCode,
          syncCallbacks,
        );
        if (cancelled) return;
        if (!res) {
          clearSavedRoom();
        } else {
          setRoom(res.room);
          setMe(res.player);
          setCatchSecret(res.catchSecret);
          setLobbySettings(res.room.settings);
          persistSession(res.player.displayName, res.room.code, res.player.id);
        }
      } catch {
        clearSavedRoom();
      } finally {
        if (!cancelled) setReconnecting(false);
      }
    }
    void tryReconnect();
    return () => {
      cancelled = true;
    };
  }, [clearSavedRoom, persistSession, syncCallbacks]);

  const createRoom = useCallback(
    async (displayName: string): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const res = await syncRef.current.createRoom(
          displayName.trim(),
          lobbySettings,
          syncCallbacks,
        );
        setRoom(res.room);
        setMe(res.player);
        setCatchSecret(res.catchSecret);
        persistSession(res.player.displayName, res.room.code, res.player.id);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [lobbySettings, persistSession, syncCallbacks],
  );

  const joinRoom = useCallback(
    async (code: string, displayName: string): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const res = await syncRef.current.joinRoom(
          code.trim().toUpperCase(),
          displayName.trim(),
          syncCallbacks,
        );
        setRoom(res.room);
        setMe(res.player);
        setCatchSecret(res.catchSecret);
        setLobbySettings(res.room.settings);
        persistSession(res.player.displayName, res.room.code, res.player.id);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [persistSession, syncCallbacks],
  );

  const updateDisplayName = useCallback(
    async (displayName: string): Promise<boolean> => {
      const clean = displayName.trim();
      if (!clean) return false;
      setSavedDisplayName(clean);
      try {
        localStorage.setItem(LS_NAME, clean);
      } catch {
        // ignore
      }
      if (!me || !room) return true;
      setBusy(true);
      setError(null);
      try {
        const updated = await syncRef.current.updateDisplayName(me.id, clean);
        setMe(updated);
        persistSession(updated.displayName, room.code, updated.id);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [me, room, persistSession],
  );

  const saveLobbySettings = useCallback(
    async (next: RoomSettings) => {
      setLobbySettings(next);
      if (!room || !me?.isHost) return;
      try {
        await syncRef.current.updateRoomSettings(room.id, next);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [room, me?.isHost],
  );

  const startGame = useCallback(async () => {
    if (!room) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await syncRef.current.startGame(room.id);
      setRoom(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [room]);

  const catchFromQr = useCallback(
    async (raw: string): Promise<boolean> => {
      if (!room) return false;
      const payload = parseCatchPayload(raw);
      if (!payload) {
        setError('INVALID_CATCH_QR');
        return false;
      }
      if (payload.roomCode.toUpperCase() !== room.code.toUpperCase()) {
        setError('WRONG_ROOM_QR');
        return false;
      }
      setBusy(true);
      setError(null);
      try {
        await syncRef.current.catchPlayer({
          roomId: room.id,
          targetPlayerId: payload.playerId,
          catchSecret: payload.catchSecret,
        });
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [room],
  );

  const cooldownRemainingSec = useMemo(() => {
    if (!cooldownUntil) return 0;
    return Math.max(0, Math.ceil((cooldownUntil - nowTick) / 1000));
  }, [cooldownUntil, nowTick]);

  const activateManualScan = useCallback(() => {
    if (!room || scanActive || cooldownRemainingSec > 0) return;
    const diff = room.settings.difficulty;
    if (diff !== 2 && diff !== 4) return;

    setScanActive(true);
    if (scanTimerRef.current !== null) {
      window.clearTimeout(scanTimerRef.current);
    }
    scanTimerRef.current = window.setTimeout(() => {
      scanTimerRef.current = null;
      setScanActive(false);
      const cdMs = (roomRef.current?.settings.scanCooldownSeconds ?? 45) * 1000;
      setCooldownUntil(Date.now() + cdMs);
      setNowTick(Date.now());
    }, 8000);
  }, [room, scanActive, cooldownRemainingSec]);

  const toggleStealth = useCallback(() => {
    setStealthMode((prev) => {
      const next = !prev;
      if (next) {
        void sensorsRef.current.requestWakeLock();
      }
      return next;
    });
  }, []);

  const requestCompass = useCallback(async () => {
    return sensorsRef.current.requestCompassPermission();
  }, []);

  const leaveRoom = useCallback(async () => {
    const roomId = roomRef.current?.id;
    if (roomId) {
      try {
        await syncRef.current.leaveRoom(roomId);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return;
      }
    }
    if (scanTimerRef.current !== null) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    trackingActiveRef.current = false;
    sensorsRef.current.stopTracking();
    await syncRef.current.unsubscribe();
    setRoom(null);
    setMe(null);
    setCatchSecret(null);
    setPlayers([]);
    setLocations({});
    setMyLocation(null);
    setMyHeading(null);
    setStealthMode(false);
    setScanActive(false);
    setCooldownUntil(null);
    setLobbySettings(DEFAULT_ROOM_SETTINGS);
    clearSavedRoom();
  }, [clearSavedRoom]);

  const buildInviteUrl = useCallback(() => {
    const url = new URL(window.location.href);
    if (room?.code) {
      url.searchParams.set('room', room.code);
    }
    return url.toString();
  }, [room?.code]);

  const isHost = Boolean(me?.isHost);
  const isHunter = me?.role === 'hunter';
  const isHider = me?.role === 'hider';

  const hidersRemaining = useMemo(
    () => players.filter((p) => p.role === 'hider').length,
    [players],
  );

  const hiderLocations = useMemo(() => {
    const hiderIds = new Set(
      players.filter((p) => p.role === 'hider').map((p) => p.id),
    );
    return Object.values(locations).filter((l) => {
      if (l.playerId === me?.id || !hiderIds.has(l.playerId)) return false;
      const at = Date.parse(l.updatedAt);
      return !Number.isFinite(at) || nowTick - at < 30_000;
    });
  }, [players, locations, me?.id, nowTick]);

  const nearbyHiderCount = useMemo(() => {
    if (!myLocation || !room) return 0;
    const radius = room.settings.proximityRadiusM;
    return hiderLocations.filter((l) => {
      if (l.playerId === me?.id) return false;
      return distanceMeters(myLocation, { lat: l.lat, lng: l.lng }) <= radius;
    }).length;
  }, [myLocation, room, hiderLocations, me?.id]);

  const clearError = useCallback(() => setError(null), []);

  return (
    <GameContext.Provider
      value={{
        room,
        me,
        catchSecret,
        players,
        locations,
        myLocation,
        myHeading,
        lobbySettings,
        stealthMode,
        busy,
        reconnecting,
        error,
        scanActive,
        cooldownRemainingSec,
        isHost,
        isHunter,
        isHider,
        hidersRemaining,
        hiderLocations,
        nearbyHiderCount,
        savedDisplayName,
        urlRoomCode,
        clearError,
        createRoom,
        joinRoom,
        updateDisplayName,
        saveLobbySettings,
        startGame,
        catchFromQr,
        activateManualScan,
        toggleStealth,
        requestCompass,
        leaveRoom,
        buildInviteUrl,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside GameProvider');
  return ctx;
}
