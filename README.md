# Manhunt

Real-life hide-and-seek on your phone. Create a room, friends join with a code/link/QR, hunters and hiders get random roles, and location syncs live over Supabase. Catch someone by scanning the QR on their screen — they become a hunter.

Flutter **Web PWA** (works in Safari / Chrome; no App Store / TestFlight required).

## Features

- Rooms with 6-character codes, shareable `?room=CODE` links, and lobby invite QR
- Session reconnect after refresh (anonymous Supabase auth + local room code)
- Difficulty levels 0–4: full map → continuous radar → manual radar → proximity count → manual sense
- QR catch (hunters only); catch secrets stored privately in Supabase
- Stealth / pocket mode + screen wake lock helpers for outdoor play
- Dead-room cleanup via `pg_cron` (ended / abandoned rooms)
- CI: `flutter analyze` + `flutter test` + web build; deploy to GitHub Pages on `main`

## Stack

| Piece | Choice |
|-------|--------|
| App | Flutter Web (JS) |
| Backend | [Supabase](https://supabase.com) (Postgres + Realtime + Anonymous Auth) |
| Map tiles | OpenStreetMap via `flutter_map` |
| Hosting | GitHub Pages (`flutter build web --base-href /manhunt/`) |

Project URL (configured in app): `https://bmhymvgxhmpbzpcxprkr.supabase.co`

## Prerequisites

1. [Flutter](https://docs.flutter.dev/get-started/install) stable
2. A Supabase project with **Anonymous Sign-Ins enabled**  
   Dashboard → Authentication → Providers → Anonymous → ON  
   Without this, Create/Join Room fails with `anonymous_provider_disabled`.

## Run locally

```bash
flutter pub get
flutter run -d chrome
# or share on the same Wi‑Fi:
flutter run -d web-server --web-hostname 0.0.0.0 --web-port 8080
```

Optional overrides:

```bash
flutter run -d chrome \
  --dart-define=SUPABASE_URL=https://YOUR_REF.supabase.co \
  --dart-define=SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## Tests & CI

```bash
flutter analyze lib test
flutter test
flutter build web --release --base-href /manhunt/
```

GitHub Actions (`.github/workflows/deploy-pages.yml`) runs analyze + test + web build on pushes/PRs to `main`, and deploys Pages only on `main`.

### GitHub Pages (first time)

1. Push the repo (named `manhunt` if you keep `--base-href /manhunt/`).
2. Settings → Pages → Source: **GitHub Actions**.
3. Live URL: `https://<user>.github.io/manhunt/`  
   Invite link example: `https://<user>.github.io/manhunt/?room=HUNT42`

## How to play

1. Host creates a room and shares the code, link, or lobby QR.
2. Others join (lobby stays open until the host starts).
3. Host sets difficulty, hunter count, head start, scan cooldown, proximity radius → **Start Game**.
4. After head start, hunters use the map/radar/proximity view; hiders stay hidden.
5. Hunter scans the hider’s **Catch QR** → hider becomes a hunter.
6. Game ends when no hiders remain.

## Project layout

```
lib/
  config/          # Supabase URL / publishable key
  controllers/     # Game state machine
  models/          # Room, player, difficulty, catch payload
  screens/         # Home, lobby, game
  services/        # Supabase sync, sensors, share
  utils/           # Pure helpers (geo math)
  widgets/         # Map, radar, proximity, QR sheets
supabase/migrations/  # Schema notes / cleanup docs (applied via Supabase MCP)
```

## License

Private project — not published to pub.dev (`publish_to: 'none'`).
