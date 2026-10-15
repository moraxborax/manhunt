import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../controllers/game_controller.dart';
import '../models/game_models.dart';

Future<void> showHiderQrSheet(
  BuildContext context,
  GameController controller,
) async {
  final room = controller.room;
  final me = controller.me;
  final secret = controller.catchSecret;
  if (room == null || me == null || secret == null) return;

  final payload = CatchPayload(
    roomCode: room.code,
    playerId: me.id,
    catchSecret: secret,
  ).encode();

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(0xFF111111),
    builder: (ctx) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'SHOW THIS TO A HUNTER',
              style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 16),
            Container(
              color: Colors.white,
              padding: const EdgeInsets.all(16),
              child: QrImageView(
                data: payload,
                size: 240,
                backgroundColor: Colors.white,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Keep screen bright. Only hunters in this room can catch you.',
              textAlign: TextAlign.center,
              style: Theme.of(ctx).textTheme.bodySmall?.copyWith(
                    color: Colors.white60,
                  ),
            ),
          ],
        ),
      );
    },
  );
}

Future<void> showHunterScanSheet(
  BuildContext context,
  GameController controller,
) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(0xFF111111),
    builder: (ctx) {
      return SizedBox(
        height: MediaQuery.of(ctx).size.height * 0.75,
        child: Column(
          children: [
            const SizedBox(height: 16),
            Text(
              'SCAN CATCHED HIDER',
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
                  onDetect: (capture) async {
                    final raw = capture.barcodes.firstOrNull?.rawValue;
                    if (raw == null) return;
                    Navigator.of(ctx).pop();
                    await controller.catchFromQr(raw);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            controller.error ?? 'Caught! They are now a hunter.',
                          ),
                        ),
                      );
                    }
                  },
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: TextField(
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  labelText: 'Or paste QR text',
                  labelStyle: TextStyle(color: Colors.white70),
                  border: OutlineInputBorder(),
                ),
                onSubmitted: (value) async {
                  Navigator.of(ctx).pop();
                  await controller.catchFromQr(value);
                },
              ),
            ),
          ],
        ),
      );
    },
  );
}

/// Brighten screen hint when showing QR.
void boostBrightnessHint() {
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
}
