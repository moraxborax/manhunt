import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../controllers/game_controller.dart';
import '../services/share_service.dart';

Future<void> showLobbyInviteSheet(
  BuildContext context,
  GameController controller,
) async {
  final room = controller.room;
  if (room == null) return;
  final inviteUrl = controller.buildInviteUrl();

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
              'INVITE TO ROOM',
              style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              room.code,
              style: Theme.of(ctx).textTheme.displaySmall?.copyWith(
                    color: const Color(0xFF2AFF9A),
                    fontWeight: FontWeight.w900,
                    letterSpacing: 6,
                  ),
            ),
            const SizedBox(height: 16),
            Container(
              color: Colors.white,
              padding: const EdgeInsets.all(16),
              child: QrImageView(
                data: inviteUrl,
                size: 220,
                backgroundColor: Colors.white,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Friends can scan with their phone camera or the in-app scanner.',
              textAlign: TextAlign.center,
              style: Theme.of(ctx).textTheme.bodySmall?.copyWith(
                    color: Colors.white60,
                  ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      await Clipboard.setData(ClipboardData(text: inviteUrl));
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Join link copied')),
                        );
                      }
                    },
                    icon: const Icon(Icons.link),
                    label: const Text('Copy link'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () async {
                      final result = await ShareService.shareUrl(
                        title: 'Manhunt room ${room.code}',
                        text: 'Join my Manhunt game: ${room.code}',
                        url: inviteUrl,
                      );
                      if (!context.mounted) return;
                      final msg = switch (result) {
                        ShareResult.shared => 'Invite shared',
                        ShareResult.copied => 'Join link copied',
                        ShareResult.failed => 'Could not share link',
                      };
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(msg)),
                      );
                    },
                    icon: const Icon(Icons.ios_share),
                    label: const Text('Share'),
                  ),
                ),
              ],
            ),
          ],
        ),
      );
    },
  );
}
