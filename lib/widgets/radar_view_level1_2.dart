import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../controllers/game_controller.dart';
import '../models/game_models.dart';
import '../services/sensor_service.dart';

class RadarViewLevel12 extends StatelessWidget {
  const RadarViewLevel12({super.key, required this.controller});

  final GameController controller;

  @override
  Widget build(BuildContext context) {
    final level = controller.room?.settings.difficulty;
    final manual = level == DifficultyLevel.manualRadar;
    final showBlips = !manual || controller.scanActive;
    final phase = controller.room?.phase;
    final blinded =
        controller.isHunter && phase == GamePhase.hiding;

    return Column(
      children: [
        Expanded(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: AspectRatio(
              aspectRatio: 1,
              child: CustomPaint(
                painter: _RadarPainter(
                  heading: controller.myHeading ?? 0,
                  blips: blinded || !showBlips
                      ? const []
                      : _computeBlips(controller),
                ),
              ),
            ),
          ),
        ),
        if (manual) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: controller.onCooldown || controller.scanActive
                    ? null
                    : controller.activateManualScan,
                child: Text(
                  controller.scanActive
                      ? 'SCANNING…'
                      : controller.onCooldown
                          ? 'COOLDOWN ${controller.cooldownRemaining.inSeconds}s'
                          : 'ACTIVATE RADAR SCAN',
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }

  List<_Blip> _computeBlips(GameController c) {
    final me = c.myLocation;
    if (me == null) return const [];
    final heading = c.myHeading ?? 0;
    final blips = <_Blip>[];
    for (final loc in c.hiderLocations) {
      if (loc.playerId == c.me?.id) continue;
      final dist = SensorService.distanceMeters(me, loc.latLng);
      final bearing = SensorService.bearingDegrees(me, loc.latLng);
      final relative = (bearing - heading + 360) % 360;
      blips.add(_Blip(relativeDegrees: relative, distanceM: dist));
    }
    return blips;
  }
}

class _Blip {
  const _Blip({required this.relativeDegrees, required this.distanceM});
  final double relativeDegrees;
  final double distanceM;
}

class _RadarPainter extends CustomPainter {
  _RadarPainter({required this.heading, required this.blips});

  final double heading;
  final List<_Blip> blips;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 8;
    final bg = Paint()..color = const Color(0xFF0B1F17);
    final ring = Paint()
      ..color = const Color(0xFF2AFF9A).withValues(alpha: 0.35)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    final sweep = Paint()
      ..shader = SweepGradient(
        colors: [
          const Color(0xFF2AFF9A).withValues(alpha: 0.0),
          const Color(0xFF2AFF9A).withValues(alpha: 0.35),
        ],
        transform: GradientRotation(-heading * math.pi / 180),
      ).createShader(Rect.fromCircle(center: center, radius: radius));

    canvas.drawCircle(center, radius, bg);
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      0,
      math.pi * 2,
      true,
      sweep,
    );
    for (var i = 1; i <= 3; i++) {
      canvas.drawCircle(center, radius * i / 3, ring);
    }
    // North notch
    final north = Paint()
      ..color = const Color(0xFF2AFF9A)
      ..strokeWidth = 2;
    canvas.drawLine(
      Offset(center.dx, center.dy - radius),
      Offset(center.dx, center.dy - radius + 12),
      north,
    );

    const maxRange = 200.0;
    final blipPaint = Paint()..color = Colors.redAccent;
    for (final b in blips) {
      final r = (b.distanceM / maxRange).clamp(0.0, 1.0) * radius;
      final rad = (b.relativeDegrees - 90) * math.pi / 180;
      final x = center.dx + r * math.cos(rad);
      final y = center.dy + r * math.sin(rad);
      canvas.drawCircle(Offset(x, y), 6, blipPaint);
    }

    // Center self
    canvas.drawCircle(center, 5, Paint()..color = const Color(0xFF2AFF9A));
  }

  @override
  bool shouldRepaint(covariant _RadarPainter oldDelegate) =>
      oldDelegate.heading != heading || oldDelegate.blips != blips;
}
