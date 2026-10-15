import 'dart:async';
import 'dart:js_interop';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

@JS('manhuntWakeLock')
external JSPromise<JSAny?> _manhuntWakeLock();

@JS('manhuntReleaseWakeLock')
external JSPromise<JSAny?> _manhuntReleaseWakeLock();

@JS('manhuntRequestCompass')
external JSPromise<JSBoolean> _manhuntRequestCompass();

@JS('manhuntOnHeading')
external set _manhuntOnHeading(JSFunction fn);

/// GPS + compass heading + screen wake lock for Flutter Web.
class SensorService {
  StreamSubscription<Position>? _positionSub;
  StreamController<LatLng>? _locationController;
  final _headingController = StreamController<double>.broadcast();

  LatLng? lastLocation;
  double? lastHeading;

  Stream<LatLng> get locationStream =>
      _locationController?.stream ?? const Stream.empty();

  Stream<double> get headingStream => _headingController.stream;

  Future<bool> ensureLocationPermission() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  }

  Future<void> startTracking() async {
    await _positionSub?.cancel();
    await _locationController?.close();
    _locationController = StreamController<LatLng>.broadcast();

    final ok = await ensureLocationPermission();
    if (!ok) {
      throw Exception('Location permission denied');
    }

    const settings = LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 3,
    );

    _positionSub = Geolocator.getPositionStream(locationSettings: settings)
        .listen((pos) {
      final ll = LatLng(pos.latitude, pos.longitude);
      lastLocation = ll;
      _locationController?.add(ll);
    });

    await requestWakeLock();
  }

  Future<void> stopTracking() async {
    await _positionSub?.cancel();
    _positionSub = null;
    await _locationController?.close();
    _locationController = null;
    await releaseWakeLock();
  }

  /// iOS Safari requires a user gesture for compass permission.
  Future<bool> requestCompassPermission() async {
    if (!kIsWeb) return true;
    try {
      _manhuntOnHeading = ((JSNumber heading) {
        final h = heading.toDartDouble;
        lastHeading = h;
        if (!_headingController.isClosed) {
          _headingController.add(h);
        }
      }).toJS;
      final granted = await _manhuntRequestCompass().toDart;
      return granted.toDart;
    } catch (_) {
      return false;
    }
  }

  Future<void> requestWakeLock() async {
    if (!kIsWeb) return;
    try {
      await _manhuntWakeLock().toDart;
    } catch (_) {}
  }

  Future<void> releaseWakeLock() async {
    if (!kIsWeb) return;
    try {
      await _manhuntReleaseWakeLock().toDart;
    } catch (_) {}
  }

  static double distanceMeters(LatLng a, LatLng b) {
    return const Distance().as(LengthUnit.Meter, a, b);
  }

  /// Bearing from [from] to [to] in degrees (0 = north).
  static double bearingDegrees(LatLng from, LatLng to) {
    final lat1 = from.latitude * math.pi / 180;
    final lat2 = to.latitude * math.pi / 180;
    final dLon = (to.longitude - from.longitude) * math.pi / 180;
    final y = math.sin(dLon) * math.cos(lat2);
    final x = math.cos(lat1) * math.sin(lat2) -
        math.sin(lat1) * math.cos(lat2) * math.cos(dLon);
    return (math.atan2(y, x) * 180 / math.pi + 360) % 360;
  }

  void dispose() {
    unawaited(stopTracking());
    _headingController.close();
  }
}
