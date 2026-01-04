#!/usr/bin/env node

/**
 * Clean Build Artifacts
 * 
 * Removes build artifacts and cache to save disk space:
 * - dist-desktop/ (Electron builds)
 * - dist/ (Web export)
 * - node_modules/ (dependencies)
 * - TypeScript cache
 * 
 * Usage:
 *   npm run clean              # Clean all
 *   npm run clean:desktop      # Clean only desktop builds
 *   npm run clean:web          # Clean only web builds
 *   npm run clean:deps         # Clean only dependencies
 *   npm run clean:cache        # Clean only cache files
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get the directory of this script
const __dirname = path.dirname(require.main.filename);

// Get command line args
const args = process.argv.slice(2);
const target = args[0] || 'all';
const projectRoot = path.resolve(__dirname, '..');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function deleteDir(dirPath, name) {
  if (fs.existsSync(dirPath)) {
    try {
      execSync(`rm -rf "${dirPath}"`, { stdio: 'ignore' });
      log(`✓ Removed ${name}`, 'green');
      return true;
    } catch (error) {
      log(`✗ Failed to remove ${name}`, 'red');
      return false;
    }
  } else {
    log(`- ${name} not found (skipped)`, 'yellow');
    return false;
  }
}

function cleanDesktop() {
  log('\n📦 Cleaning Desktop Builds...', 'yellow');
  deleteDir(path.join(projectRoot, 'dist-desktop'), 'Desktop builds (dist-desktop/)');
  deleteDir(path.join(projectRoot, 'desktop', 'dist'), 'Desktop TypeScript output (desktop/dist/)');
}

function cleanWeb() {
  log('\n🌐 Cleaning Web Builds...', 'yellow');
  deleteDir(path.join(projectRoot, 'dist'), 'Web export (dist/)');
}

function cleanDeps() {
  log('\n📚 Cleaning Dependencies...', 'yellow');
  deleteDir(path.join(projectRoot, 'node_modules'), 'Root dependencies (node_modules/)');
  deleteDir(path.join(projectRoot, 'desktop', 'node_modules'), 'Desktop dependencies (desktop/node_modules/)');
}

function cleanCache() {
  log('\n⚙️  Cleaning Cache Files...', 'yellow');
  deleteDir(path.join(projectRoot, '.next'), 'Next.js cache (.next/)');
  deleteDir(path.join(projectRoot, '.expo'), 'Expo cache (.expo/)');
  
  // TypeScript cache
  const tsFiles = [
    path.join(projectRoot, '*.tsbuildinfo'),
    path.join(projectRoot, 'desktop', '*.tsbuildinfo'),
  ];
  
  tsFiles.forEach(pattern => {
    if (fs.existsSync(pattern)) {
      try {
        execSync(`rm -f ${pattern}`, { stdio: 'ignore' });
        log(`✓ Removed TypeScript cache (${pattern})`, 'green');
      } catch (error) {
        // Ignore
      }
    }
  });
}

function cleanAll() {
  log('🧹 DnD Toolkit - Clean Build Artifacts\n', 'yellow');
  cleanWeb();
  cleanDesktop();
  cleanDeps();
  cleanCache();
  log('\n✨ Cleanup complete!', 'green');
}

// Run based on target
switch (target) {
  case 'desktop':
    cleanDesktop();
    break;
  case 'web':
    cleanWeb();
    break;
  case 'deps':
    cleanDeps();
    break;
  case 'cache':
    cleanCache();
    break;
  case 'all':
  case undefined:
    cleanAll();
    break;
  default:
    log(`Unknown target: ${target}`, 'red');
    log('\nUsage:', 'yellow');
    log('  npm run clean              # Clean all');
    log('  npm run clean:desktop      # Clean desktop builds');
    log('  npm run clean:web          # Clean web builds');
    log('  npm run clean:deps         # Clean dependencies');
    log('  npm run clean:cache        # Clean cache files');
    process.exit(1);
}
