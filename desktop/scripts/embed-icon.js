#!/usr/bin/env node

/**
 * Script to embed icon into Windows executable using rcedit
 * Runs after electron-builder creates the exe
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

module.exports = async () => {
  const DIST_DIR = path.join(__dirname, '..', '..', 'dist-desktop', 'win-unpacked');
  const EXE_PATH = path.join(DIST_DIR, 'DnD-Toolkit.exe');
  const ICON_PATH = path.join(__dirname, '..', 'assets', 'images', 'icon.ico');
  const RCEDIT_PATH = path.join(__dirname, '..', 'node_modules', 'rcedit', 'bin', 'rcedit.exe');

  if (!fs.existsSync(EXE_PATH)) {
    console.warn(`[embed-icon] Exe not found at ${EXE_PATH}`);
    return;
  }

  if (!fs.existsSync(ICON_PATH)) {
    console.warn(`[embed-icon] Icon not found at ${ICON_PATH}`);
    return;
  }

  if (!fs.existsSync(RCEDIT_PATH)) {
    console.warn(`[embed-icon] rcedit not found at ${RCEDIT_PATH}`);
    return;
  }

  try {
    console.log('[embed-icon] Embedding icon into executable...');
    
    execSync(`"${RCEDIT_PATH}" "${EXE_PATH}" --set-icon "${ICON_PATH}"`, {
      stdio: 'inherit',
      shell: true
    });

    console.log('[embed-icon] ✓ Icon embedded successfully!');
  } catch (error) {
    console.warn('[embed-icon] Warning: Could not embed icon');
    console.warn('[embed-icon] Error:', error.message);
  }
};
