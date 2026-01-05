# Release Management Guide

This document outlines the process for releasing new versions of DnD Toolkit across all platforms (web, desktop, iOS, Android).

---

## Table of Contents

1. [Versioning](#versioning)
2. [Release Checklist](#release-checklist)
3. [Web Release](#web-release)
4. [Desktop Release](#desktop-release)
5. [Mobile Release](#mobile-release)
6. [Publishing Updates](#publishing-updates)

---

## Versioning

We follow [Semantic Versioning](https://semver.org/) (MAJOR.MINOR.PATCH):

- **MAJOR** (v1.0.0 → v2.0.0): Breaking changes, significant features
- **MINOR** (v1.0.0 → v1.1.0): New features, backwards compatible
- **PATCH** (v1.0.0 → v1.0.1): Bug fixes, small improvements

### Update Version

All versions are stored in `package.json` at the root:

```json
{
  "version": "1.0.0"
}
```

The version automatically syncs to:
- `lib/version.ts` (used by version display)
- Desktop app (via electron-builder)
- Mobile builds (via EAS)

**To bump version:**

```bash
# Edit package.json version
# Example: 1.0.0 → 1.1.0
```

---

## Release Checklist

Before releasing, verify:

- [ ] All features/fixes are merged to `main`
- [ ] Tests pass: `npm run lint`
- [ ] Web builds successfully: `npm run predeploy`
- [ ] Desktop builds successfully: `npm run desktop:dist:all`
- [ ] Changelog is updated
- [ ] Version is bumped in `package.json`
- [ ] No console errors in dev mode

---

## Web Release

The web version is deployed to GitHub Pages automatically when you push to `main`.

### Manual Deploy

If needed, manually deploy:

```bash
# Build the web export
npm run predeploy

# Deploy to GitHub Pages (main branch)
npm run deploy

# Deploy to preview branch (optional)
npm run deploy-dev
```

**Deployed to:** `https://dnd-tool.thesnowpost.com/`

---

## Desktop Release

Desktop releases are built and published via GitHub Actions. Two methods:

### Method 1: Automatic via Git Tag (Recommended)

1. **Bump version** in `package.json`
2. **Commit and push:**
   ```bash
   git add package.json
   git commit -m "chore: bump version to 1.1.0"
   git push origin main
   ```
3. **Create a release tag:**
   ```bash
   git tag -a v1.1.0 -m "Release version 1.1.0"
   git push origin v1.1.0
   ```
4. **GitHub Actions will automatically:**
   - Build Windows, macOS, and Linux installers
   - Create a GitHub Release with the artifacts
   - Publish release notes

### Method 2: Manual Dispatch via GitHub UI

1. Go to **GitHub Actions** → **Desktop Release** workflow
2. Click **Run workflow**
3. Select **Publish: true**
4. Click **Run workflow**

This will build all platforms and create a draft release.

### Method 3: Local Build

If you need to build locally without publishing:

```bash
# Windows only
npm run desktop:dist:win

# macOS only
npm run desktop:dist:mac

# Linux only
npm run desktop:dist:linux

# All platforms
npm run desktop:dist:all
```

Artifacts are in `dist-desktop/`:
- `DnD-Toolkit-*.exe` (Windows)
- `DnD-Toolkit-*.dmg` (macOS)
- `DnD-Toolkit-*.AppImage` (Linux)

### Desktop Auto-Updates

When users launch the desktop app, it automatically checks for updates:

- New versions are downloaded in the background
- Users are notified when ready to install
- Update is applied on next app restart
- Updates are pulled from GitHub Releases

**Note:** Code signing is disabled in development. Enable for production with certificates.

---

## Mobile Release

### iOS Release

**Prerequisites:**
- Apple Developer account
- Provisioning profiles set up in Xcode

**Build and submit:**

```bash
# Build for iOS
npm run build:ios

# Submit to App Store
npm run submit:ios
```

**Manual steps:**
1. Wait for EAS to complete the build
2. Download the `.ipa` file
3. Use Transporter or Xcode to submit to App Store
4. Complete App Store review

### Android Release

**Prerequisites:**
- Google Play Developer account
- Signed keystore file

**Build and submit:**

```bash
# Build for Android
npm run build:android

# Submit to Play Store
npm run submit:android
```

**Manual steps:**
1. Wait for EAS to complete the build
2. Download the `.aab` file
3. Upload to Google Play Console
4. Complete Google Play review

---

## Publishing Updates

### Create Release Notes

After publishing, update the GitHub Release with:

1. **Description:** What's new in this version
2. **Breaking Changes:** List any breaking changes
3. **Contributors:** Thank contributors
4. **Known Issues:** List any known issues

**Format example:**

```markdown
## v1.1.0 - Campaign Features

### New Features
- Add campaign management system
- Support for custom NPC creation
- Improved character sheet UI

### Bug Fixes
- Fixed login redirect issue
- Corrected spell damage calculations

### Contributors
- @Snowmnason
- @ContributorName

### Known Issues
- macOS Monterey: Occasional window resize lag (WIP)
```

### Update Changelog

Keep a `CHANGELOG.md` at the root:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-01-15

### Added
- Campaign management system
- Custom NPC creation

### Fixed
- Login redirect issue

### Changed
- Improved character sheet UI

## [1.0.0] - 2025-12-01

### Added
- Initial release
- Web and desktop versions
```

---

## Monitoring Releases

### Desktop Auto-Update Status

Monitor in `electron-builder.json`:

```json
{
  "publish": {
    "provider": "github",
    "owner": "thesnowpost",
    "repo": "dnd-toolkit",
    "releaseType": "release"
  }
}
```

- **releaseType: "release"** → Only published releases (recommended)
- **releaseType: "draft"** → Include draft releases
- **releaseType: "prerelease"** → Include pre-releases

### Track Updates

Users can see their desktop app version in-app via the version display component.

---

## Troubleshooting

### Desktop build fails locally

```bash
# Clean and rebuild
rm -rf dist-desktop/
npm run desktop:dist:win
```

### Auto-updater not working

1. Verify `publish` section in `electron-builder.json`
2. Ensure release is published (not draft)
3. Check internet connection
4. Verify version bump in `package.json`

### Mobile build stuck

Check EAS build logs:

```bash
# View build logs
npm run build:ios -- --wait

npm run build:android -- --wait
```

---

## Quick Reference

| Platform | Command | Output |
|----------|---------|--------|
| Web | `npm run predeploy` | `dist/` |
| Web (Deploy) | `npm run deploy` | GitHub Pages |
| Desktop (Win) | `npm run desktop:dist:win` | `dist-desktop/*.exe` |
| Desktop (Mac) | `npm run desktop:dist:mac` | `dist-desktop/*.dmg` |
| Desktop (Linux) | `npm run desktop:dist:linux` | `dist-desktop/*.AppImage` |
| Desktop (All) | `npm run desktop:dist:all` | All installers |
| iOS | `npm run build:ios` | EAS build |
| Android | `npm run build:android` | EAS build |
| Submit iOS | `npm run submit:ios` | App Store |
| Submit Android | `npm run submit:android` | Play Store |

---

## Next Steps

- [ ] Set up code signing for desktop (optional, required for production)
- [ ] Configure App Store and Play Store accounts
- [ ] Create privacy policy and terms of service
- [ ] Set up error tracking (Sentry)
- [ ] Create user feedback/bug report form
