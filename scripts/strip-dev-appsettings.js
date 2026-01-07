/* eslint-env node */
const fs = require('fs');
const path = require('path');

/**
 * Remove appsettings.dev.json from build outputs to prevent shipping dev config.
 * Safe to run multiple times; ignores missing files.
 */
const repoRoot = path.resolve(process.cwd());

const targets = [
  path.join(repoRoot, 'dist', 'config', 'appsettings.dev.json'),
  path.join(repoRoot, 'dist', 'appsettings.dev.json'),
  // Desktop packaging uses the exported web bundle under desktop/dist or desktop/app
  path.join(repoRoot, 'desktop', 'dist', 'config', 'appsettings.dev.json'),
  path.join(repoRoot, 'desktop', 'dist', 'appsettings.dev.json'),
];

for (const target of targets) {
  try {
    if (fs.existsSync(target)) {
      fs.rmSync(target, { force: true });
      console.log(`[strip-dev-appsettings] Removed ${target}`);
    }
  } catch (err) {
    console.warn(`[strip-dev-appsettings] Failed to remove ${target}:`, err);
  }
}
