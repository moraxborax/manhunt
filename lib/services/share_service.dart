import 'dart:js_interop';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

@JS('manhuntShareUrl')
external JSPromise<JSString> _manhuntShareUrl(
  JSString title,
  JSString text,
  JSString url,
);

enum ShareResult { shared, copied, failed }

/// Web share sheet with clipboard fallback.
class ShareService {
  static Future<ShareResult> shareUrl({
    required String title,
    required String text,
    required String url,
  }) async {
    if (kIsWeb) {
      try {
        final result = await _manhuntShareUrl(
          title.toJS,
          text.toJS,
          url.toJS,
        ).toDart;
        return switch (result.toDart) {
          'shared' => ShareResult.shared,
          'copied' => ShareResult.copied,
          _ => ShareResult.failed,
        };
      } catch (_) {
        // Fall through to clipboard.
      }
    }

    try {
      await Clipboard.setData(ClipboardData(text: url));
      return ShareResult.copied;
    } catch (_) {
      return ShareResult.failed;
    }
  }
}
