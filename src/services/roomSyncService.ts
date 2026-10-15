import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import {
  playerFromRow,
  roomFromRow,
  type Player,
  type PlayerLocation,
  type Room,
  type RoomSettings,
} from '../types/game';

export interface SyncCallbacks {
  onPlayersChange: (players: Player[]) => void;
  onRoomChange: (room: Room) => void;
  onLocationsChange: (locations: Record<string, PlayerLocation>) => void;
}

function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const array = new Uint32Array(6);
  crypto.getRandomValues(array);
  return Array.from(array, (n) => chars[n % chars.length]).join('');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function locationFromMap(
  raw: Record<string, unknown> | null,
): PlayerLocation | null {
  if (!raw || raw.playerId == null || raw.lat == null || raw.lng == null) {
    return null;
  }
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const heading = raw.heading == null ? null : Number(raw.heading);
  return {
    playerId: String(raw.playerId),
    userId: String(raw.userId ?? ''),
    lat,
    lng,
    heading: heading !== null && Number.isFinite(heading) ? heading : null,
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  };
}

function readLocationMessage(msg: unknown): PlayerLocation | null {
  const root = asRecord(msg);
  if (!root) return null;
  return locationFromMap(asRecord(root.payload)) ?? locationFromMap(root);
}

export class RoomSyncService {
  private dataChannel: RealtimeChannel | null = null;
  private broadcastChannel: RealtimeChannel | null = null;
  private locations: Record<string, PlayerLocation> = {};
  private currentRoomId: string | null = null;
  private callbacks: SyncCallbacks | null = null;
  private broadcastReady = false;
  private lastRefreshedPhase: string | null = null;

  async getUserId(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  }

  async ensureAnonymousSession(): Promise<string> {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user) {
      return sessionData.session.user.id;
    }
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) {
      throw new Error(
        error?.message ||
          'Anonymous sign-in failed. Enable Anonymous Sign-Ins in Supabase Dashboard.',
      );
    }
    return data.user.id;
  }

  async createRoom(
    displayName: string,
    settings: RoomSettings,
    callbacks: SyncCallbacks,
  ): Promise<{ room: Room; player: Player; catchSecret: string }> {
    await this.ensureAnonymousSession();
    const catchSecret = generateUuidV4();
    const code = generateRoomCode();

    const { data, error } = await supabase.rpc('create_room', {
      p_code: code,
      p_display_name: displayName,
      p_catch_secret: catchSecret,
      p_difficulty: settings.difficulty,
      p_hunter_count: settings.hunterCount,
      p_head_start_seconds: settings.headStartSeconds,
      p_scan_cooldown_seconds: settings.scanCooldownSeconds,
      p_proximity_radius_m: settings.proximityRadiusM,
    });

    if (error || !data) {
      throw new Error(error?.message || 'Failed to create room');
    }

    const payload = data as {
      room: Record<string, unknown>;
      player: Record<string, unknown>;
    };
    const room = roomFromRow(payload.room);
    const player = playerFromRow(payload.player);
    await this.subscribe(room, callbacks);
    return { room, player, catchSecret };
  }

  async joinRoom(
    code: string,
    displayName: string,
    callbacks: SyncCallbacks,
  ): Promise<{ room: Room; player: Player; catchSecret: string }> {
    await this.ensureAnonymousSession();
    const catchSecret = generateUuidV4();
    const cleanCode = code.trim().toUpperCase();

    const { data: roomRow, error: roomErr } = await supabase.rpc(
      'get_room_by_code',
      { p_code: cleanCode },
    );
    if (roomErr || !roomRow) {
      throw new Error(roomErr?.message || 'Room not found / 找不到该房间');
    }
    const room = roomFromRow(roomRow as Record<string, unknown>);

    const { data: playerRow, error: joinErr } = await supabase.rpc(
      'join_room',
      {
        p_code: cleanCode,
        p_display_name: displayName,
        p_catch_secret: catchSecret,
      },
    );
    if (joinErr || !playerRow) {
      throw new Error(joinErr?.message || 'Failed to join room');
    }
    let player = playerFromRow(playerRow as Record<string, unknown>);
    if (player.displayName !== displayName) {
      const { data: updatedRow } = await supabase
        .from('players')
        .update({ display_name: displayName })
        .eq('id', player.id)
        .select('*')
        .maybeSingle();
      if (updatedRow) {
        player = playerFromRow(updatedRow as Record<string, unknown>);
      }
    }
    await this.subscribe(room, callbacks);
    return { room, player, catchSecret };
  }

  async updateDisplayName(
    playerId: string,
    displayName: string,
  ): Promise<Player> {
    const clean = displayName.trim();
    const { data, error } = await supabase
      .from('players')
      .update({ display_name: clean })
      .eq('id', playerId)
      .select('*')
      .single();
    if (error || !data) {
      throw new Error(error?.message || 'Failed to update display name');
    }
    const updated = playerFromRow(data as Record<string, unknown>);
    await this.refreshPlayersAndRoom();
    return updated;
  }

  async updateRoomSettings(
    roomId: string,
    settings: RoomSettings,
  ): Promise<void> {
    const { error } = await supabase
      .from('rooms')
      .update({
        difficulty: settings.difficulty,
        hunter_count: settings.hunterCount,
        head_start_seconds: settings.headStartSeconds,
        scan_cooldown_seconds: settings.scanCooldownSeconds,
        proximity_radius_m: settings.proximityRadiusM,
      })
      .eq('id', roomId);
    if (error) throw new Error(error.message);
  }

  async startGame(roomId: string): Promise<Room> {
    const { data, error } = await supabase.rpc('start_game', {
      p_room_id: roomId,
    });
    if (error || !data) {
      throw new Error(error?.message || 'Failed to start game');
    }
    const room = roomFromRow(data as Record<string, unknown>);
    this.lastRefreshedPhase = room.phase;
    await this.refreshPlayersAndRoom();
    return room;
  }

  async advanceToHunting(roomId: string): Promise<Room> {
    const { data, error } = await supabase.rpc('advance_to_hunting', {
      p_room_id: roomId,
    });
    if (error || !data) {
      throw new Error(error?.message || 'Failed to advance game phase');
    }
    const room = roomFromRow(data as Record<string, unknown>);
    if (room.phase !== 'hiding' && this.lastRefreshedPhase !== room.phase) {
      this.lastRefreshedPhase = room.phase;
      await this.refreshPlayersAndRoom();
    }
    return room;
  }

  async leaveRoom(roomId: string): Promise<void> {
    const { error } = await supabase.rpc('leave_room', { p_room_id: roomId });
    if (error) throw new Error(error.message);
  }

  async catchPlayer(params: {
    roomId: string;
    targetPlayerId: string;
    catchSecret: string;
  }): Promise<Player> {
    const { data, error } = await supabase.rpc('catch_player', {
      p_room_id: params.roomId,
      p_target_player_id: params.targetPlayerId,
      p_catch_secret: params.catchSecret,
    });
    if (error || !data) {
      throw new Error(error?.message || 'Catch verification failed');
    }
    await this.refreshPlayersAndRoom();
    return playerFromRow(data as Record<string, unknown>);
  }

  async fetchOwnCatchSecret(playerId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('player_secrets')
      .select('catch_secret')
      .eq('player_id', playerId)
      .maybeSingle();
    if (error || !data) return null;
    return (data as { catch_secret?: string }).catch_secret ?? null;
  }

  async tryResumeRoom(
    code: string,
    callbacks: SyncCallbacks,
  ): Promise<{ room: Room; player: Player; catchSecret: string } | null> {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) return null;

    const { data: roomRow, error: roomErr } = await supabase.rpc(
      'get_room_by_code',
      { p_code: code.trim().toUpperCase() },
    );
    if (roomErr || !roomRow) return null;

    const room = roomFromRow(roomRow as Record<string, unknown>);
    if (room.phase === 'ended') return null;

    const { data: playerRow, error: playerErr } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', room.id)
      .eq('user_id', uid)
      .maybeSingle();
    if (playerErr || !playerRow) return null;

    const player = playerFromRow(playerRow as Record<string, unknown>);
    const catchSecret = await this.fetchOwnCatchSecret(player.id);
    if (!catchSecret) return null;

    await this.subscribe(room, callbacks);
    return { room, player, catchSecret };
  }

  async refreshPlayersAndRoom(): Promise<void> {
    const roomId = this.currentRoomId;
    const cb = this.callbacks;
    if (!roomId || !cb) return;

    const [{ data: playerRows }, { data: roomRow }] = await Promise.all([
      supabase.from('players').select('*').eq('room_id', roomId),
      supabase.from('rooms').select('*').eq('id', roomId).maybeSingle(),
    ]);

    if (this.currentRoomId !== roomId || this.callbacks !== cb) return;

    if (Array.isArray(playerRows)) {
      const sorted = playerRows
        .map((r) => playerFromRow(r as Record<string, unknown>))
        .sort((a, b) =>
          a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase()),
        );
      cb.onPlayersChange(sorted);
    }

    if (roomRow) {
      cb.onRoomChange(roomFromRow(roomRow as Record<string, unknown>));
    }
  }

  async subscribe(room: Room, callbacks: SyncCallbacks): Promise<void> {
    await this.unsubscribe();
    this.currentRoomId = room.id;
    this.callbacks = callbacks;

    this.dataChannel = supabase
      .channel(`db:room:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${room.id}`,
        },
        () => {
          void this.refreshPlayersAndRoom();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          if (this.callbacks !== callbacks) return;
          if (payload.new && typeof payload.new === 'object') {
            callbacks.onRoomChange(
              roomFromRow(payload.new as Record<string, unknown>),
            );
          }
          void this.refreshPlayersAndRoom();
        },
      )
      .subscribe();

    this.broadcastReady = false;
    this.broadcastChannel = supabase
      .channel(`room:${room.code}`, {
        config: { broadcast: { self: true, ack: false } },
      })
      .on('broadcast', { event: 'location' }, (msg) => {
        const loc = readLocationMessage(msg);
        if (!loc) return;
        this.rememberLocation(loc);
      })
      .subscribe((status) => {
        this.broadcastReady = status === 'SUBSCRIBED';
      });

    await this.refreshPlayersAndRoom();
  }

  async broadcastLocation(location: PlayerLocation): Promise<void> {
    this.rememberLocation(location);
    if (!this.broadcastChannel || !this.broadcastReady) return;
    try {
      await this.broadcastChannel.send({
        type: 'broadcast',
        event: 'location',
        payload: location,
      });
    } catch {
      // The next 2s tick retries. Local state was already stored above.
    }
  }

  private rememberLocation(location: PlayerLocation): void {
    this.locations = {
      ...this.locations,
      [location.playerId]: location,
    };
    this.callbacks?.onLocationsChange(this.locations);
  }

  async unsubscribe(): Promise<void> {
    this.currentRoomId = null;
    this.callbacks = null;
    this.locations = {};
    this.broadcastReady = false;
    this.lastRefreshedPhase = null;
    if (this.dataChannel) {
      await supabase.removeChannel(this.dataChannel);
      this.dataChannel = null;
    }
    if (this.broadcastChannel) {
      await supabase.removeChannel(this.broadcastChannel);
      this.broadcastChannel = null;
    }
  }
}
