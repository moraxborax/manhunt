import 'package:flutter/material.dart';

import '../controllers/game_controller.dart';
import '../models/game_models.dart';

class ProximityViewLevel34 extends StatelessWidget {
  const ProximityViewLevel34({super.key, required this.controller});

  final GameController controller;

  @override
  Widget build(BuildContext context) {
    final level = controller.room?.settings.difficulty;
    final manual = level == DifficultyLevel.manualProximity;
    final phase = controller.room?.phase;
    final blinded =
        controller.isHunter && phase == GamePhase.hiding;
    final show = !manual || controller.scanActive;
    final count = blinded || !show ? null : controller.nearbyHiderCount();
    final radius = controller.room?.settings.proximityRadiusM ?? 50;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              show && count != null ? '$count' : '—',
              style: Theme.of(context).textTheme.displayLarge?.copyWith(
                    color: const Color(0xFF2AFF9A),
                    fontWeight: FontWeight.w800,
                    fontSize: 96,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              show && count != null
                  ? 'hider${count == 1 ? '' : 's'} within ${radius}m'
                  : manual
                      ? 'Tap sense to check nearby hiders'
                      : 'Waiting for signal…',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Colors.white70,
                  ),
            ),
            if (manual) ...[
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: controller.onCooldown || controller.scanActive
                      ? null
                      : controller.activateManualScan,
                  child: Text(
                    controller.scanActive
                        ? 'SENSING…'
                        : controller.onCooldown
                            ? 'COOLDOWN ${controller.cooldownRemaining.inSeconds}s'
                            : 'SENSE NEARBY HIDERS',
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
