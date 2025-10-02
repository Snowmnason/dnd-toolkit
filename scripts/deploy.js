#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting deployment to GitHub Pages...\n');

try {
  // Check if gh-pages is installed
  console.log('📦 Checking dependencies...');
  execSync('npm list gh-pages', { stdio: 'pipe' });
  console.log('✅ gh-pages is installed\n');

  // Build the web version
  console.log('🔨 Building web version...');
  execSync('expo export -p web', { stdio: 'inherit' });
  console.log('✅ Web build completed\n');

  // Check if dist folder exists
  const distPath = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distPath)) {
    throw new Error('❌ Dist folder not found. Build may have failed.');
  }

  // Deploy to GitHub Pages
  console.log('🌐 Deploying to GitHub Pages...');
  execSync('gh-pages -d dist', { stdio: 'inherit' });
  console.log('✅ Deployment completed successfully!\n');

  console.log('🎉 Your app should be available at:');
  console.log('   https://snowmnason.github.io/dnd-toolkit\n');
  console.log('📝 Note: It may take a few minutes for GitHub Pages to update.');

} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  
  if (error.message.includes('gh-pages')) {
    console.error('\n💡 Try running: npm install --save-dev gh-pages');
  }
  
  if (error.message.includes('expo export')) {
    console.error('\n💡 Make sure you have expo-cli installed globally or use npx expo export');
  }
  
  process.exit(1);
}