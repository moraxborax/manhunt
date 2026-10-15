import 'dart:async';
import 'dart:math';

import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';

import '../models/game_models.dart';

class RoomSyncService {
  RoomSyncService(this._client);

  final SupabaseClient _client;
  final _uuid = const Uuid();

  RealtimeChannel? _channel;
  StreamSubscription<List<Map<String, dynamic>>>? _playersSub;
  StreamSubscription<List<Map<String, dynamic>>>? _roomSub;

  final _playersController = StreamController<List<Player>>.broadcast();
  final _roomController = StreamController<Room>.broadcast();
  final _locationsController =
      StreamController<Map<String, PlayerLocation>>.broadcast();

  final Map<String, PlayerLocation> _locations = {};

  Stream<List<Player>> get playersStream => _playersController.stream;
  Stream<Room> get roomStream => _roomController.stream;
  Stream<Map<String, PlayerLocation>> get locationsStream =>
      _locationsController.stream;

  String? get userId => _client.auth.currentUser?.id;

  Future<void> ensureAnonymousSession() async {
    final session = _client.auth.currentSession;
    if (session != null) return;
    final res = await _client.auth.signInAnonymously();
    if (res.user == null) {
      throw Exception(
        'Anonymous sign-in failed. Enable Anonymous Sign-Ins in '
        'Supabase Dashboard → Authentication → Providers.',
      );
    }
  }

  String newCatchSecret() => _uuid.v4();

  String generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    final rng = Random.secure();
    return List.generate(6, (_) => chars[rng.nextInt(chars.length)]).join();
  }

  Future<({Room room, Player player, String catchSecret})> createRoom({
    required String displayName,
    RoomSettings settings = const RoomSettings(),
  }) async {
    await ensureAnonymousSession();
    final catchSecret = newCatchSecret();
    final code = generateRoomCode();

    final raw = await _client.rpc('create_room', params: {
      'p_code': code,
      'p_display_name': displayName,
      'p_catch_secret': catchSecret,
      'p_difficulty': settings.difficulty.value,
      'p_hunter_count': settings.hunterCount,
      'p_head_start_seconds': settings.headStartSeconds,
      'p_scan_cooldown_seconds': settings.scanCooldownSeconds,
      'p_proximity_radius_m': settings.proximityRadiusM,
    });

    final map = Map<String, dynamic>.from(raw as Map);
    final room = Room.fromJson(Map<String, dynamic>.from(map['room'] as Map));
    final player =
        Player.fromJson(Map<String, dynamic>.from(map['player'] as Map));
    await subscribe(room);
    return (room: room, player: player, catchSecret: catchSecret);
  }

  Future<({Room room, Player player, String catchSecret})> joinRoom({
    required String code,
    required String displayName,
  }) async {
    await ensureAnonymousSession();
    final catchSecret = newCatchSecret();

    final roomRow = await _client.rpc(
      'get_room_by_code',
      params: {'p_code': code},
    );
    if (roomRow == null) {
      throw Exception('Room not found');
    }
    final room = Room.fromJson(Map<String, dynamic>.from(roomRow as Map));

    final playerRow = await _client.rpc('join_room', params: {
      'p_code': code,
      'p_display_name': displayName,
      'p_catch_secret': catchSecret,
    });
    final player =
        Player.fromJson(Map<String, dynamic>.from(playerRow as Map));
    await subscribe(room);
    return (room: room, player: player, catchSecret: catchSecret);
  }

  Future<void> updateRoomSettings(String roomId, RoomSettings settings) async {
    await _client.from('rooms').update({
      'difficulty': settings.difficulty.value,
      'hunter_count': settings.hunterCount,
      'head_start_seconds': settings.headStartSeconds,
      'scan_cooldown_seconds': settings.scanCooldownSeconds,
      'proximity_radius_m': settings.proximityRadiusM,
    }).eq('id', roomId);
  }

  Future<Room> startGame(String roomId) async {
    final row = await _client.rpc('start_game', params: {'p_room_id': roomId});
    return Room.fromJson(Map<String, dynamic>.from(row as Map));
  }

  Future<Room> advanceToHunting(String roomId) async {
    final row =
        await _client.rpc('advance_to_hunting', params: {'p_room_id': roomId});
    return Room.fromJson(Map<String, dynamic>.from(row as Map));
  }

  Future<Player> catchPlayer({
    required String roomId,
    required String targetPlayerId,
    required String catchSecret,
  }) async {
    final row = await _client.rpc('catch_player', params: {
      'p_room_id': roomId,
      'p_target_player_id': targetPlayerId,
      'p_catch_secret': catchSecret,
    });
    return Player.fromJson(Map<String, dynamic>.from(row as Map));
  }

  Future<String?> fetchOwnCatchSecret(String playerId) async {
    final row = await _client
        .from('player_secrets')
        .select('catch_secret')
        .eq('player_id', playerId)
        .maybeSingle();
    return row?['catch_secret'] as String?;
  }

  Future<void> subscribe(Room room) async {
    await unsubscribe();

    _playersSub = _client
        .from('players')
        .stream(primaryKey: ['id'])
        .eq('room_id', room.id)
        .listen((rows) {
      final players = rows.map(Player.fromJson).toList()
        ..sort((a, b) => a.joinedSortKey.compareTo(b.joinedSortKey));
      _playersController.add(players);
    });

    // Room stream: filter client-side (supabase stream eq on single column)
    _roomSub = _client
        .from('rooms')
        .stream(primaryKey: ['id'])
        .eq('id', room.id)
        .listen((rows) {
      if (rows.isEmpty) return;
      _roomController.add(Room.fromJson(rows.first));
    });

    _channel = _client.channel('room:${room.code}');
    _channel!
        .onBroadcast(
          event: 'location',
          callback: (payload) {
            try {
              Map<String, dynamic> locMap;
              if (payload.containsKey('lat')) {
                locMap = Map<String, dynamic>.from(payload);
              } else if (payload['payload'] is Map) {
                locMap = Map<String, dynamic>.from(payload['payload'] as Map);
              } else {
                return;
              }
              final loc = PlayerLocation.fromJson(locMap);
              _locations[loc.playerId] = loc;
              _locationsController.add(Map.unmodifiable(_locations));
            } catch (_) {}
          },
        )
        .subscribe();

    // Initial fetch
    final players = await _client
        .from('players')
        .select()
        .eq('room_id', room.id);
    _playersController.add(
      (players as List)
          .map((e) => Player.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
    );

    final roomRow =
        await _client.from('rooms').select().eq('id', room.id).single();
    _roomController.add(Room.fromJson(roomRow));
  }

  Future<void> broadcastLocation(PlayerLocation location) async {
    final ch = _channel;
    if (ch == null) return;
    await ch.sendBroadcastMessage(
      event: 'location',
      payload: location.toJson(),
    );
  }

  Future<void> unsubscribe() async {
    await _playersSub?.cancel();
    await _roomSub?.cancel();
    _playersSub = null;
    _roomSub = null;
    if (_channel != null) {
      await _client.removeChannel(_channel!);
      _channel = null;
    }
    _locations.clear();
  }

  Future<void> dispose() async {
    await unsubscribe();
    await _playersController.close();
    await _roomController.close();
    await _locationsController.close();
  }
}

extension on Player {
  String get joinedSortKey => displayName.toLowerCase();
}
