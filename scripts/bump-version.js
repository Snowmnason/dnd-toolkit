#!/usr/bin/env node

/**
 * Interactive version bump helper
 * 
 * Flow:
 * 1. User runs: npm run version:bump
 * 2. Prompts: "What type of change? (breaking/feature/bugfix)"
 * 3. Bumps version in package.json, app.json, and desktop/package.json:
 *    - breaking -> major (X.0.0)
 *    - feature -> minor (x.X.0)
 *    - bugfix -> patch (x.x.X)
 * 4. Updates package-lock.json and desktop/package-lock.json to keep them in sync
 * 5. Commits with message: "chore(release): bump version to X.Y.Z (breaking/feature/bugfix)"
 * 6. User then manually runs: git tag vX.Y.Z && git push origin vX.Y.Z
 *    Any vX.Y.Z tag triggers desktop-release.yml to build and upload installers.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// Define __dirname for CommonJS compatibility
const __dirname = path.dirname(require.main.filename);

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const appJsonPath = path.join(__dirname, '..', 'app.json');
const desktopPackageJsonPath = path.join(__dirname, '..', 'desktop', 'package.json');

// Validate version format (semver: major.minor.patch)
const validateVersion = (version) => {
  const semverRegex = /^\d+\.\d+\.\d+$/;
  if (!semverRegex.test(version)) {
    throw new Error(`Invalid version format: ${version}. Expected format: major.minor.patch (e.g., 1.2.3)`);
  }
  return true;
};

// Validate that required files exist
const validateFileExists = (filePath, fileName) => {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!fs.existsSync(filePath)) {
    throw new Error(`${fileName} not found at: ${filePath}`);
  }
};

// Check that all required files exist
validateFileExists(packageJsonPath, 'package.json');
validateFileExists(appJsonPath, 'app.json');
validateFileExists(desktopPackageJsonPath, 'desktop/package.json');

// Read package.json
// eslint-disable-next-line security/detect-non-literal-fs-filename
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const currentVersion = packageJson.version;

// Validate current version format
validateVersion(currentVersion);

console.log(`\n📦 Current version: ${currentVersion}\n`);

// Create readline interface for prompts
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer.toLowerCase().trim());
    });
  });
};

const bumpVersion = (version, type) => {
  const [major, minor, patch] = version.split('.').map(Number);

  switch (type) {
    case 'breaking':
      return `${major + 1}.0.0`;
    case 'feature':
      return `${major}.${minor + 1}.0`;
    case 'bugfix':
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Unknown version type: ${type}`);
  }
};

const main = async () => {
  try {
    // Prompt user for change type
    const answer = await question(
      '🔍 What type of change?\n' +
      '  1) breaking - Breaking change (major version bump)\n' +
      '  2) feature - New feature (minor version bump)\n' +
      '  3) bugfix  - Bug fix (patch version bump)\n' +
      '\nEnter choice (breaking/feature/bugfix): '
    );

    // Map numeric input to type names
    const typeMap = {
      '1': 'breaking',
      'breaking': 'breaking',
      '2': 'feature',
      'feature': 'feature',
      '3': 'bugfix',
      'patch': 'bugfix',
      'bugfix': 'bugfix',
    };

    // eslint-disable-next-line security/detect-object-injection
    const changeType = typeMap[answer];
    if (!changeType) {
      console.error('\n❌ Invalid choice. Please use: breaking, feature, or bugfix\n');
      process.exit(1);
    }

    // Calculate new version
    const newVersion = bumpVersion(currentVersion, changeType);
    
    // Validate new version format
    validateVersion(newVersion);
    
    console.log(`\n✅ Bumping version: ${currentVersion} → ${newVersion} (${changeType})\n`);

    // Update package.json
     
    packageJson.version = newVersion;
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');

    // Update app.json (Expo config)
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
     
    appJson.expo.version = newVersion;
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf-8');

    // Update desktop/package.json (Electron app)
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const desktopPackageJson = JSON.parse(fs.readFileSync(desktopPackageJsonPath, 'utf-8'));
     
    desktopPackageJson.version = newVersion;
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(desktopPackageJsonPath, JSON.stringify(desktopPackageJson, null, 2) + '\n', 'utf-8');

    // Update package-lock.json to keep it in sync
    console.log('🔄 Updating package-lock.json...');
    try {
      execSync('npm install --package-lock-only', { stdio: 'inherit' });
      console.log('✅ package-lock.json updated\n');
    } catch (error) {
      console.error('\n❌ Failed to update package-lock.json:', error.message, '\n');
      process.exit(1);
    }

    // Update desktop/package-lock.json to keep it in sync
    console.log('🔄 Updating desktop/package-lock.json...');
    try {
      execSync('cd desktop && npm install --package-lock-only', { stdio: 'inherit' });
      console.log('✅ desktop/package-lock.json updated\n');
    } catch (error) {
      console.error('\n❌ Failed to update desktop/package-lock.json:', error.message, '\n');
      process.exit(1);
    }

    // Commit the change
    try {
      execSync('git add package.json package-lock.json app.json desktop/package.json desktop/package-lock.json', { stdio: 'inherit' });
      execSync(`git commit -m "chore(release): bump version to ${newVersion} (${changeType})"`, {
        stdio: 'inherit',
      });
      console.log(`\n✨ Version bumped and committed!\n`);
      console.log(`📝 Next steps:\n`);
      console.log(`   1. Review the commit: git show HEAD\n`);
      console.log(`   2. Create the tag: git tag v${newVersion}\n`);
      console.log(`   3. Push tag: git push origin v${newVersion}\n`);
      console.log(`   4. This will trigger the desktop-release.yml workflow to build and upload installers.\n`);
    } catch (_error) {
      console.error('\n❌ Git commit failed. Make sure git is configured.\n');
      process.exit(1);
    }
  } finally {
    rl.close();
  }
};

main().catch((error) => {
  console.error('\n❌ Error:', error.message, '\n');
  process.exit(1);
});
