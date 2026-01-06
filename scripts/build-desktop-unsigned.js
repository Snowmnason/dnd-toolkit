#!/usr/bin/env node

/**
 * Build unsigned desktop installers for local development/testing
 * This bypasses code signing which requires admin privileges on Windows
 */

import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const configPath = path.join(__dirname, '../desktop/electron-builder.json');

console.log('📦 Building unsigned desktop installers for local testing...\n');

// Read the original config
const originalConfigContent = fs.readFileSync(configPath, 'utf8');
const originalConfig = JSON.parse(originalConfigContent);

// Create unsigned config by removing signing-related fields
const unsignedConfig = {
  ...originalConfig,
  win: {
    ...originalConfig.win,
    certificateFile: null,
    certificatePassword: null,
    publisherName: null, // Remove publisherName to avoid signing
    signingHashAlgorithms: [],
    sign: null // Explicitly disable signing
  }
};

// Write temporary config
fs.writeFileSync(configPath, JSON.stringify(unsignedConfig, null, 2));
console.log('✓ Temporary config written (signing disabled)\n');

try {
  // Run the build with environment variables to disable signing
  const platform = process.argv[2] || 'win';
  const buildCmd = `npm run dist:${platform}`;
  
  console.log(`▶ Running: ${buildCmd}`);
  
  // Set environment variables to disable code signing
  const env = {
    ...process.env,
    CSC_KEY_PASSWORD: '',  // Empty password disables signing
    WIN_CSC_LINK: '',      // Empty link disables Windows signing
    WIN_CSC_KEY_PASSWORD: '', // Empty password disables Windows signing
    SKIP_SIGNING: '1'      // Custom flag (may be used in config)
  };
  
  execSync(buildCmd, { 
    cwd: path.join(__dirname, '../desktop'),
    stdio: 'inherit',
    env
  });
  
  console.log('\n✓ Build completed successfully!');
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
} finally {
  // Restore original config
  const originalConfigJson = JSON.stringify(originalConfig, null, 2);
  fs.writeFileSync(configPath, originalConfigJson);
  console.log('✓ Original config restored');
}
