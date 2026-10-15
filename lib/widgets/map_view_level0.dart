import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../controllers/game_controller.dart';
import '../models/game_models.dart';

class MapViewLevel0 extends StatelessWidget {
  const MapViewLevel0({super.key, required this.controller});

  final GameController controller;

  @override
  Widget build(BuildContext context) {
    final center = controller.myLocation ?? const LatLng(35.6812, 139.7671);
    final phase = controller.room?.phase;
    final visibleMarkers = <Marker>[];

    for (final p in controller.players) {
      if (controller.isHunter &&
          phase == GamePhase.hiding &&
          p.isHider &&
          p.id != controller.me?.id) {
        continue;
      }
      if (controller.isHider && p.isHunter) {
        continue;
      }
      final loc = controller.locations[p.id];
      final point = p.id == controller.me?.id
          ? (controller.myLocation ?? loc?.latLng)
          : loc?.latLng;
      if (point == null) continue;
      final isMe = p.id == controller.me?.id;
      final color = p.isHunter ? Colors.redAccent : Colors.tealAccent;
      visibleMarkers.add(
        Marker(
          point: point,
          width: 56,
          height: 56,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                isMe ? Icons.my_location : Icons.person_pin_circle,
                color: color,
                size: 28,
              ),
              Text(
                isMe ? 'You' : p.displayName,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: color,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return FlutterMap(
      options: MapOptions(
        initialCenter: center,
        initialZoom: 17,
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.manhunt.app',
        ),
        MarkerLayer(markers: visibleMarkers),
      ],
    );
  }
}
