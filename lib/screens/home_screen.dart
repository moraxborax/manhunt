import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../controllers/game_controller.dart';
import '../models/game_models.dart';
import 'game_screen.dart';
import 'lobby_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.controller});

  final GameController controller;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _nameCtrl = TextEditingController();
  final _codeCtrl = TextEditingController();
  bool _bootstrapped = false;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final name = await widget.controller.savedDisplayName();
    if (name != null && mounted) _nameCtrl.text = name;

    final urlCode = widget.controller.getUrlRoomCode();
    if (urlCode != null && mounted) {
      _codeCtrl.text = urlCode;
    }

    final reconnected = await widget.controller.tryReconnectSavedSession();
    if (!mounted) return;
    setState(() => _bootstrapped = true);

    if (!reconnected) return;

    final code = widget.controller.room?.code;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Reconnected to Room ${code ?? ''}')),
    );

    final phase = widget.controller.room?.phase;
    if (phase == GamePhase.hiding ||
        phase == GamePhase.hunting ||
        phase == GamePhase.ended) {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => GameScreen(controller: widget.controller),
        ),
      );
    } else {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => LobbyScreen(controller: widget.controller),
        ),
      );
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _codeCtrl.dispose();
    super.dispose();
  }

  Future<void> _goLobby(Future<void> Function() action) async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a display name')),
      );
      return;
    }
    await action();
    if (!mounted) return;
    if (widget.controller.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(widget.controller.error!)),
      );
      return;
    }
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => LobbyScreen(controller: widget.controller),
      ),
    );
  }

  Future<void> _scanRoomQr() async {
    final code = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF111111),
      builder: (ctx) {
        var handled = false;
        return SizedBox(
          height: MediaQuery.of(ctx).size.height * 0.7,
          child: Column(
            children: [
              const SizedBox(height: 16),
              Text(
                'SCAN ROOM QR',
                style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: MobileScanner(
                    onDetect: (capture) {
                      if (handled) return;
                      final raw = capture.barcodes.firstOrNull?.rawValue;
                      if (raw == null) return;
                      final parsed = GameController.parseRoomCodeFromScan(raw);
                      if (parsed == null) return;
                      handled = true;
                      Navigator.of(ctx).pop(parsed);
                    },
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  'Scan a lobby invite QR (or a plain room code).',
                  style: Theme.of(ctx)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: Colors.white60),
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ),
        );
      },
    );

    if (code == null || !mounted) return;
    _codeCtrl.text = code;
    await _goLobby(
      () => widget.controller.joinRoom(code, _nameCtrl.text.trim()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.controller,
      builder: (context, _) {
        final busy = widget.controller.busy;
        if (!_bootstrapped && busy) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        return Scaffold(
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Spacer(),
                  Text(
                    'MANHUNT',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.displaySmall?.copyWith(
                          color: const Color(0xFF2AFF9A),
                          fontWeight: FontWeight.w900,
                          letterSpacing: 4,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Real-life hide & seek',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: Colors.white70,
                        ),
                  ),
                  const Spacer(),
                  TextField(
                    controller: _nameCtrl,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(
                      labelText: 'Your name',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: busy
                        ? null
                        : () => _goLobby(
                              () => widget.controller
                                  .createRoom(_nameCtrl.text.trim()),
                            ),
                    child: Text(busy ? 'Working…' : 'Create Room'),
                  ),
                  const SizedBox(height: 24),
                  TextField(
                    controller: _codeCtrl,
                    textCapitalization: TextCapitalization.characters,
                    decoration: InputDecoration(
                      labelText: 'Room code',
                      border: const OutlineInputBorder(),
                      suffixIcon: IconButton(
                        tooltip: 'Scan room QR',
                        onPressed: busy ? null : _scanRoomQr,
                        icon: const Icon(Icons.qr_code_scanner),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: busy
                        ? null
                        : () => _goLobby(
                              () => widget.controller.joinRoom(
                                _codeCtrl.text.trim(),
                                _nameCtrl.text.trim(),
                              ),
                            ),
                    child: const Text('Join Room'),
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
