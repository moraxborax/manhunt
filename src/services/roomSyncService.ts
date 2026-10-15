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

export class RoomSyncService {
  private dataChannel: RealtimeChannel | null = null;
  private broadcastChannel: RealtimeChannel | null = null;
  private locations: Record<string, PlayerLocation> = {};
  private currentRoomId: string | null = null;
  private callbacks: SyncCallbacks | null = null;

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
    const player = playerFromRow(playerRow as Record<string, unknown>);
    await this.subscribe(room, callbacks);
    return { room, player, catchSecret };
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
    return roomFromRow(data as Record<string, unknown>);
  }

  async advanceToHunting(roomId: string): Promise<Room> {
    const { data, error } = await supabase.rpc('advance_to_hunting', {
      p_room_id: roomId,
    });
    if (error || !data) {
      throw new Error(error?.message || 'Failed to advance game phase');
    }
    return roomFromRow(data as Record<string, unknown>);
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
          if (payload.new && typeof payload.new === 'object') {
            callbacks.onRoomChange(
              roomFromRow(payload.new as Record<string, unknown>),
            );
          } else {
            void this.refreshPlayersAndRoom();
          }
        },
      )
      .subscribe();

    this.broadcastChannel = supabase
      .channel(`room:${room.code}`, {
        config: { broadcast: { self: true } },
      })
      .on('broadcast', { event: 'location' }, (msg) => {
        try {
          const raw =
            msg.payload && typeof msg.payload === 'object'
              ? (msg.payload as Record<string, unknown>)
              : null;
          if (!raw) return;
          const locMap =
            typeof raw.lat === 'number'
              ? raw
              : raw.payload && typeof raw.payload === 'object'
                ? (raw.payload as Record<string, unknown>)
                : null;
          if (!locMap || typeof locMap.lat !== 'number') return;

          const loc: PlayerLocation = {
            playerId: String(locMap.playerId),
            userId: String(locMap.userId),
            lat: Number(locMap.lat),
            lng: Number(locMap.lng),
            heading:
              typeof locMap.heading === 'number' ? locMap.heading : null,
            updatedAt: String(locMap.updatedAt || new Date().toISOString()),
          };
          this.locations = {
            ...this.locations,
            [loc.playerId]: loc,
          };
          callbacks.onLocationsChange(this.locations);
        } catch {
          // ignore malformed broadcast frame
        }
      })
      .subscribe();

    await this.refreshPlayersAndRoom();
  }

  async broadcastLocation(location: PlayerLocation): Promise<void> {
    if (!this.broadcastChannel) return;
    await this.broadcastChannel.send({
      type: 'broadcast',
      event: 'location',
      payload: location,
    });
  }

  async unsubscribe(): Promise<void> {
    this.currentRoomId = null;
    this.callbacks = null;
    this.locations = {};
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
