import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../controllers/game_controller.dart';
import '../models/game_models.dart';
import '../services/share_service.dart';
import '../widgets/lobby_invite_sheet.dart';
import 'game_screen.dart';

class LobbyScreen extends StatefulWidget {
  const LobbyScreen({super.key, required this.controller});

  final GameController controller;

  @override
  State<LobbyScreen> createState() => _LobbyScreenState();
}

class _LobbyScreenState extends State<LobbyScreen> {
  bool _navigatedToGame = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onUpdate);
    // If we resumed mid-game, leave lobby immediately.
    WidgetsBinding.instance.addPostFrameCallback((_) => _onUpdate());
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onUpdate);
    super.dispose();
  }

  void _onUpdate() {
    final phase = widget.controller.room?.phase;
    if (!_navigatedToGame &&
        phase != null &&
        phase != GamePhase.lobby &&
        mounted) {
      _navigatedToGame = true;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => GameScreen(controller: widget.controller),
        ),
      );
    }
  }

  Future<void> _leave() async {
    await widget.controller.leaveRoom();
    if (!mounted) return;
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  Future<void> _shareLink() async {
    final room = widget.controller.room;
    if (room == null) return;
    final url = widget.controller.buildInviteUrl();
    final result = await ShareService.shareUrl(
      title: 'Manhunt room ${room.code}',
      text: 'Join my Manhunt game: ${room.code}',
      url: url,
    );
    if (!mounted) return;
    final msg = switch (result) {
      ShareResult.shared => 'Invite shared',
      ShareResult.copied => 'Join link copied',
      ShareResult.failed => 'Could not share link',
    };
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final room = controller.room;
        if (room == null) {
          return const Scaffold(body: Center(child: Text('No room')));
        }

        final settings = controller.lobbySettings;

        return PopScope(
          canPop: false,
          onPopInvokedWithResult: (didPop, _) async {
            if (didPop) return;
            await _leave();
          },
          child: Scaffold(
          appBar: AppBar(
            title: Text('Room ${room.code}'),
            actions: [
              IconButton(
                tooltip: 'Show invite QR',
                onPressed: () => showLobbyInviteSheet(context, controller),
                icon: const Icon(Icons.qr_code_2),
              ),
              IconButton(
                tooltip: 'Share join link',
                onPressed: _shareLink,
                icon: const Icon(Icons.ios_share),
              ),
              IconButton(
                tooltip: 'Copy code',
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: room.code));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Room code copied')),
                  );
                },
                icon: const Icon(Icons.copy),
              ),
              IconButton(
                tooltip: 'Leave room',
                onPressed: _leave,
                icon: const Icon(Icons.exit_to_app),
              ),
            ],
          ),
          body: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Card(
                color: const Color(0xFF152018),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Invite friends',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Share the link or show a QR they can scan with their phone camera.',
                        style: Theme.of(context)
                            .textTheme
                            .bodySmall
                            ?.copyWith(color: Colors.white60),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () =>
                                  showLobbyInviteSheet(context, controller),
                              icon: const Icon(Icons.qr_code_2),
                              label: const Text('Show QR'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: FilledButton.icon(
                              onPressed: _shareLink,
                              icon: const Icon(Icons.ios_share),
                              label: const Text('Share link'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Players (${controller.players.length})',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              ...controller.players.map(
                (p) => ListTile(
                  leading: Icon(
                    p.isHost ? Icons.star : Icons.person,
                    color: const Color(0xFF2AFF9A),
                  ),
                  title: Text(p.displayName),
                  subtitle: Text(p.isHost ? 'Host' : 'Joined'),
                ),
              ),
              const Divider(height: 32),
              if (controller.isHost) ...[
                Text(
                  'Difficulty: ${settings.difficulty.label}',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                Text(
                  settings.difficulty.description,
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: Colors.white60),
                ),
                Slider(
                  value: settings.difficulty.value.toDouble(),
                  min: 0,
                  max: 4,
                  divisions: 4,
                  label: 'L${settings.difficulty.value}',
                  onChanged: (v) {
                    controller.saveLobbySettings(
                      settings.copyWith(
                        difficulty: DifficultyLevel.fromValue(v.round()),
                      ),
                    );
                  },
                ),
                _intTile(
                  context,
                  label: 'Initial hunters',
                  value: settings.hunterCount,
                  min: 1,
                  max: 5,
                  onChanged: (v) => controller.saveLobbySettings(
                    settings.copyWith(hunterCount: v),
                  ),
                ),
                _intTile(
                  context,
                  label: 'Head start (seconds)',
                  value: settings.headStartSeconds,
                  min: 0,
                  max: 180,
                  step: 15,
                  onChanged: (v) => controller.saveLobbySettings(
                    settings.copyWith(headStartSeconds: v),
                  ),
                ),
                _intTile(
                  context,
                  label: 'Scan cooldown (seconds)',
                  value: settings.scanCooldownSeconds,
                  min: 15,
                  max: 120,
                  step: 15,
                  onChanged: (v) => controller.saveLobbySettings(
                    settings.copyWith(scanCooldownSeconds: v),
                  ),
                ),
                _intTile(
                  context,
                  label: 'Proximity radius (m)',
                  value: settings.proximityRadiusM,
                  min: 20,
                  max: 150,
                  step: 10,
                  onChanged: (v) => controller.saveLobbySettings(
                    settings.copyWith(proximityRadiusM: v),
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: controller.busy || controller.players.length < 2
                      ? null
                      : () async {
                          await controller.requestCompass();
                          await controller.startGame();
                          if (controller.error != null && context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(controller.error!)),
                            );
                          }
                        },
                  child: Text(
                    controller.players.length < 2
                        ? 'Need at least 2 players'
                        : 'Start Game',
                  ),
                ),
              ] else ...[
                Text(
                  'Difficulty: ${room.settings.difficulty.label}',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                Text(
                  room.settings.difficulty.description,
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: Colors.white60),
                ),
                const SizedBox(height: 16),
                const Text('Waiting for host to start…'),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () => controller.requestCompass(),
                  child: const Text('Enable compass'),
                ),
              ],
            ],
          ),
        ),
        );
      },
    );
  }

  Widget _intTile(
    BuildContext context, {
    required String label,
    required int value,
    required int min,
    required int max,
    int step = 1,
    required ValueChanged<int> onChanged,
  }) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(label),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            onPressed: value <= min ? null : () => onChanged(value - step),
            icon: const Icon(Icons.remove_circle_outline),
          ),
          Text('$value', style: Theme.of(context).textTheme.titleMedium),
          IconButton(
            onPressed: value >= max ? null : () => onChanged(value + step),
            icon: const Icon(Icons.add_circle_outline),
          ),
        ],
      ),
    );
  }
}
