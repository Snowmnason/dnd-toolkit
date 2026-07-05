# D&D Toolkit

D&D Toolkit is a cross-platform campaign and world-management app built with Expo Router, React Native, and Supabase. The repo contains the app shell, UI layer, hooks, orchestration code, portable infrastructure, and supporting desktop packaging.

## What This Repo Contains

- Web, mobile, and desktop app surfaces backed by the same core codebase
- Route-driven UI under `app/` with reusable components under `components/`
- React bridge code under `hooks/`
- Business orchestration under `managers/` and shared domain logic under `lib/`
- Infrastructure adapters under `middleware/` and portable infrastructure under `system/`
- Supporting docs under `docs/Important Notes/` and `docs/A Testing Guide/`

## Getting Started

1. Install dependencies.

   ```bash
   npm install
   ```

2. Configure local environment values.

   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   EXPO_PUBLIC_SENTRY_DSN=your_sentry_dsn
   ```

3. Start the Expo development server.

   ```bash
   npm start
   ```

4. Pick a surface:

- `npm run web` for the web app
- `npm run ios` for iOS
- `npm run android` for Android
- `npm run desktop:dev` for the Electron wrapper

## Common Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm run web` | Start the web app |
| `npm run desktop:dev` | Build the desktop web bundle and launch Electron |
| `npm run lint` | Run Expo ESLint checks |
| `npm run typecheck` | Run the TypeScript check |
| `npm run test` | Run Vitest |
| `npm run config:validate` | Validate app config files |
| `npm run predeploy` | Export the hardened web build |
| `npm run build:mobile` | Run EAS builds for mobile |

## Architecture

The repo follows a layered model.

```text
app + components
  -> hooks
  -> managers
  -> middleware
  -> system

managers -> lib
```

- `app/` and `components/` render UI and delegate work
- `hooks/` shape UI-facing state and actions
- `managers/` coordinate use cases and business validation
- `lib/` holds reusable domain logic
- `middleware/` adapts app logic to provider and infrastructure concerns
- `system/` holds portable infrastructure code

## Important Folders

- `app/` — Expo Router routes and app shell entry points
- `components/` — shared UI surfaces, layers, modals, and built-in controls
- `hooks/` — UI-facing hooks grouped by domain
- `providers/` and `contexts/` — app-shell provider stack and lightweight React contexts
- `lib/` — shared domain modules, feature systems, and app-specific reusable logic
- `middleware/` — provider and infrastructure adaptation
- `system/` — portable infrastructure services, storage, networking, jobs, and kernel code
- `desktop/` — Electron wrapper and desktop packaging
- `docs/Important Notes/` — current developer-facing reference notes

## Documentation

- `docs/Important Notes/README.md` — main developer reference index
- `docs/A Testing Guide/QA_OVERVIEW.md` — QA and manual testing guide
- `desktop/README.md` — desktop wrapper details
- `hooks/README.md` — hook map and usage guidance
- `lib/README.md` — shared domain module map
- `system/README.md` — portable infrastructure module map

## Validation

Default repo checks:

```bash
npm run typecheck
npm run lint
npm run test
npm run config:validate
```

## Release Notes

Release and packaging guidance lives in `docs/Important Notes/Dev/RELEASES.md` and `desktop/README.md`.
