# ResumeLens — Mobile App

Expo (SDK 57) + Expo Router + TypeScript client for the ResumeLens FastAPI backend in `../backend`.

## Run

```bash
npm install
npx expo start        # press a (Android), i (iOS), w (web), or scan the QR with Expo Go
```

With no `.env`, the app runs on built-in **demo data**, so every screen works without the backend.
To hit the real API, copy `.env.example` to `.env`, set `EXPO_PUBLIC_API_URL`, and restart the dev server.

- Physical phone: use your computer's LAN IP (e.g. `http://192.168.1.10:8000`) and run the backend with `--host 0.0.0.0`.
- Android emulator: `http://10.0.2.2:8000`.
- Web: add `http://localhost:8081` to the backend's `CORS_ORIGINS`.

## Structure

```
src/
  app/                    # Routes (Expo Router): every file is a screen
    _layout.tsx           # Root stack
    (tabs)/               # Bottom tabs: Home, Analyze, History, Settings
    analysis/[id].tsx     # Analysis result (pushed on the stack)
  components/
    ui/                   # Generic building blocks: Button, Card, Chip, loading/error/empty states
    analysis/             # Feature components: ScoreBadge, ScoreBar, SkillList, HistoryRow
    screen.tsx            # Page wrapper: safe area, scroll, pull-to-refresh
    app-tabs(.web).tsx    # Native tabs on iOS/Android, custom tab bar on web
  config/env.ts           # EXPO_PUBLIC_* settings
  constants/theme.ts      # Colors (light/dark), spacing, fonts
  hooks/                  # useAsync, useTheme, useColorScheme
  services/               # api-client (fetch wrapper) + analysis-service (endpoints)
  mocks/                  # In-memory demo backend used when no API URL is set
  types/                  # Types mirroring the backend schemas
  utils/                  # Formatting helpers
```

Data flow: **screen → hook (`useAsync`) → `analysisService` → `api-client` or `mocks`**.
Screens never call `fetch` directly, so switching between demo and live data is one flag in `config/env.ts`.

## Checks

```bash
npx tsc --noEmit
npx expo lint
```
