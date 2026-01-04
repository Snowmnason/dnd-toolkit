#!/usr/bin/env node

/**
 * Interactive version bump helper
 * 
 * Flow:
 * 1. User runs: npm run version:bump
 * 2. Prompts: "What type of change? (breaking/feature/bugfix)"
 * 3. Bumps package.json version accordingly:
 *    - breaking -> major (X.0.0)
 *    - feature -> minor (x.X.0)
 *    - bugfix -> patch (x.x.X)
 * 4. Commits with message: "chore(release): bump version to X.Y.Z"
 * 5. User then manually runs: git tag vX.Y.Z && git push origin vX.Y.Z
 *    This triggers the desktop-release.yml workflow
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const packageJsonPath = path.join(__dirname, '..', 'package.json');

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const currentVersion = packageJson.version;

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

    const changeType = typeMap[answer];
    if (!changeType) {
      console.error('\n❌ Invalid choice. Please use: breaking, feature, or bugfix\n');
      process.exit(1);
    }

    // Calculate new version
    const newVersion = bumpVersion(currentVersion, changeType);
    console.log(`\n✅ Bumping version: ${currentVersion} → ${newVersion} (${changeType})\n`);

    // Update package.json
    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');

    // Commit the change
    try {
      execSync('git add package.json', { stdio: 'inherit' });
      execSync(`git commit -m "chore(release): bump version to ${newVersion}"`, {
        stdio: 'inherit',
      });
      console.log(`\n✨ Version bumped and committed!\n`);
      console.log(`📝 Next steps:\n`);
      console.log(`   1. Review the commit: git show HEAD\n`);
      console.log(`   2. Create the tag: git tag v${newVersion}\n`);
      console.log(`   3. Push tag: git push origin v${newVersion}\n`);
      console.log(`   4. This will trigger the desktop-release.yml workflow\n`);
    } catch (error) {
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
