# Manhunt · 猎人追捕 (Web PWA — React + TypeScript + AMap + Supabase)

Real-life outdoor hide-and-seek phone game built with **React 19**, **TypeScript**, **Vite**, **Tailwind CSS**, **AMap (高德地图)**, and **Supabase** (Postgres + Realtime Broadcast + Anonymous Auth).

Runs directly in mobile Safari (iOS), Chrome (Android), and WeChat/domestic mobile browsers as an installable **Progressive Web App (PWA)** — no Apple Developer account or App Store required.

---

## Key Features

### 1. Bilingual Localization (`简体中文` / `English`)
- Defaults to **Simplified Chinese (`简体中文`)** with a 1-tap **`EN` / `中文`** switcher in the top header across all screens.

### 2. China / Shanghai Map Support (`AMap 高德地图` + `GCJ-02` 火星坐标系)
- **Dual AMap Engine (`src/components/MapViewLevel0.tsx`):**
  1. **Official AMap JS API 2.0 (`webapi.amap.com/loader.js`):** Automatically used when `VITE_AMAP_KEY` (and optional `VITE_AMAP_SECURITY_JS_CODE`) is configured. Renders dark vector maps (`amap://styles/dark`).
  2. **Keyless AMap High-DPI Retina Tiles (`webrd0{1-4}.is.autonavi.com`):** Automatic zero-config fallback when no API key is set. Loads fast across Mainland China without domain whitelist restrictions.
- **Automatic `WGS-84 → GCJ-02` Coordinate Conversion (`src/utils/geoMath.ts`):**
  - Distance calculations (`proximityRadiusM`) and compass radar bearings (Levels 1–4) operate on true physical `WGS-84` GPS coordinates.
  - Display coordinates on Level 0 AMap are transformed via `wgs84ToGcj02()` so markers align accurately on Shanghai streets (eliminating the ~450m China datum shift).
  - Default map fallback center is **People's Square, Shanghai (`31.2304, 121.4737`)**.

### 3. Five Tracking Difficulty Levels (`Lv0` – `Lv4`)
| Level | Chinese Name | English Name | Hunter View |
| :--- | :--- | :--- | :--- |
| **Lv0** | 全图实时定位 | Full Map | Live AMap with real-time markers for all visible players |
| **Lv1** | 实时罗盘雷达 | Live Radar | 60fps HTML5 Canvas compass radar rotating with phone heading |
| **Lv2** | 脉冲雷达扫描 | Manual Radar | 8-second radar sweep on tap, followed by a silent cooldown |
| **Lv3** | 实时距离感应 | Proximity Count | Live count of hiders within `proximityRadiusM` (e.g., 50m) |
| **Lv4** | 极限盲盒感应 | Manual Sense | 8-second nearby hider count on tap, followed by a silent cooldown |

### 4. QR Code Catch & Role Conversion
- **Hiders (`躲藏者`)** can display a high-contrast **Catch QR (`manhunt:<roomCode>:<playerId>:<catchSecret>`)**.
- **Hunters (`猎人`)** scan the QR code using the built-in WebRTC camera scanner (`jsqr`) or paste fallback.
- Verified server-side by the `public.catch_player` Postgres `SECURITY DEFINER` RPC against `public.player_secrets`, converting the caught Hider into a Hunter.

---

## Development (`pnpm`)

### Prerequisites
- Node.js 20+
- `pnpm`

### Commands

```bash
# Install dependencies
pnpm install

# Start local dev server
pnpm run dev

# Typecheck & run unit tests (Vitest)
pnpm run lint
pnpm run test

# Production build (outputs to dist/)
pnpm run build
```

### Optional Environment Variables (`.env.local`)
See `.env.example`:

```ini
VITE_SUPABASE_URL=https://bmhymvgxhmpbzpcxprkr.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_5_n1UNeCghPn3nVtOsVEaw_gLCucHVD

# Optional: Official AMap Web JS API 2.0 credentials
VITE_AMAP_KEY=
VITE_AMAP_SECURITY_JS_CODE=
```

---

## Database & Security (`supabase/migrations/`)
The Supabase backend is shared and live:
- `20261015000000_manhunt_rooms_players.sql`: Core schema (`rooms`, `players`, `player_secrets`), RLS policies, and RPCs (`create_room`, `join_room`, `get_room_by_code`, `start_game`, `advance_to_hunting`, `catch_player`).
- `20261015010000_harden_manhunt_rls.sql`: Anti-cheat triggers preventing self-role promotion or host hijacking.
- `20261015020000_dead_room_cleanup.sql`: Automated `pg_cron` cleanup of finished/stale rooms.
