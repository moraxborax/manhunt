import 'package:flutter/material.dart';

import '../controllers/game_controller.dart';
import '../models/game_models.dart';
import '../widgets/map_view_level0.dart';
import '../widgets/proximity_view_level3_4.dart';
import '../widgets/qr_catch_sheet.dart';
import '../widgets/radar_view_level1_2.dart';

class GameScreen extends StatelessWidget {
  const GameScreen({super.key, required this.controller});

  final GameController controller;

  Future<void> _leave(BuildContext context) async {
    await controller.leaveRoom();
    if (!context.mounted) return;
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final room = controller.room;
        if (room == null) {
          return const Scaffold(body: Center(child: Text('No room')));
        }

        if (controller.stealthMode) {
          return GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: controller.toggleStealth,
            child: const Scaffold(
              backgroundColor: Colors.black,
              body: Center(
                child: Text(
                  'STEALTH\nTap to wake',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xFF222222), fontSize: 18),
                ),
              ),
            ),
          );
        }

        final roleColor =
            controller.isHunter ? Colors.redAccent : const Color(0xFF2AFF9A);
        final ended = room.phase == GamePhase.ended;

        return PopScope(
          canPop: false,
          onPopInvokedWithResult: (didPop, _) async {
            if (didPop) return;
            await _leave(context);
          },
          child: Scaffold(
          appBar: AppBar(
            title: Text(
              controller.isHunter ? 'HUNTER' : 'HIDER',
              style: TextStyle(color: roleColor, fontWeight: FontWeight.bold),
            ),
            actions: [
              if (!ended)
                IconButton(
                  tooltip: 'Stealth / pocket mode',
                  onPressed: controller.toggleStealth,
                  icon: const Icon(Icons.visibility_off),
                ),
              IconButton(
                tooltip: 'Leave room',
                onPressed: () => _leave(context),
                icon: const Icon(Icons.exit_to_app),
              ),
            ],
          ),
          body: Column(
            children: [
              _StatusBanner(controller: controller),
              if (ended)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                  child: SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: () => _leave(context),
                      icon: const Icon(Icons.home),
                      label: const Text('Back to home'),
                    ),
                  ),
                ),
              Expanded(child: _DifficultyBody(controller: controller)),
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      if (controller.isHider && !ended)
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: () =>
                                showHiderQrSheet(context, controller),
                            icon: const Icon(Icons.qr_code_2),
                            label: const Text('Show Catch QR'),
                          ),
                        ),
                      if (controller.isHunter && !ended)
                        Expanded(
                          child: FilledButton.icon(
                            style: FilledButton.styleFrom(
                              backgroundColor: Colors.redAccent,
                            ),
                            onPressed: () =>
                                showHunterScanSheet(context, controller),
                            icon: const Icon(Icons.qr_code_scanner),
                            label: const Text('Scan to Catch'),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        );
      },
    );
  }
}

class _StatusBanner extends StatelessWidget {
  const _StatusBanner({required this.controller});
  final GameController controller;

  @override
  Widget build(BuildContext context) {
    final room = controller.room!;
    String phaseText;
    switch (room.phase) {
      case GamePhase.hiding:
        final left = room.hidingEndsAt?.difference(DateTime.now()).inSeconds;
        phaseText = left != null && left > 0
            ? 'HEAD START — ${left}s (hunters blinded)'
            : 'HEAD START ending…';
      case GamePhase.hunting:
        phaseText = 'HUNTING — ${controller.hidersRemaining} hiders left';
      case GamePhase.ended:
        phaseText = 'GAME OVER — all hiders caught';
      case GamePhase.lobby:
        phaseText = 'Lobby';
    }

    return Container(
      width: double.infinity,
      color: const Color(0xFF152018),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(phaseText, style: const TextStyle(fontWeight: FontWeight.w600)),
          Text(
            'Room ${room.code} · ${room.settings.difficulty.label}',
            style: const TextStyle(color: Colors.white54, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _DifficultyBody extends StatelessWidget {
  const _DifficultyBody({required this.controller});
  final GameController controller;

  @override
  Widget build(BuildContext context) {
    final level =
        controller.room?.settings.difficulty ?? DifficultyLevel.fullMap;

    // Hiders always see a simple status + optional map of fellow hiders at L0.
    if (controller.isHider) {
      if (level == DifficultyLevel.fullMap) {
        return MapViewLevel0(controller: controller);
      }
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            controller.room?.phase == GamePhase.ended
                ? 'You were caught — or the hunt ended.'
                : 'Stay hidden. If caught, show your Catch QR.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleLarge,
          ),
        ),
      );
    }

    return switch (level) {
      DifficultyLevel.fullMap => MapViewLevel0(controller: controller),
      DifficultyLevel.continuousRadar ||
      DifficultyLevel.manualRadar =>
        RadarViewLevel12(controller: controller),
      DifficultyLevel.proximityCount ||
      DifficultyLevel.manualProximity =>
        ProximityViewLevel34(controller: controller),
    };
  }
}
