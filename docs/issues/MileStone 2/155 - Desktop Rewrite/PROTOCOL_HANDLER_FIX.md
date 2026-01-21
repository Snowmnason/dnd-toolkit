# Desktop App Protocol Handler Fix

## The Problem

The desktop app was showing a blank screen on startup because the `app://` custom protocol handler was never being invoked.

### Root Causes

1. **Incorrect URL Load**: The window was loading `app://` but the protocol handler needs an explicit path like `app://index.html`
2. **Auto-updater Unhandled Rejection**: The auto-updater's promise rejection was causing silent failures that prevented proper initialization

## The Solution

### 1. Load Explicit Path (CRITICAL FIX)

Change in [desktop/src/main.ts](desktop/src/main.ts):

```typescript
// BEFORE (broken)
mainWindow.loadURL("app://");

// AFTER (working)
mainWindow.loadURL("app://index.html");
```

**Why this works:**
- Electron requires an explicit file path for custom protocol handlers to invoke
- Loading just `app://` bypasses the protocol handler entirely
- Loading `app://index.html` triggers the handler, which then injects the base tag and serves the file

### 2. Use Global Protocol Object

```typescript
// BEFORE (doesn't work with Electron 33)
session.defaultSession.protocol.handle("app", handler);

// AFTER (works correctly)
protocol.handle("app", handler);
```

### 3. Handle Auto-updater Errors Gracefully

The auto-updater was throwing unhandled promise rejections when no GitHub releases existed:

```typescript
// Added proper error handling
autoUpdater.checkForUpdatesAndNotify().catch((error: Error) => {
  console.warn("[Auto-updater] Update check failed (non-fatal):", error.message);
});
```

## Verification

After the fix, you should see in the logs:

```
[Protocol] ===== INCOMING REQUEST =====
[Protocol] Full URL: app://index.html/
[Protocol] ✅ Loaded: C:\...\index.html
[Window] ready-to-show event fired
```

If you see these logs, the protocol handler is working and the app will display correctly.

## Files Modified

- [desktop/src/main.ts](desktop/src/main.ts) - Protocol handler URL and setup
- [desktop/src/main.ts](desktop/src/main.ts) - Auto-updater error handling
