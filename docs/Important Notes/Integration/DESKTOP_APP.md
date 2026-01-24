# Desktop App Build Configuration

This document explains the critical configurations and modifications required for the Electron desktop app to function correctly.

## Overview

The desktop app packages the Expo web build into an Electron wrapper using a custom `app://` protocol. Several build steps and security configurations are required to make this work properly.

---

## Build Pipeline

The desktop build follows this pipeline:

1. **`expo export -p web`** - Export the React Native/Expo app as a web build to `dist/`
2. **`scripts/harden-web.js`** - Inject security headers and CSP into HTML files
3. **`scripts/fix-desktop-paths.js`** - Convert web paths to Electron `app://` protocol paths
4. **`scripts/strip-dev-appsettings.js`** - Remove development config from production build
5. **`electron-builder`** - Package the Electron app with web build included

### Build Commands

```bash
# Full desktop build for Windows
npm run predeploy:desktop  # Steps 1-4
cd desktop && npm run build && npm run dist:win  # Step 5

# Or run the installer from dist-desktop/
```

---

## Critical Configuration Changes

### 1. Content Security Policy (CSP) - `desktop/src/main.ts`

**Location:** `desktop/src/main.ts`, function `setupSessionSecurity()`, line ~277

**Critical Fix:**

```typescript
const csp =
  "default-src 'self' app:; script-src 'self' app: https://*.supabase.co 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' app: https://fonts.gstatic.com; img-src 'self' data: https: blob: app:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'; media-src 'self'; worker-src 'self' blob:";
```

**Why These Changes Are Required:**

#### ❌ Invalid Syntax: `app://` → ✅ Correct: `app:`

- **Problem:** CSP rejects `app://` as an invalid protocol source
- **Error:** `"The source list for Content Security Policy directive contains an invalid source: 'app://'. It will be ignored."`
- **Fix:** Use `app:` (no slashes) for custom protocols in CSP directives
- **Affected directives:** `default-src`, `script-src`, `font-src`, `img-src`

#### ✅ Required: `'unsafe-inline'` in `script-src`

- **Problem:** Without this, React/Expo bootstrap inline scripts are blocked
- **Impact:** Complete blank screen - app cannot initialize
- **Why needed:** Expo's web build includes inline initialization scripts that cannot be externalized
- **Security note:** While not ideal, necessary for Expo/React Native Web architecture

#### ✅ Required: `app:` in `font-src`

- **Problem:** Custom fonts loaded via `app://` protocol were blocked
- **Impact:** Font loading failures, console errors, fallback fonts used
- **Fix:** Added `app:` to `font-src` directive

#### ✅ Required: `app:` in `img-src`

- **Problem:** Local images (favicon, assets) loaded via `app://` were blocked
- **Impact:** Missing icons, broken images
- **Fix:** Added `app:` to `img-src` directive

---

### 2. Subresource Integrity (SRI) Removal - `scripts/fix-desktop-paths.js`

**Location:** `scripts/fix-desktop-paths.js`, line ~69-72

**Critical Addition:**

```javascript
// Remove integrity attributes since we're modifying paths
// SRI hashes are incompatible with Electron's custom protocol
content = content.replace(/\s+integrity="[^"]*"/g, "");
content = content.replace(/\s+crossorigin="anonymous"/g, "");
```

**Why This Is Required:**

#### The SRI Hash Mismatch Problem

1. **`harden-web.js`** computes SRI hashes for scripts like:

   ```html
   <script
     src="/_expo/static/js/web/index-571744e04560ea184440e27ed06dd824.js"
     integrity="sha384-bxd4EXe75n9cy3Dfzfb+ouvOGKa4YKeniL4Li/s8jv1Ubxpz8bt1YR7hfSOrB96S"
     crossorigin="anonymous"
   ></script>
   ```

2. **`fix-desktop-paths.js`** then modifies the path:

   ```html
   <script
     src="app://_expo/static/js/web/index-571744e04560ea184440e27ed06dd824.js"
     integrity="sha384-bxd4EXe75n9cy3Dfzfb+ouvOGKa4YKeniL4Li/s8jv1Ubxpz8bt1YR7hfSOrB96S"
     crossorigin="anonymous"
   ></script>
   ```

3. **Browser fails integrity check** because:
   - The integrity hash was computed for the file at the original path
   - The modified HTML with `app://` protocol changes the document structure
   - The hash no longer matches the modified HTML content
4. **Result:** Script blocked, blank screen

#### Error Message

```
Failed to find a valid digest in the 'integrity' attribute for resource
'app://_expo/static/js/web/index-571744e04560ea184440e27ed06dd824.js'
with computed SHA-384 integrity 'bxd4EXe75n9cy3Dfzfb+ouvOGKa4YKeniL4Li/s8jv1Ubxpz8bt1YR7hfSOrB96S'.
The resource has been blocked.
```

#### Solution

Remove all `integrity` and `crossorigin` attributes after path modifications. These are incompatible with:

- Custom protocol URLs (`app://`)
- Modified HTML content structure
- Local file system access in Electron

**Security Note:** SRI is unnecessary for local bundled files since they're:

- Packaged with the app
- Not loaded from external CDNs
- Protected by Electron's sandboxing and CSP

---

### 3. Path Protocol Conversion - `scripts/fix-desktop-paths.js`

**What It Does:**
Converts web-style absolute paths to Electron's custom `app://` protocol:

```javascript
// HTML files
content = content.replace(/href="\/_expo\//g, 'href="app://_expo/');
content = content.replace(/src="\/_expo\//g, 'src="app://_expo/');
content = content.replace(/href="\/assets\//g, 'href="app://assets/');
content = content.replace(/src="\/assets\//g, 'src="app://assets/');
content = content.replace(/href="\/favicon/g, 'href="app://favicon');

// JavaScript bundles
content = content.replace(/"\/_expo\//g, '"app://_expo/');
content = content.replace(/'\/_expo\//g, "'app://_expo/");
content = content.replace(/`\/_expo\//g, "`app://_expo/");
```

**Why Required:**

- Web builds use absolute paths like `/_expo/static/js/...`
- These don't work with `file://` protocol or Electron's resource loading
- Custom `app://` protocol (registered in `main.ts`) provides:
  - Consistent resource loading across platforms
  - Security through CSP enforcement
  - Proper CORS handling for web APIs

---

### 4. Custom Protocol Registration - `desktop/src/main.ts`

**Location:** Line ~17-27

```typescript
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
```

**Why Required:**

- Registers `app://` as a privileged protocol before Electron initializes
- Enables web APIs (fetch, CORS) to work with local files
- Required for React Native Web's network requests and resource loading

---

## Testing the Desktop Build

### Development Testing

```bash
cd desktop
npm run dev
```

Loads from `http://localhost:8081` (requires main dev server running)

### Production Testing

```bash
# From dist-desktop/win-unpacked/
DnD-Toolkit.exe --enable-devtools
```

The `--enable-devtools` flag:

- Opens DevTools in production builds
- Essential for debugging CSP errors
- Shows console errors that would otherwise be invisible
- Use for troubleshooting build issues

### Common Issues

#### Blank Screen

**Symptoms:** App launches but shows blank white screen
**Causes:**

1. CSP blocking scripts (`app://` syntax error)
2. SRI hash mismatch blocking resources
3. Path conversion failed

**Debug:** Launch with `--enable-devtools` and check Console for CSP/SRI errors

#### Font Loading Failures

**Symptoms:** Console errors about blocked font resources
**Cause:** Missing `app:` in `font-src` CSP directive
**Fix:** Ensure CSP includes `font-src 'self' app: https://fonts.gstatic.com`

#### Image/Asset Loading Failures

**Symptoms:** Missing images, broken icons
**Cause:** Missing `app:` in `img-src` CSP directive or incorrect path conversion
**Fix:** Ensure CSP includes `img-src 'self' data: https: blob: app:`

---

## Security Considerations

### CSP with `'unsafe-inline'`

While not ideal, `'unsafe-inline'` in `script-src` is required because:

- Expo's web build architecture relies on inline scripts
- Cannot be externalized without breaking the app
- Acceptable risk since:
  - All code is bundled locally
  - No external script injection possible
  - Protected by Electron's sandbox

### Removed SRI

SRI is unnecessary for desktop builds because:

- All resources are bundled with the app
- No CDN or external resource loading
- Protected by Electron's process isolation
- CSP provides sufficient protection for local resources

### Custom Protocol Security

The `app://` protocol is secure because:

- Registered with `secure: true` privilege
- CSP restricts what can be loaded
- Cannot be accessed from external pages
- Sandboxed by Electron's security model

---

## Build Output

After successful build, `dist-desktop/` contains:

- `DnD-Toolkit-{version}-installer.exe` - NSIS installer
- `win-unpacked/` - Unpacked application files (for testing)
- `latest.yml` - Auto-updater metadata
- `builder-*.yml` - Build configuration snapshots

**The entire `dist-desktop/` folder is safe to delete** - it's regenerated on each build.

---

## Related Files

- [`desktop/src/main.ts`](../../desktop/src/main.ts) - Main Electron process, CSP configuration
- [`scripts/fix-desktop-paths.js`](../../scripts/fix-desktop-paths.js) - Path conversion and SRI removal
- [`scripts/harden-web.js`](../../scripts/harden-web.js) - Security headers and SRI injection (before path fixing)
- [`desktop/electron-builder.json`](../../desktop/electron-builder.json) - Electron Builder configuration
- [`package.json`](../../package.json) - Build scripts (`predeploy:desktop`)

---

## Version History

### 2026-01-15: CSP and SRI Fixes

- Fixed CSP protocol syntax (`app://` → `app:`)
- Added `'unsafe-inline'` to `script-src` for Expo compatibility
- Added `app:` to `font-src` and `img-src` for local resource loading
- Implemented SRI attribute removal in path fixing script
- Fixed blank screen issue in production builds
- Resolved "Failed to find a valid digest" error

---

## Important Notes

⚠️ **Do not reorder build steps** - The order is critical:

1. Export must happen first
2. Security hardening before path fixing
3. Path fixing must remove SRI after harden-web adds it
4. Electron build must be last

⚠️ **Always test with `--enable-devtools`** - Production builds hide errors that are critical for debugging

⚠️ **CSP changes require app rebuild** - Changing CSP in `main.ts` requires recompiling TypeScript and repackaging the app

⚠️ **Path conversion is irreversible** - The `fix-desktop-paths.js` script modifies `dist/` permanently. Re-run `expo export` to regenerate clean web files.
