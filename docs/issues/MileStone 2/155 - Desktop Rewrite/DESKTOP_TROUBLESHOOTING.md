# Desktop Troubleshooting Guide

Quick reference for diagnosing and fixing common Electron desktop app issues.

## Quick Diagnostics

### Check if App is Running in Electron

Open DevTools (Ctrl+Shift+I) and run:

```javascript
!!window.electronAPI;
// Should return: true
```

### Check Protocol Handler Status

In main process console (npm run desktop:dev):

```
[Protocol] Setup: { isDev: false, appPath: '...', webBuildDir: '...', exists: true }
[Protocol] Web build contents: [ 'index.html', 'fonts.css', ... ]
```

### Check Window State File

**Location:**

- Windows: `%APPDATA%\dnd-toolkit\window-state.json`
- macOS: `~/Library/Application Support/dnd-toolkit/window-state.json`
- Linux: `~/.config/dnd-toolkit/window-state.json`

**Check in code:**

```javascript
console.log("User data:", app.getPath("userData"));
```

## Common Issues

### 🔴 Blank Screen on Launch

**Symptoms:**

- App opens but shows white/black screen
- No error in console
- Window controls work

**Diagnosis:**

1. Open DevTools (Ctrl+Shift+I)
2. Check Console tab for errors
3. Check Network tab for failed requests

**Causes & Fixes:**

| Cause                   | Check                                | Fix                                       |
| ----------------------- | ------------------------------------ | ----------------------------------------- |
| Protocol not registered | Console: `[Protocol] Setup:` missing | Verify `setupProtocolHandler()` is called |
| web-build missing       | `exists: false` in protocol logs     | Run `npm run predeploy:desktop`           |
| Wrong URL format        | Loading `app://index.html`           | Change to `app://` (no file)              |
| Base tag missing        | Relative paths broken                | Verify base tag injection in HTML         |

**Quick Fix:**

```bash
# Rebuild web export
npm run predeploy:desktop

# Rebuild TypeScript
cd desktop && npm run build

# Run app
npm run desktop:dev
```

### 🔴 Fonts Not Loading

**Symptoms:**

- Text renders in fallback font (Arial, Times New Roman)
- Custom fonts (Eurostile, Cyberpunk, etc.) not working

**Diagnosis:**

1. Open DevTools Network tab
2. Filter by `fonts.css`
3. Check if request succeeds (Status 200)
4. Check MIME type (should be `text/css; charset=utf-8`)

**Causes & Fixes:**

| Cause               | Check                               | Fix                                                       |
| ------------------- | ----------------------------------- | --------------------------------------------------------- |
| fonts.css not found | Network shows 404                   | Verify `dist/fonts.css` exists after `predeploy:desktop`  |
| Wrong MIME type     | Response header shows wrong type    | Check `getContentType()` returns `text/css` for CSS files |
| CSP blocks fonts    | Console: CSP violation              | Verify CSP `font-src` includes `app:// data:`             |
| Wrong font path     | fonts.css references absolute paths | Run `fix-desktop-paths.js` to convert to `app://`         |

**Quick Fix:**

```bash
# Check if fonts.css exists
ls dist/fonts.css

# If missing, rebuild
npm run predeploy:desktop

# Verify paths converted
grep "app://" dist/fonts.css
```

**Manual Verification:**

```javascript
// In DevTools Console
fetch("app://fonts.css")
  .then((r) => r.text())
  .then(console.log);
// Should show CSS with app:// font URLs
```

### 🔴 Images Not Loading

**Symptoms:**

- Broken image icons (🖼️)
- Images show placeholder or nothing

**Diagnosis:**

1. Open DevTools Network tab
2. Find image request
3. Check Status (should be 200)
4. Check MIME type (should be `image/png`, `image/jpeg`, etc.)

**Causes & Fixes:**

| Cause                       | Check                                   | Fix                                                       |
| --------------------------- | --------------------------------------- | --------------------------------------------------------- |
| CSP blocks images           | Console: CSP violation                  | Verify CSP `img-src` includes `app:// data: blob: https:` |
| Wrong image path            | Network shows 404                       | Verify image exists in `dist/assets/`                     |
| Absolute path not converted | Path shows `P:/...`                     | Run `fix-desktop-paths.js`                                |
| Wrong MIME type             | Header shows `application/octet-stream` | Add extension to `getContentType()`                       |

**Quick Fix:**

```bash
# List images in dist
ls dist/assets/images/

# Verify paths converted
grep -r "app://" dist/*.html

# Rebuild if needed
npm run predeploy:desktop
```

### 🔴 Window Size Not Persisting

**Symptoms:**

- Window opens at default size every time
- Position resets to center screen
- Maximize state not remembered

**Diagnosis:**

1. Check if window-state.json exists
2. Check file permissions
3. Check console for save/load errors

**Causes & Fixes:**

| Cause               | Check                          | Fix                                                      |
| ------------------- | ------------------------------ | -------------------------------------------------------- |
| File not created    | window-state.json missing      | Check write permissions on userData folder               |
| Save not called     | No `[Window State] Saved:` log | Verify event listeners (`resize`, `move`, etc.) attached |
| Load fails          | Console: `Failed to load`      | Check JSON syntax, delete file and restart               |
| Wrong userData path | File in unexpected location    | Use `app.getPath('userData')` not hardcoded path         |

**Quick Fix:**

```bash
# Find user data folder
# Windows:
echo %APPDATA%\dnd-toolkit

# macOS:
echo ~/Library/Application\ Support/dnd-toolkit

# Linux:
echo ~/.config/dnd-toolkit

# Delete corrupted state file
rm window-state.json

# Restart app (will create new file)
```

**Manual Check:**

```javascript
// In main process console
const state = loadWindowState();
console.log("Loaded state:", state);

// Force save
const currentState = {
  width: mainWindow.getBounds().width,
  height: mainWindow.getBounds().height,
  x: mainWindow.getBounds().x,
  y: mainWindow.getBounds().y,
  isMaximized: mainWindow.isMaximized(),
};
saveWindowState(currentState);
```

### 🔴 Navigation/Routing Not Working

**Symptoms:**

- Clicking links does nothing
- Browser back/forward broken
- Routes don't change

**Diagnosis:**

1. Check console for navigation errors
2. Verify Expo Router is working
3. Check if navigation guards are blocking

**Causes & Fixes:**

| Cause                     | Check                                    | Fix                                     |
| ------------------------- | ---------------------------------------- | --------------------------------------- |
| Navigation guard blocking | Console: `[Security] Blocked navigation` | Whitelist `app://` in navigation guards |
| Expo Router misconfigured | Check `app/_layout.tsx`                  | Verify Expo Router setup                |
| Base tag wrong            | Links navigate to wrong URLs             | Verify `<base href="app://">` in HTML   |
| External link clicked     | Guard blocks external URLs               | Expected behavior (security feature)    |

### 🔴 IPC Not Working

**Symptoms:**

- Window controls (minimize/maximize) don't work
- Dialogs don't open
- Theme changes not detected

**Diagnosis:**

1. Check if `window.electronAPI` exists
2. Check main process console for IPC logs
3. Verify preload script loaded

**Causes & Fixes:**

| Cause                  | Check                                      | Fix                                              |
| ---------------------- | ------------------------------------------ | ------------------------------------------------ |
| Preload not loaded     | `window.electronAPI === undefined`         | Check `webPreferences.preload` in createWindow() |
| IPC origin blocked     | Console: `[IPC Security] Untrusted sender` | Verify sender URL is `app://` not external       |
| Handler not registered | No response to IPC call                    | Check `registerIpcHandlers()` called             |
| Wrong channel name     | Handler doesn't match sender               | Verify channel names match                       |

**Quick Fix:**

```javascript
// In DevTools Console
console.log(window.electronAPI);
// Should show: { platform, isElectron, getVersion, minimize, ... }

// Test IPC
window.electronAPI.getVersion().then(console.log);
// Should print version string

// Test window controls
window.electronAPI.minimize(); // Should minimize window
```

### 🔴 Build Fails

**Symptoms:**

- `npm run desktop:dist:win` fails
- TypeScript errors
- electron-builder errors

**Diagnosis:**

1. Check error message (TypeScript vs electron-builder)
2. Verify all dependencies installed
3. Check disk space

**Common Errors:**

| Error                           | Cause                    | Fix                                              |
| ------------------------------- | ------------------------ | ------------------------------------------------ |
| `Cannot find module 'electron'` | Missing dependencies     | `cd desktop && npm install`                      |
| `tsc: command not found`        | TypeScript not installed | `cd desktop && npm install -D typescript`        |
| `expo-cli not found`            | Expo CLI not installed   | `npm install -g @expo/cli`                       |
| TypeScript errors               | Code issues              | Run `cd desktop && npm run build` to see details |
| electron-builder fails          | Missing build tools      | Install Visual Studio Build Tools (Windows)      |

**Quick Fix:**

```bash
# Reinstall dependencies
cd desktop
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build

# Try again
cd ..
npm run desktop:dist:win
```

### 🔴 App Crashes on Startup

**Symptoms:**

- App opens briefly then closes
- No window appears
- Process exits immediately

**Diagnosis:**

1. Run from command line to see output
2. Check Windows Event Viewer (if on Windows)
3. Enable Electron logging

**Causes & Fixes:**

| Cause               | Check                       | Fix                                  |
| ------------------- | --------------------------- | ------------------------------------ |
| JavaScript error    | Console shows error         | Fix syntax error in main.ts          |
| Missing dependency  | Error: Cannot find module   | Install missing package              |
| Port conflict (dev) | Port 8081 already in use    | Kill other process or change port    |
| Uncaught exception  | Error in app initialization | Wrap in try-catch, add error logging |

**Debug Mode:**

```bash
# Run with console output (dev)
cd desktop
npm run dev

# Run packaged app with console
dist-desktop/win-unpacked/DnD-Toolkit.exe --enable-logging --trace-warnings
```

### 🔴 Auto-Update Not Working

**Symptoms:**

- App never checks for updates
- Update available but doesn't download
- Downloaded update doesn't install

**Diagnosis:**

1. Check if running in production (`isDev === false`)
2. Verify GitHub releases exist
3. Check auto-updater logs

**Causes & Fixes:**

| Cause               | Check                        | Fix                                           |
| ------------------- | ---------------------------- | --------------------------------------------- |
| Running in dev mode | `isDev === true`             | Auto-update disabled in dev (expected)        |
| No newer version    | Latest version is current    | Create new GitHub release with higher version |
| Feed URL wrong      | Check `setFeedURL()` config  | Verify owner/repo correct                     |
| Not signed          | Update fails signature check | Sign installers with code signing certificate |

**Manual Check:**

```javascript
// In main process
autoUpdater.checkForUpdates().then((result) => {
  console.log("Update check result:", result);
});

autoUpdater.on("update-available", (info) => {
  console.log("Update available:", info.version);
});

autoUpdater.on("error", (err) => {
  console.error("Update error:", err);
});
```

## Development Issues

### Hot Reload Not Working

**Fix:**

```bash
# Kill dev server
pkill -f "expo web"

# Kill Electron
pkill -f "electron"

# Restart
npm run web        # Terminal 1
npm run desktop:dev # Terminal 2
```

### DevTools Won't Open

**Fix:**

```javascript
// In main.ts, createWindow():
if (isDev) {
  mainWindow.webContents.openDevTools();
}

// Or press: Ctrl+Shift+I (Windows/Linux), Cmd+Option+I (macOS)

// Or run with flag:
dist-desktop/win-unpacked/DnD-Toolkit.exe --enable-devtools
```

### Changes Not Reflecting

**Possible causes:**

- Code cached by Metro bundler
- TypeScript not recompiled
- Old installer still running

**Fix:**

```bash
# Clear Metro cache
expo start -c

# Rebuild TypeScript
cd desktop && npm run build

# Clear electron-builder cache
rm -rf dist-desktop desktop/dist

# Rebuild everything
npm run desktop:dist:win
```

## Debugging Tools

### Enable Verbose Logging

**main.ts:**

```javascript
// Add at top
process.env.DEBUG = 'electron-updater';
process.env.ELECTRON_ENABLE_LOGGING = '1';

// Or run with flags
DnD-Toolkit.exe --enable-logging --trace-warnings --v=1
```

### Inspect Protocol Requests

**Add to setupProtocolHandler():**

```javascript
protocol.handle("app", (request) => {
  console.log("[Protocol] Request:", {
    url: request.url,
    method: request.method,
    headers: request.headers,
  });

  // ... existing handler code

  console.log("[Protocol] Response:", {
    status: 200,
    contentType: contentType,
    size: fileContent.length,
  });
});
```

### Monitor Window Events

**Add to createWindow():**

```javascript
mainWindow.on("resize", () =>
  console.log("Window resized:", mainWindow.getBounds()),
);
mainWindow.on("move", () =>
  console.log("Window moved:", mainWindow.getBounds()),
);
mainWindow.on("maximize", () => console.log("Window maximized"));
mainWindow.on("unmaximize", () => console.log("Window unmaximized"));
mainWindow.on("close", () => console.log("Window closing"));
```

### Check File System

**In main process:**

```javascript
const fs = require("fs");
const path = require("path");

// List web-build contents
const webBuildDir = path.join(app.getAppPath(), "..", "web-build");
console.log("Web build files:", fs.readdirSync(webBuildDir));

// Check specific file
const fontsPath = path.join(webBuildDir, "fonts.css");
console.log("fonts.css exists:", fs.existsSync(fontsPath));
console.log("fonts.css size:", fs.statSync(fontsPath).size);
```

## Performance Issues

### Slow Startup

**Diagnosis:**

```javascript
// Add timing logs
console.time("app-ready");
app.whenReady().then(() => {
  console.timeEnd("app-ready");
});

console.time("window-created");
createWindow();
console.timeEnd("window-created");

console.time("web-loaded");
mainWindow.webContents.on("did-finish-load", () => {
  console.timeEnd("web-loaded");
});
```

**Optimizations:**

- Lazy load fonts (don't load all at startup)
- Defer non-critical initialization
- Use `webPreferences.backgroundThrottling = false` sparingly
- Reduce bundle size (tree shaking, code splitting)

### High Memory Usage

**Check:**

```javascript
// In DevTools Console
performance.memory.usedJSHeapSize / 1024 / 1024 + " MB";

// In main process
process.memoryUsage();
```

**Common causes:**

- Memory leaks (event listeners not removed)
- Large images not released
- Too many cached items

**Fixes:**

- Use `LazyImage` component (already implemented)
- Implement LRU cache eviction (already implemented)
- Remove event listeners when components unmount
- Use `window.electronAPI.onThemeChange()` cleanup function (already fixed)

## Getting Help

### Information to Provide

When reporting issues:

1. **Electron version:** Check `Help → About` or `node_modules/electron/package.json`
2. **App version:** Check `Help → About`
3. **OS:** Windows 10/11, macOS version, Linux distro
4. **Steps to reproduce:** Exact sequence of actions
5. **Error messages:** Copy full error from console
6. **DevTools console:** Screenshot of Console and Network tabs
7. **Main process logs:** Copy terminal output

### Check Logs

**Main process logs:**

```bash
# Dev mode
cd desktop && npm run dev
# Output visible in terminal

# Packaged app
# Windows: Check Windows Event Viewer
# macOS: Check ~/Library/Logs/dnd-toolkit/
# Linux: Check ~/.config/dnd-toolkit/logs/
```

**Renderer logs:**

- Open DevTools: Ctrl+Shift+I
- Check Console tab
- Check Network tab for failed requests

### Useful Commands

```bash
# Verify build environment
cd desktop && bash scripts/check-prereqs.sh    # macOS/Linux
cd desktop && .\scripts\check-prereqs.ps1      # Windows

# Clean rebuild
npm run desktop:dist:win

# Run without installer
dist-desktop/win-unpacked/DnD-Toolkit.exe --enable-devtools

# Check Electron version
cd desktop && npm list electron

# Check Node version
node --version

# Check npm version
npm --version
```

## References

- [Electron Documentation](https://www.electronjs.org/docs/latest/)
- [Electron IPC Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Desktop Architecture Guide](./DESKTOP_ARCHITECTURE.md)
- [Desktop Audit Report](./DESKTOP_AUDIT_REPORT.md)
