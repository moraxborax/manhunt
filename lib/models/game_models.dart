import 'package:latlong2/latlong.dart';

enum PlayerRole { hunter, hider }

enum GamePhase { lobby, hiding, hunting, ended }

enum DifficultyLevel {
  fullMap(0, 'Full Map', 'Live map with every player marker.'),
  continuousRadar(1, 'Radar', 'Continuous compass radar blips.'),
  manualRadar(2, 'Manual Radar', 'Tap to scan once, then cooldown.'),
  proximityCount(3, 'Proximity', 'See how many hiders are nearby.'),
  manualProximity(4, 'Manual Sense', 'Tap to sense nearby count, then cooldown.');

  const DifficultyLevel(this.value, this.label, this.description);
  final int value;
  final String label;
  final String description;

  static DifficultyLevel fromValue(int v) {
    return DifficultyLevel.values.firstWhere(
      (e) => e.value == v,
      orElse: () => DifficultyLevel.fullMap,
    );
  }
}

class RoomSettings {
  const RoomSettings({
    this.difficulty = DifficultyLevel.fullMap,
    this.hunterCount = 1,
    this.headStartSeconds = 60,
    this.scanCooldownSeconds = 45,
    this.proximityRadiusM = 50,
  });

  final DifficultyLevel difficulty;
  final int hunterCount;
  final int headStartSeconds;
  final int scanCooldownSeconds;
  final int proximityRadiusM;

  RoomSettings copyWith({
    DifficultyLevel? difficulty,
    int? hunterCount,
    int? headStartSeconds,
    int? scanCooldownSeconds,
    int? proximityRadiusM,
  }) {
    return RoomSettings(
      difficulty: difficulty ?? this.difficulty,
      hunterCount: hunterCount ?? this.hunterCount,
      headStartSeconds: headStartSeconds ?? this.headStartSeconds,
      scanCooldownSeconds: scanCooldownSeconds ?? this.scanCooldownSeconds,
      proximityRadiusM: proximityRadiusM ?? this.proximityRadiusM,
    );
  }
}

class Player {
  const Player({
    required this.id,
    required this.roomId,
    required this.userId,
    required this.displayName,
    required this.role,
    required this.isHost,
  });

  final String id;
  final String roomId;
  final String userId;
  final String displayName;
  final PlayerRole role;
  final bool isHost;

  bool get isHunter => role == PlayerRole.hunter;
  bool get isHider => role == PlayerRole.hider;

  factory Player.fromJson(Map<String, dynamic> json) {
    return Player(
      id: json['id'] as String,
      roomId: json['room_id'] as String,
      userId: json['user_id'] as String,
      displayName: json['display_name'] as String,
      role: (json['role'] as String) == 'hunter'
          ? PlayerRole.hunter
          : PlayerRole.hider,
      isHost: json['is_host'] as bool? ?? false,
    );
  }
}

class Room {
  const Room({
    required this.id,
    required this.code,
    required this.hostId,
    required this.settings,
    required this.phase,
    this.hidingEndsAt,
  });

  final String id;
  final String code;
  final String hostId;
  final RoomSettings settings;
  final GamePhase phase;
  final DateTime? hidingEndsAt;

  factory Room.fromJson(Map<String, dynamic> json) {
    return Room(
      id: json['id'] as String,
      code: json['code'] as String,
      hostId: json['host_id'] as String,
      settings: RoomSettings(
        difficulty: DifficultyLevel.fromValue(json['difficulty'] as int? ?? 0),
        hunterCount: json['hunter_count'] as int? ?? 1,
        headStartSeconds: json['head_start_seconds'] as int? ?? 60,
        scanCooldownSeconds: json['scan_cooldown_seconds'] as int? ?? 45,
        proximityRadiusM: json['proximity_radius_m'] as int? ?? 50,
      ),
      phase: _phaseFrom(json['phase'] as String? ?? 'lobby'),
      hidingEndsAt: json['hiding_ends_at'] != null
          ? DateTime.parse(json['hiding_ends_at'] as String).toLocal()
          : null,
    );
  }

  static GamePhase _phaseFrom(String phase) {
    return switch (phase) {
      'hiding' => GamePhase.hiding,
      'hunting' => GamePhase.hunting,
      'ended' => GamePhase.ended,
      _ => GamePhase.lobby,
    };
  }
}

class PlayerLocation {
  const PlayerLocation({
    required this.playerId,
    required this.userId,
    required this.latLng,
    required this.updatedAt,
    this.heading,
  });

  final String playerId;
  final String userId;
  final LatLng latLng;
  final DateTime updatedAt;
  final double? heading;

  Map<String, dynamic> toJson() => {
        'playerId': playerId,
        'userId': userId,
        'lat': latLng.latitude,
        'lng': latLng.longitude,
        'heading': heading,
        'updatedAt': updatedAt.toIso8601String(),
      };

  factory PlayerLocation.fromJson(Map<String, dynamic> json) {
    return PlayerLocation(
      playerId: json['playerId'] as String,
      userId: json['userId'] as String,
      latLng: LatLng(
        (json['lat'] as num).toDouble(),
        (json['lng'] as num).toDouble(),
      ),
      heading: (json['heading'] as num?)?.toDouble(),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }
}

/// Payload encoded in the hider catch QR.
class CatchPayload {
  const CatchPayload({
    required this.roomCode,
    required this.playerId,
    required this.catchSecret,
  });

  final String roomCode;
  final String playerId;
  final String catchSecret;

  String encode() => 'manhunt:$roomCode:$playerId:$catchSecret';

  static CatchPayload? tryParse(String raw) {
    final parts = raw.trim().split(':');
    if (parts.length != 4 || parts[0] != 'manhunt') return null;
    return CatchPayload(
      roomCode: parts[1],
      playerId: parts[2],
      catchSecret: parts[3],
    );
  }
}
