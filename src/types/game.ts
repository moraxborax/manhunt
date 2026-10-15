export type PlayerRole = 'hunter' | 'hider';

export type GamePhase = 'lobby' | 'hiding' | 'hunting' | 'ended';

export type DifficultyLevel = 0 | 1 | 2 | 3 | 4;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RoomSettings {
  difficulty: DifficultyLevel;
  hunterCount: number;
  headStartSeconds: number;
  scanCooldownSeconds: number;
  proximityRadiusM: number;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  difficulty: 0,
  hunterCount: 1,
  headStartSeconds: 60,
  scanCooldownSeconds: 45,
  proximityRadiusM: 50,
};

export interface Player {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  role: PlayerRole;
  isHost: boolean;
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  settings: RoomSettings;
  phase: GamePhase;
  hidingEndsAt: Date | null;
}

export interface PlayerLocation {
  playerId: string;
  userId: string;
  lat: number;
  lng: number;
  heading?: number | null;
  updatedAt: string;
}

export interface CatchPayload {
  roomCode: string;
  playerId: string;
  catchSecret: string;
}

export function clampDifficulty(v: number): DifficultyLevel {
  if (v === 1 || v === 2 || v === 3 || v === 4) return v;
  return 0;
}

export function playerFromRow(row: Record<string, unknown>): Player {
  return {
    id: String(row.id),
    roomId: String(row.room_id),
    userId: String(row.user_id),
    displayName: String(row.display_name),
    role: row.role === 'hunter' ? 'hunter' : 'hider',
    isHost: Boolean(row.is_host),
  };
}

export function roomFromRow(row: Record<string, unknown>): Room {
  const rawPhase = String(row.phase ?? 'lobby');
  const phase: GamePhase =
    rawPhase === 'hiding' || rawPhase === 'hunting' || rawPhase === 'ended'
      ? rawPhase
      : 'lobby';

  return {
    id: String(row.id),
    code: String(row.code),
    hostId: String(row.host_id),
    settings: {
      difficulty: clampDifficulty(Number(row.difficulty ?? 0)),
      hunterCount: Number(row.hunter_count ?? 1),
      headStartSeconds: Number(row.head_start_seconds ?? 60),
      scanCooldownSeconds: Number(row.scan_cooldown_seconds ?? 45),
      proximityRadiusM: Number(row.proximity_radius_m ?? 50),
    },
    phase,
    hidingEndsAt: row.hiding_ends_at
      ? new Date(String(row.hiding_ends_at))
      : null,
  };
}

export function encodeCatchPayload(p: CatchPayload): string {
  return `manhunt:${p.roomCode}:${p.playerId}:${p.catchSecret}`;
}

export function parseCatchPayload(raw: string): CatchPayload | null {
  const parts = raw.trim().split(':');
  if (parts.length !== 4 || parts[0] !== 'manhunt') return null;
  const [, roomCode, playerId, catchSecret] = parts;
  if (!roomCode || !playerId || !catchSecret) return null;
  return { roomCode, playerId, catchSecret };
}

export function parseRoomCodeFromScan(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get('room')?.trim().toUpperCase();
    if (fromQuery) return fromQuery;
  } catch {
    // Not a full URL; fall through to alphanumeric code check
  }
  const upper = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (upper.length >= 4 && upper.length <= 8) return upper;
  return null;
}
