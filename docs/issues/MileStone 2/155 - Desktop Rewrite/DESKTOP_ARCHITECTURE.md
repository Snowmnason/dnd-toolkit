# Desktop Application Architecture

Complete technical documentation for the Electron desktop application.

## Overview

The DnD Toolkit desktop app uses Electron to wrap the React Native web export into a native application for Windows, macOS, and Linux. This provides offline functionality, native window controls, auto-updates, and platform integration while reusing 100% of the web codebase.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       User Interaction                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process (Web)                    │
│  • React Native Web (Expo Router)                            │
│  • UI Components (components/ui/)                            │
│  • Business Logic (lib/, hooks/, contexts/)                  │
│  • Communicates via window.electronAPI (from preload)        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Preload Script (Bridge)                    │
│  • Exposes electronAPI via contextBridge                     │
│  • Secure IPC communication                                  │
│  • No direct access to Node.js or Electron APIs              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  Main Process (Electron)                     │
│  • Creates BrowserWindow                                     │
│  • Registers app:// protocol handler                         │
│  • Serves bundled web-build/ files                           │
│  • Handles IPC requests (window controls, dialogs, etc.)     │
│  • Window state persistence                                  │
│  • Security enforcement (CSP, navigation guards)             │
│  • Auto-updates (production only)                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    File System / OS APIs                     │
│  • web-build/ (bundled Expo export)                          │
│  • window-state.json (user data)                             │
│  • Native dialogs, notifications, window controls            │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Main Process (`desktop/src/main.ts`)

**Responsibilities:**

- Create and manage the main application window
- Register and handle the custom `app://` protocol
- Serve bundled web-build files with correct MIME types
- Inject `<base href="app://">` into index.html for path resolution
- Persist window state (size, position, maximized) across restarts
- Handle IPC communication securely
- Enforce Content Security Policy (CSP)
- Block external navigation attempts
- Configure auto-updates (production only)

**Key Functions:**

| Function                                  | Purpose                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `setupProtocolHandler()`                  | Maps `app://` URLs to `web-build/` directory with security validation  |
| `getContentType()`                        | Returns proper MIME types for all asset types (fonts, CSS, JS, images) |
| `loadWindowState()` / `saveWindowState()` | Persist window dimensions and position                                 |
| `setupSessionSecurity()`                  | Inject CSP headers into all `app://` responses                         |
| `setupNavigationGuards()`                 | Block will-navigate and will-redirect to external sites                |
| `registerIpcHandlers()`                   | Secure IPC handlers for window controls, dialogs, notifications        |
| `createWindow()`                          | Create BrowserWindow with proper security settings                     |
| `createMenu()`                            | Standard application menu (File, Edit, View, Window, Help)             |

### 2. Preload Script (`desktop/src/preload.ts`)

**Purpose:** Secure bridge between renderer process (web UI) and main process (Electron).

**Exposed API (`window.electronAPI`):**

```typescript
interface ElectronAPI {
  // Platform detection
  platform: NodeJS.Platform; // 'win32' | 'darwin' | 'linux'
  isElectron: boolean; // Always true in desktop app

  // App info
  getVersion: () => Promise<string>;

  // Window controls
  minimize: () => void;
  maximize: () => void; // Toggles between maximize/unmaximize
  close: () => void;

  // Theme
  getSystemTheme: () => Promise<"light" | "dark">;
  onThemeChange: (callback: (theme: "light" | "dark") => void) => () => void; // Returns cleanup function

  // File dialogs
  showSaveDialog: (
    options,
  ) => Promise<{ canceled: boolean; filePath?: string }>;
  showOpenDialog: (
    options,
  ) => Promise<{ canceled: boolean; filePaths: string[] }>;

  // Notifications
  showNotification: (title: string, body: string) => void;
}
```

**Security:**

- Uses `contextBridge.exposeInMainWorld()` to safely expose APIs
- No direct access to `ipcRenderer` from renderer
- Only specific IPC channels are exposed
- All IPC handlers validated in main process

### 3. Protocol Handler (`app://`)

**How It Works:**

1. **Registration:**

   ```typescript
   protocol.registerSchemesAsPrivileged([
     {
       scheme: "app",
       privileges: {
         standard: true,
         secure: true,
         supportFetchAPI: true,
         corsEnabled: true,
       },
     },
   ]);
   ```

2. **File Resolution:**
   - URL `app://` → `web-build/index.html`
   - URL `app://fonts.css` → `web-build/fonts.css`
   - URL `app://assets/icon.png` → `web-build/assets/icon.png`

3. **Path Validation:**

   ```typescript
   const resolvedCandidate = path.resolve(path.join(resolvedRoot, requestPath));
   if (!resolvedCandidate.startsWith(resolvedRoot)) {
     return 403; // Path traversal blocked
   }
   ```

4. **Base Tag Injection:**
   - Dynamically injects `<base href="app://">` into index.html
   - Ensures relative paths (`/fonts.css`) resolve to `app://fonts.css` not `app://index.html/fonts.css`
   - Critical for proper asset loading

5. **MIME Types:**
   - Fonts: `font/woff`, `font/woff2`, `font/ttf`, `font/otf`, `application/vnd.ms-fontobject`
   - CSS/JS: `text/css; charset=utf-8`, `application/javascript; charset=utf-8`
   - HTML: `text/html; charset=utf-8`
   - Images: `image/png`, `image/jpeg`, `image/svg+xml`, etc.

### 4. Window State Persistence

**File Location:** `app.getPath("userData")/window-state.json`

**Stored Data:**

```json
{
  "width": 1400,
  "height": 900,
  "x": 100,
  "y": 50,
  "isMaximized": false
}
```

**Events Tracked:**

- `resize` → Save width/height
- `move` → Save x/y position
- `maximize` → Set isMaximized: true
- `unmaximize` → Set isMaximized: false

**Restoration:**

- On app startup, load state from JSON file
- If file doesn't exist or is invalid, use defaults
- Restores window to exact size/position from last session

### 5. Security Features

#### Content Security Policy (CSP)

Injected into all `app://` responses via `session.webRequest.onHeadersReceived`:

```
default-src 'self' app:// data: blob: https:;
script-src 'self' app:// 'unsafe-inline' 'unsafe-eval';
style-src 'self' app:// 'unsafe-inline';
img-src 'self' app:// data: blob: https:;
font-src 'self' app:// data:;
connect-src 'self' https: wss: app://;
```

**Why `unsafe-inline` and `unsafe-eval`?**

- React Native Web generates inline styles dynamically
- Metro bundler may use eval for module loading
- Acceptable trade-off for desktop app (not exposed to web attacks)

#### Navigation Guards

**Blocked:**

- `will-navigate` to external URLs
- `will-redirect` to external URLs
- Opening new windows with `window.open()`

**Allowed:**

- Navigation within `app://`
- Navigation to `file://` (local files)
- Navigation to `http://localhost:*` (dev server)

**Implementation:**

```typescript
mainWindow.webContents.on("will-navigate", (event, url) => {
  if (
    !url.startsWith("app://") &&
    !url.startsWith("file://") &&
    !url.match(/^http:\/\/localhost:/)
  ) {
    event.preventDefault();
    console.warn("[Security] Blocked navigation to:", url);
  }
});
```

#### IPC Security

**Origin Validation:**

```typescript
const TRUSTED_ORIGINS = ["app://", "file://", "http://localhost:"];
const isTrustedSender = (event: IpcMainEvent): boolean => {
  const url = event.senderFrame.url;
  return TRUSTED_ORIGINS.some((origin) => url.startsWith(origin));
};
```

**Input Sanitization:**

```typescript
const sanitizeText = (text: string): string => {
  return text.replace(/[<>]/g, "").substring(0, 10000);
};
```

**Guard Function:**

```typescript
const guardIpc = (event: IpcMainEvent, channel: string): boolean => {
  if (!isTrustedSender(event)) {
    console.error(
      `[IPC Security] Untrusted sender for ${channel}:`,
      event.senderFrame.url,
    );
    return false;
  }
  return true;
};
```

All IPC handlers call `guardIpc()` before processing requests.

## Build Process

### 1. Prepare Web Export

```bash
npm run predeploy:desktop
```

**Steps:**

1. `expo export -p web` → Bundles React Native to web (outputs to `dist/`)
2. `node scripts/harden-web.js` → Injects Subresource Integrity (SRI) and CSP into HTML
3. `node scripts/fix-desktop-paths.js` → Converts absolute paths to `app://` protocol
4. `node scripts/strip-dev-appsettings.js` → Removes dev-only feature flags

**Output:** `dist/` folder with production web build

### 2. Compile TypeScript

```bash
cd desktop && npm run build
```

**Steps:**

1. `tsc` → Compiles `src/main.ts` and `src/preload.ts` to `dist/main.js` and `dist/preload.js`

**Config:** `desktop/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs", // Required for Electron main process
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

### 3. Package with electron-builder

```bash
npm run desktop:dist:win   # Windows
npm run desktop:dist:mac   # macOS
npm run desktop:dist:linux # Linux
npm run desktop:dist:all   # All platforms
```

**electron-builder Configuration:** `desktop/electron-builder.json`

**Key Settings:**

- `extraResources`: Copies `../dist` → `resources/web-build/`
- `files`: Includes `dist/**/*` (compiled TypeScript), `assets/**/*`
- `afterPack`: Runs `scripts/embed-icon.js` to embed icon into exe
- `nsis.include`: Custom uninstall script (`scripts/nsis-uninstall.nsh`)

**Windows Output:**

- `dist-desktop/DnD-Toolkit-{version}-installer.exe` (NSIS installer)
- `dist-desktop/win-unpacked/` (portable version)

**macOS Output:**

- `dist-desktop/DnD-Toolkit-{version}-mac-{arch}.dmg` (drag-to-install)
- `dist-desktop/DnD-Toolkit-{version}-mac-{arch}.zip` (auto-update)

**Linux Output:**

- `dist-desktop/DnD-Toolkit-{version}-linux-x64.AppImage` (portable)
- `dist-desktop/DnD-Toolkit-{version}-linux-x64.deb` (Debian/Ubuntu)

### 4. Auto-Update Configuration

**Production Only:**

```typescript
if (!isDev && process.platform === "win32") {
  autoUpdater.setFeedURL({
    provider: "github",
    owner: "Snowmnason",
    repo: "dnd-toolkit",
  });
  autoUpdater.checkForUpdatesAndNotify();
}
```

**How It Works:**

1. On app startup, check GitHub Releases for latest version
2. If newer version found, download in background
3. Notify user when update is ready
4. Apply update on next app restart

## Development Workflow

### Running in Development

**Terminal 1 - Start Expo Dev Server:**

```bash
npm run web
```

**Terminal 2 - Start Desktop App:**

```bash
npm run desktop:dev
```

**What Happens:**

- Main process loads `http://localhost:8081` instead of `app://`
- Hot reloading works (changes reflect immediately)
- DevTools open by default
- No protocol handler needed (uses Expo dev server)

### Building for Testing

```bash
npm run desktop:dist:win
```

**What Happens:**

1. Cleans `desktop/dist` and `dist-desktop`
2. Compiles TypeScript (`cd desktop && tsc`)
3. Bundles web export (`npm run predeploy:desktop`)
4. Packages with electron-builder
5. Creates installer in `dist-desktop/`

**Testing Packaged App:**

```bash
# Run from unpacked folder (skip installer)
dist-desktop/win-unpacked/DnD-Toolkit.exe --enable-devtools
```

### Debugging

**Main Process:**

```bash
# From desktop/ folder
npm run dev
```

- Outputs to terminal (console.log visible)
- Use `--inspect` flag for Chrome DevTools debugging

**Renderer Process:**

- Press `Ctrl+Shift+I` to open DevTools
- Or add to menu: `View → Toggle Developer Tools`
- Network tab shows `app://` requests
- Console shows React/web errors

**Common Issues:**

| Issue              | Symptom                        | Solution                                                         |
| ------------------ | ------------------------------ | ---------------------------------------------------------------- |
| Blank screen       | Window loads but shows nothing | Check `app://` protocol registration, verify `web-build/` exists |
| Fonts not loading  | Text renders in fallback font  | Check MIME types in `getContentType()`, verify fonts.css path    |
| Images not loading | Broken image icons             | Check CSP allows `app://`, verify image paths, check MIME types  |
| Window size resets | Window opens at default size   | Check `window-state.json` exists, verify persistence logic       |

## File Structure

```
desktop/
├── src/
│   ├── main.ts           # Main process (900+ lines)
│   │   ├── Protocol handler (app://)
│   │   ├── Window state persistence
│   │   ├── IPC handlers (secure)
│   │   ├── Security (CSP, navigation guards)
│   │   └── Auto-updater
│   └── preload.ts        # Preload script (secure bridge)
│       └── Exposes window.electronAPI
├── scripts/
│   ├── embed-icon.js     # Post-build: embed icon into exe
│   ├── nsis-uninstall.nsh # Custom uninstall cleanup
│   ├── check-prereqs.sh  # Verify build environment (Unix)
│   └── check-prereqs.ps1 # Verify build environment (Windows)
├── assets/
│   └── images/
│       ├── icon.ico      # Windows icon (256x256)
│       └── icon.png      # macOS/Linux icon (1024x1024)
├── dist/                 # Compiled TypeScript (generated)
│   ├── main.js
│   └── preload.js
├── package.json          # Desktop dependencies
├── tsconfig.json         # TypeScript config
├── electron-builder.json # Packaging config
└── entitlements.mac.plist # macOS entitlements

Root project:
├── dist/                 # Web export (generated by Expo)
│   ├── index.html
│   ├── fonts.css
│   ├── assets/
│   └── _expo/
└── dist-desktop/         # Packaged apps (generated by electron-builder)
    ├── DnD-Toolkit-{version}-installer.exe
    └── win-unpacked/
```

## Environment Detection

**In Web Code:**

```typescript
// Check if running in Electron
const isElectron = !!(window as any).electronAPI;

if (isElectron) {
  // Use app:// protocol for assets
  const fontUrl = "app://fonts.css";

  // Access Electron APIs
  window.electronAPI.minimize();
  window.electronAPI.getSystemTheme();

  // Use localStorage (persistent in Electron)
  localStorage.setItem("key", "value");
} else {
  // Use web protocol
  const fontUrl = "/fonts.css";

  // Use sessionStorage (cleared on tab close)
  sessionStorage.setItem("key", "value");
}
```

**Examples in Codebase:**

- `lib/utils/web-font-loader.ts` - Uses `app://fonts.css` in Electron
- `lib/auth/encrypted-storage.ts` - Uses `localStorage` in Electron, `sessionStorage` in browser
- `components/TopBar.tsx` - Shows window controls in Electron

## Performance Optimizations

### Lazy Loading

- Images use `LazyImage` component with viewport tracking
- Fonts loaded on-demand (not all at startup)
- Routes loaded lazily via Expo Router

### Caching

- Web build files cached by protocol handler (in-memory)
- Image cache uses LRU eviction
- Query cache for API responses (in-memory)

### Bundle Size

- Main bundle: ~4.4 MB (compressed)
- Installer size: ~49 MB (includes Electron runtime)
- Unpacked size: ~180 MB

### Startup Time

- Cold start: ~2-3 seconds
- Warm start: ~1 second (after first run)
- Most time spent loading React Native Web

## Security Checklist

- [x] Content Security Policy (CSP) enforced
- [x] Navigation blocked to external sites
- [x] IPC handlers validate sender origin
- [x] IPC inputs sanitized
- [x] Path traversal protection in protocol handler
- [x] No `nodeIntegration` in renderer
- [x] `contextIsolation` enabled
- [x] `webSecurity` enabled
- [x] `allowRunningInsecureContent` disabled
- [x] Auto-updates use HTTPS
- [x] Code signing configured (pending certificates)
- [x] Subresource Integrity (SRI) in HTML
- [x] No debug logging of credentials

## Troubleshooting

### Build Fails

**"Cannot find module 'electron'"**

```bash
cd desktop && npm install
```

**"tsc: command not found"**

```bash
cd desktop && npm install -D typescript
```

**"expo-cli not found"**

```bash
npm install -g @expo/cli
```

### Runtime Issues

**Blank Screen**

1. Check if `web-build/` folder exists at runtime:
   ```typescript
   console.log("Web build exists:", fs.existsSync(webBuildDir));
   ```
2. Check protocol handler registration:
   ```typescript
   console.log("Protocol registered:", protocol.isProtocolHandled("app"));
   ```
3. Open DevTools and check Network tab for failed requests

**Fonts Not Loading**

1. Verify `fonts.css` exists in `web-build/`
2. Check MIME type: should be `text/css; charset=utf-8`
3. Check CSP allows `app://` for `font-src`
4. Verify `<base href="app://">` is injected in index.html

**Images Not Loading**

1. Check CSP `img-src` allows `app://`
2. Verify image paths use relative URLs (`/assets/image.png` not `/p:/...`)
3. Check MIME types for image formats
4. Verify `fix-desktop-paths.js` converted paths correctly

**Window Size Not Saving**

1. Check `window-state.json` in user data folder:
   ```typescript
   console.log("User data:", app.getPath("userData"));
   ```
2. Verify `loadWindowState()` and `saveWindowState()` are called
3. Check file permissions (may fail on restricted systems)

## Future Improvements

### Planned

- [ ] Add update progress UI (currently silent download)
- [ ] Implement custom title bar (frameless window)
- [ ] Add tray icon with quick actions
- [ ] Support drag-and-drop file import
- [ ] Add keyboard shortcuts configuration
- [ ] Implement native context menus
- [ ] Add better error recovery (crash reporter)

### Considered

- [ ] Multi-window support (separate panels in windows)
- [ ] Background sync (offline changes sync when online)
- [ ] Local database (SQLite for offline data)
- [ ] Print support (export PDFs)
- [ ] System notifications for events

## References

- [Electron Documentation](https://www.electronjs.org/docs/latest/)
- [electron-builder](https://www.electron.build/)
- [Expo for Web](https://docs.expo.dev/workflow/web/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [IPC Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
