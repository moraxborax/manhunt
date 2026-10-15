import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:latlong2/latlong.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/game_models.dart';
import '../services/room_sync_service.dart';
import '../services/sensor_service.dart';

class GameController extends ChangeNotifier {
  GameController({
    RoomSyncService? sync,
    SensorService? sensors,
  })  : _sync = sync ?? RoomSyncService(Supabase.instance.client),
        _sensors = sensors ?? SensorService();

  final RoomSyncService _sync;
  final SensorService _sensors;

  Room? room;
  Player? me;
  String? catchSecret;
  List<Player> players = [];
  Map<String, PlayerLocation> locations = {};
  LatLng? myLocation;
  double? myHeading;

  bool stealthMode = false;
  String? error;
  bool busy = false;

  /// Manual scan (levels 2 & 4).
  bool scanActive = false;
  DateTime? cooldownUntil;
  Timer? _scanTimer;
  Timer? _cooldownTick;
  Timer? _hidingTimer;
  Timer? _locationBroadcast;

  StreamSubscription? _playersSub;
  StreamSubscription? _roomSub;
  StreamSubscription? _locSub;
  StreamSubscription? _gpsSub;
  StreamSubscription? _headingSub;

  RoomSettings lobbySettings = const RoomSettings();

  bool get isHost => me?.isHost == true || room?.hostId == _sync.userId;
  bool get isHunter => me?.isHunter == true;
  bool get isHider => me?.isHider == true;
  bool get inGame =>
      room != null &&
      (room!.phase == GamePhase.hiding ||
          room!.phase == GamePhase.hunting ||
          room!.phase == GamePhase.ended);

  bool get onCooldown =>
      cooldownUntil != null && DateTime.now().isBefore(cooldownUntil!);

  Duration get cooldownRemaining {
    if (cooldownUntil == null) return Duration.zero;
    final d = cooldownUntil!.difference(DateTime.now());
    return d.isNegative ? Duration.zero : d;
  }

  int get hidersRemaining => players.where((p) => p.isHider).length;

  List<PlayerLocation> get hiderLocations {
    final hiderIds = players.where((p) => p.isHider).map((p) => p.id).toSet();
    return locations.values.where((l) => hiderIds.contains(l.playerId)).toList();
  }

  int nearbyHiderCount() {
    final meLoc = myLocation;
    final room = this.room;
    if (meLoc == null || room == null) return 0;
    final radius = room.settings.proximityRadiusM.toDouble();
    return hiderLocations.where((l) {
      if (l.playerId == me?.id) return false;
      return SensorService.distanceMeters(meLoc, l.latLng) <= radius;
    }).length;
  }

  Future<void> createRoom(String displayName) async {
    await _run(() async {
      final result = await _sync.createRoom(
        displayName: displayName,
        settings: lobbySettings,
      );
      room = result.room;
      me = result.player;
      catchSecret = result.catchSecret;
      await _persistSession(displayName);
      await _bindStreams();
    });
  }

  Future<void> joinRoom(String code, String displayName) async {
    await _run(() async {
      final result = await _sync.joinRoom(
        code: code,
        displayName: displayName,
      );
      room = result.room;
      me = result.player;
      catchSecret = result.catchSecret;
      await _persistSession(displayName);
      await _bindStreams();
    });
  }

  Future<void> saveLobbySettings(RoomSettings settings) async {
    lobbySettings = settings;
    final r = room;
    if (r == null || !isHost) {
      notifyListeners();
      return;
    }
    await _sync.updateRoomSettings(r.id, settings);
    notifyListeners();
  }

  Future<void> startGame() async {
    final r = room;
    if (r == null) return;
    await _run(() async {
      room = await _sync.startGame(r.id);
      await _startSensors();
      _scheduleHidingAdvance();
    });
  }

  Future<void> catchFromQr(String raw) async {
    final r = room;
    final payload = CatchPayload.tryParse(raw);
    if (r == null || payload == null) {
      error = 'Invalid catch QR';
      notifyListeners();
      return;
    }
    if (payload.roomCode.toUpperCase() != r.code.toUpperCase()) {
      error = 'QR is from a different room';
      notifyListeners();
      return;
    }
    await _run(() async {
      await _sync.catchPlayer(
        roomId: r.id,
        targetPlayerId: payload.playerId,
        catchSecret: payload.catchSecret,
      );
    });
  }

  void activateManualScan() {
    final r = room;
    if (r == null || onCooldown || scanActive) return;
    final level = r.settings.difficulty;
    if (level != DifficultyLevel.manualRadar &&
        level != DifficultyLevel.manualProximity) {
      return;
    }
    scanActive = true;
    notifyListeners();
    _scanTimer?.cancel();
    _scanTimer = Timer(const Duration(seconds: 8), () {
      scanActive = false;
      cooldownUntil = DateTime.now().add(
        Duration(seconds: r.settings.scanCooldownSeconds),
      );
      _cooldownTick?.cancel();
      _cooldownTick = Timer.periodic(const Duration(seconds: 1), (_) {
        if (!onCooldown) {
          _cooldownTick?.cancel();
          cooldownUntil = null;
        }
        notifyListeners();
      });
      notifyListeners();
    });
  }

  void toggleStealth() {
    stealthMode = !stealthMode;
    if (stealthMode) {
      unawaited(_sensors.requestWakeLock());
    }
    notifyListeners();
  }

  Future<void> requestCompass() => _sensors.requestCompassPermission();

  Future<void> _bindStreams() async {
    await _playersSub?.cancel();
    await _roomSub?.cancel();
    await _locSub?.cancel();

    _playersSub = _sync.playersStream.listen((list) {
      players = list;
      final uid = _sync.userId;
      if (uid != null) {
        for (final p in list) {
          if (p.userId == uid) {
            me = p;
            break;
          }
        }
      }
      notifyListeners();
    });

    _roomSub = _sync.roomStream.listen((r) {
      room = r;
      lobbySettings = r.settings;
      if (r.phase == GamePhase.hiding || r.phase == GamePhase.hunting) {
        unawaited(_startSensors());
        _scheduleHidingAdvance();
      }
      notifyListeners();
    });

    _locSub = _sync.locationsStream.listen((map) {
      locations = map;
      notifyListeners();
    });
  }

  Future<void> _startSensors() async {
    if (_gpsSub != null) return;
    try {
      await _sensors.startTracking();
    } catch (e) {
      error = e.toString();
      notifyListeners();
      return;
    }
    _gpsSub = _sensors.locationStream.listen((ll) {
      myLocation = ll;
      notifyListeners();
    });
    _headingSub = _sensors.headingStream.listen((h) {
      myHeading = h;
      notifyListeners();
    });
    _locationBroadcast?.cancel();
    _locationBroadcast = Timer.periodic(const Duration(seconds: 2), (_) {
      unawaited(_broadcastMyLocation());
    });
  }

  Future<void> _broadcastMyLocation() async {
    final loc = _sensors.lastLocation ?? myLocation;
    final p = me;
    if (loc == null || p == null) return;
    final payload = PlayerLocation(
      playerId: p.id,
      userId: p.userId,
      latLng: loc,
      heading: _sensors.lastHeading ?? myHeading,
      updatedAt: DateTime.now().toUtc(),
    );
    await _sync.broadcastLocation(payload);
  }

  void _scheduleHidingAdvance() {
    _hidingTimer?.cancel();
    final r = room;
    if (r == null || r.phase != GamePhase.hiding) return;
    final ends = r.hidingEndsAt;
    if (ends == null) return;
    final wait = ends.difference(DateTime.now());
    if (wait.isNegative) {
      unawaited(_sync.advanceToHunting(r.id));
      return;
    }
    _hidingTimer = Timer(wait, () {
      unawaited(_sync.advanceToHunting(r.id));
    });
  }

  Future<void> _persistSession(String displayName) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('displayName', displayName);
    if (room != null) await prefs.setString('roomCode', room!.code);
    if (me != null) await prefs.setString('playerId', me!.id);
  }

  Future<String?> savedDisplayName() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('displayName');
  }

  Future<void> _run(Future<void> Function() fn) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      await fn();
    } catch (e) {
      error = e.toString();
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _scanTimer?.cancel();
    _cooldownTick?.cancel();
    _hidingTimer?.cancel();
    _locationBroadcast?.cancel();
    _playersSub?.cancel();
    _roomSub?.cancel();
    _locSub?.cancel();
    _gpsSub?.cancel();
    _headingSub?.cancel();
    _sensors.dispose();
    unawaited(_sync.dispose());
    super.dispose();
  }
}
