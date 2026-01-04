# DnD Toolkit Desktop

Electron wrapper for the DnD Toolkit web application, providing native desktop apps for Windows, macOS, and Linux.

## For Users: Download

**No build required!** Download the latest installer for your platform from [GitHub Releases](https://github.com/thesnowpost/dnd-toolkit/releases).

| Platform | File | Notes |
|----------|------|-------|
| Windows | `.exe` | NSIS installer, also portable version available |
| macOS | `.dmg` | Drag to Applications (Intel & Apple Silicon) |
| Linux | `.AppImage` | Run directly, or use `.deb` for Debian/Ubuntu |

The app auto-updates when new versions are released.

---

## For Developers

### How It Works

This Electron app wraps the React Native web export, loading it in a native window. This approach:
- Reuses 100% of the web codebase
- Provides native window controls and menus
- Enables offline usage (once loaded)
- Supports auto-updates via GitHub releases

### Check Prerequisites

Run the prereq checker to verify your system is ready:

**macOS/Linux:**
```bash
bash desktop/scripts/check-prereqs.sh
```

**Windows (PowerShell):**
```powershell
.\desktop\scripts\check-prereqs.ps1
```

### Prerequisites

1. Build the web export first from the root directory:
   ```bash
   npm run predeploy
   ```

2. Install desktop dependencies:
   ```bash
   cd desktop
   npm install
   ```

## Development

Run in development mode (connects to Expo dev server):
```bash
# From root directory - start Expo web server first
npm run web

# Then in another terminal, from root directory
npm run desktop:dev
```

Or directly from the desktop folder:
```bash
npm run dev
```

## Building for Distribution

### Build for Current Platform
```bash
npm run desktop:dist
```

### Build for Specific Platforms
```bash
npm run desktop:dist:win     # Windows (.exe installer + portable)
npm run desktop:dist:mac     # macOS (.dmg + .zip)
npm run desktop:dist:linux   # Linux (.AppImage + .deb)
npm run desktop:dist:all     # All platforms
```

### Output

Built apps are placed in `dist-desktop/` folder at the project root:
- **Windows**: `DnD Toolkit-{version}-win-x64.exe` (installer), `.portable.exe`
- **macOS**: `DnD Toolkit-{version}-mac-{arch}.dmg`, `.zip`
- **Linux**: `DnD Toolkit-{version}-linux-x64.AppImage`, `.deb`

## Project Structure

```
desktop/
├── src/
│   ├── main.ts       # Main process - creates window, handles lifecycle
│   └── preload.ts    # Preload script - secure bridge to renderer
├── assets/           # Desktop-specific icons (ICO, ICNS)
├── dist/             # Compiled TypeScript output
├── electron-builder.json  # Build configuration
├── entitlements.mac.plist # macOS security entitlements
├── package.json
└── tsconfig.json
```

## Code Signing (Production)

For production releases, you'll need to set up code signing:

### Windows
Set environment variables:
- `CSC_LINK` - Path to code signing certificate
- `CSC_KEY_PASSWORD` - Certificate password

### macOS
Set environment variables:
- `CSC_LINK` - Path to .p12 certificate
- `CSC_KEY_PASSWORD` - Certificate password
- `APPLE_ID` - Your Apple ID
- `APPLE_ID_PASSWORD` - App-specific password
- `APPLE_TEAM_ID` - Your team ID

## Auto Updates

The app is configured to publish to GitHub releases. Once you create a GitHub release with the built assets, the app will automatically check for and install updates.

## Troubleshooting

### App shows blank window
Make sure you've built the web export first: `npm run predeploy`

### Can't connect to dev server
Ensure Expo web is running: `npm run web` (from root directory)

### Build fails on macOS
Install Xcode Command Line Tools:
```bash
xcode-select --install
```

### Build fails on Windows
Install Visual Studio Build Tools with "Desktop development with C++" workload:
1. Download from https://visualstudio.microsoft.com/visual-cpp-build-tools/
2. Run installer and select "Desktop development with C++"
3. Restart your terminal

### Build fails on Linux
Install build essentials:
```bash
# Debian/Ubuntu
sudo apt install build-essential

# Fedora
sudo dnf groupinstall 'Development Tools'
```

---

## CI/CD: Automated Builds

This repo includes a GitHub Actions workflow (`.github/workflows/desktop-release.yml`) that:
- Builds Windows, macOS, and Linux installers in parallel
- Uploads artifacts for download
- Can publish to GitHub Releases (when enabled)

**To trigger a build manually:**
1. Go to Actions → "Desktop Release" workflow
2. Click "Run workflow"
3. Download artifacts from the completed run

**To enable auto-publish on tags:**
1. Uncomment the `push: tags` trigger in the workflow
2. Add any required secrets (code signing certs, etc.)
3. Push a version tag: `git tag v1.0.0 && git push --tags`
