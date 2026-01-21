# Desktop App Blank Screen Fix - Complete Guide

**Date:** January 21, 2026  
**Version:** 1.25.26  
**Status:** ✅ RESOLVED

## Problem

The desktop app (Electron-based) was displaying a blank screen on startup. Despite the window rendering (visible theme colors), no content was shown. The issue was a routing failure resulting in the "Unmatched Route" error page.

## Root Cause Analysis

The problem had **multiple layers**:

1. **Logger System Blocking** - Async logger was writing to disk after initial logs, causing the file to appear empty
2. **Auto-updater Timeout** - Blocking 5+ seconds on startup with no configured publish server
3. **Protocol Handling** - Custom `app://` protocol handler was failing for initial page load in Electron 33.4.11
4. **CSP Policy** - Electron's `file://` protocol ignores Content Security Policy meta tags (system-level enforcement)
5. **Base Tag Issues** - The base tag for redirecting relative paths to `app://` was being blocked by overly restrictive CSP directives

## The Solution

### Architecture

```
Browser window loads via: app://index.html
                    ↓
        Protocol handler receives request
                    ↓
      Resolves to disk file: /resources/web-build/index.html
                    ↓
        File has injected CSP + base tag
                    ↓
        Browser respects CSP meta tag (because app:// protocol is trusted)
                    ↓
        Base tag redirects relative assets to app://
                    ↓
        Assets load from /resources/web-build (via protocol handler)
```

### Key Changes

#### 1. Protocol Handler Normalization (`src/main.ts`, lines 510-520)

**Problem:** Electron was appending trailing slashes to URLs (`app://index.html/`), breaking file resolution.

**Solution:** Normalize trailing slashes before path resolution:

```typescript
// Remove trailing slashes FIRST
filePath = filePath.replace(/\/+$/, "");
```

This ensures `app://index.html/` → `index.html` (not `index.html\` on Windows).

#### 2. Runtime CSP + Base Tag Injection (`src/main.ts`, lines 1045-1095)

**Problem:**

- `file://` protocol ignores CSP meta tags in Electron
- Original HTML had `base-uri 'self'`, blocking `app://` base href
- Modifying the pre-built web-build index.html was the only way to make it work

**Solution:** At window load time (before loading), inject:

- `<base href="app://">` in the `<head>`
- Permissive CSP meta tag at the start of `<head>` (takes precedence)

**Key Details:**

- The CSP injection includes all necessary domains:
  - `app:` for local assets
  - `https://*.supabase.co` for backend
  - `https://dnd-tool.thesnowpost.com` for domain resources
  - Includes `wss://` for WebSocket connections
- Detection marker `<!-- DESKTOP_CSP_INJECTED -->` prevents redundant rewrites on every startup
- Error handling catches write failures without crashing

#### 3. Disabled Auto-updater (`src/main.ts`, lines 854-863)

**Problem:** `checkForUpdatesAndNotify()` was timing out because no publish server was configured.

**Solution:** Disabled auto-updater. To enable in future, configure `publish` server in `electron-builder.json`.

#### 4. Logger System (`src/main.ts`, lines 50-67)

**Problem:** Async logger was opening write stream after initial logs, file appeared empty.

**Solution:** Replaced with synchronous logger using `fs.appendFileSync()` via `logger-simple.ts`.

## How It Works (Technical Deep Dive)

### Why Not Use `app://` Directly?

In Electron 33.4.11, loading `app://` as the root fails with `ERR_INVALID_URL`. The protocol handler callback system works best when:

1. It's called for a valid file path (not just a domain)
2. The protocol returns an actual file path via `callback({ path: resolvedPath })`

### Why Not Use `file://`?

`file://` protocol in Electron is sandboxed and **enforces system-level CSP policies** that cannot be overridden by meta tags in the HTML. This is by design for security.

### Why Inject CSP at Runtime?

The pre-built `index.html` is minified and has a restrictive CSP. We can't modify the source before build. Runtime injection ensures:

- The injected CSP is evaluated FIRST (takes precedence)
- It's specific to the desktop environment
- It doesn't affect web builds

## If This Breaks Again (Troubleshooting)

### Symptom: "Unmatched Route" Error

**Check:**

1. **Logs location:** `C:\Users\{user}\AppData\Roaming\dnd-toolkit\app.log`
2. **Look for CSP errors:**
   - `Refused to set the document's base URI` → CSP injection failed
   - `Refused to load stylesheet 'app://...'` → Missing `style-src app:` in CSP
   - `Refused to connect to ...supabase.co` → Missing `connect-src` domains

**Fix:**

- Update CSP in `main.ts` lines 1072-1073 to include the missing directive
- Check that protocol handler is returning 200 (see `[Protocol] ✅ SUCCESS` in logs)

### Symptom: Protocol Handler Not Called

**Check:**

1. Is `registerFileProtocol` successfully registered? Look for `[Protocol] ✅ Handler registered successfully`
2. Is `globalResolvedRoot` pointing to correct path? Should be `.../web-build`

**Fix:**

- Ensure `web-build` folder exists and contains `index.html`
- Check `[Protocol] Setup` log shows correct paths

### Symptom: File Write Error

**Check:**

1. Is `index.html` locked by another process?
2. Is the file read-only?

**Fix:**

- The app will continue with the old HTML (see `catch` at line 1087)
- Check Windows resource monitor for file locks
- Ensure app has write permissions to resources folder

## Files Modified

1. **`desktop/src/main.ts`** (1302 lines)
   - Lines 510-520: Trailing slash normalization in protocol handler
   - Lines 1045-1095: CSP + base tag injection logic
   - Lines 854-863: Auto-updater disabled

2. **`desktop/src/logger-simple.ts`** (Added)
   - Synchronous file-based logging

## Prevention for Future

1. **Test on Package** - Always test the final built app, not just dev server
2. **Monitor CSP Errors** - The logs clearly show CSP violations; don't ignore them
3. **Protocol Handler Tests** - Verify protocol handler is being called for key assets
4. **Version Desktop App** - Keep electron-builder.json version in sync

## Related Files

- `desktop/electron-builder.json` - Build configuration
- `desktop/src/preload.ts` - IPC bridge
- `dist/index.html` - Source HTML (before desktop modifications)

## Rollback Plan

If the solution needs to be reverted:

```bash
# Revert to using file:// protocol
# Change line 1094: window.loadURL("app://index.html");
# To: window.loadURL("file:///" + indexPath.replace(/\\/g, "/"));

# Remove CSP injection (lines 1067-1087)
# This will fail on new installs, but old installs might still work if file:// is cached
```

However, **this is not recommended**. The current solution is the only reliable approach for Electron 33+.

## Key Takeaways

- **Electron 33.4.11** doesn't properly support custom protocols for initial page load
- **`file://` ignores HTML CSP meta tags** - it's a security feature
- **Runtime HTML injection** is necessary to overcome these limitations
- **CSP meta tags must be first in `<head>`** to take precedence over document directives
- **Logging is critical** - the solution was found by carefully reading error logs

---

**If you encounter issues, check `app.log` first. The answer is almost always in the CSP violations or protocol handler logs.**
