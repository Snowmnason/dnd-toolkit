# Project NPM Scripts

This document lists all npm scripts defined in the repository (root and desktop), with short descriptions and the exact commands.

---

`npm run ___`

## Root package.json (`package.json`)

- **start**: `expo start`
- **reset-project**: `node ./scripts/reset-project.js`
- **android**: `expo start --android`
- **ios**: `expo start --ios`
- **web**: `expo start --web`
  - Runs Expo in web mode (development web environment).
- **lint**: `expo lint`
- **predeploy**: `expo export -p web`
  - Exports a static web build into `dist/`.
- **deploy**: `gh-pages -d dist --dotfiles`
  - Deploys `dist/` to GitHub Pages.
- **deploy-dev**: `gh-pages -d dist -b gh-pages-dev`
- **""**: `expo start`
  - (An empty key exists and maps to `expo start`.)
- **w**: `expo start --web`
  - Shortcut for web.
- **build:ios**: `eas build --platform ios`
- **build:android**: `eas build --platform android`
- **build:mobile**: `eas build --platform all`
- **submit:ios**: `eas submit --platform ios`
- **submit:android**: `eas submit --platform android`
- **submit:mobile**: `eas submit --platform all`
- **lint**:

### Desktop-related helper scripts (root)

- **desktop:install**: `cd desktop && npm install`
  - Installs dependencies for the desktop wrapper.
- **desktop:build**: `cd desktop && npm run build`
  - Compiles TypeScript inside `desktop/` (runs `tsc`).
- **desktop:dev**: `npm run predeploy && cd desktop && npm run dev`
  - Builds web export then runs desktop in dev mode (desktop uses the exported web build or dev flags).
- **desktop:dist**: `npm run predeploy && cd desktop && npm run dist`
  - Builds web export then builds desktop distribution for current platform.
- **desktop:dist:win**: `npm run predeploy && cd desktop && npm run dist:win`
- **desktop:dist:mac**: `npm run predeploy && cd desktop && npm run dist:mac`
- **desktop:dist:linux**: `npm run predeploy && cd desktop && npm run dist:linux`
- **desktop:dist:all**: `npm run predeploy && cd desktop && npm run dist:all`

---

## Desktop package.json (`desktop/package.json`)

- **start**: `electron .`
  - Run the packaged electron app (expects compiled `dist/` output).
- **build**: `tsc`
  - Compile TypeScript to `dist/`.
- **dev**: `tsc && electron . --dev`
  - Compile then run Electron in development mode.
- **pack**: `electron-builder --dir`
  - Create unpacked build directory.
- **dist**: `electron-builder`
  - Build distribution packages for the current platform.
- **dist:win**: `electron-builder --win`
  - Build Windows installer(s).
- **dist:mac**: `electron-builder --mac`
  - Build macOS packages.
- **dist:linux**: `electron-builder --linux`
  - Build Linux packages.
- **dist:all**: `electron-builder --win --mac --linux`
  - Build for all platforms (requires appropriate host/platform tooling).

---

## Notes

- The canonical web development script is `npm run web` (root) which starts the Expo web dev server.
- The `predeploy` script produces a `dist/` web export required by the desktop builder and GitHub Pages deploy.
- Desktop packaging assumes you run `npm run predeploy` (root) first, or use the root `desktop:*` scripts which call `predeploy` automatically.

---

_File created automatically: `docs/SCRIPTS.md`_
