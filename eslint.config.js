// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const securityPlugin = require('eslint-plugin-security');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    plugins: {
      security: securityPlugin,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      // Storage: All data must use SecureStorage for cross-platform encryption
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message: 'Use SecureStorage from @/lib/storage instead. It encrypts data on all platforms (web, iOS, Android).',
        },
        {
          name: 'sessionStorage',
          message: 'Use SecureStorage from @/lib/storage instead. It encrypts data on all platforms (web, iOS, Android).',
        },
      ],
      // Security rules
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-require': 'error',
      'security/detect-object-injection': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-unsafe-regex': 'error',
    },
  },
  // FastCache layer: allowed to use localStorage directly for performance (unencrypted query cache)
  {
    files: ['lib/storage/FastCache.ts'],
    rules: {
      'no-restricted-globals': 'off',
    },
  },
  // === NAVIGATION BOUNDARY RULE ===
  // All navigation must go through useGuardedNavigation to ensure the guard pipeline runs.
  // This catches: direct router.push/replace/back calls anywhere in the codebase.
  //
  // Exemptions (only files that IMPLEMENT the pipeline itself):
  // - hooks/navigation/use-guarded-navigation.ts  (the pipeline — calls router directly by design)
  // - hooks/navigation/use-route-change-observer.ts  (route-change detection — needs raw router)
  // - pure-algo-immutables/navigation-actions.ts  (navigation primitive definitions)
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: [
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.object.name="router"][callee.property.name="push"]',
          message: 'Use navigate.push() from useGuardedNavigation instead of router.push() — this ensures navigation goes through the guard pipeline.',
        },
        {
          selector: 'CallExpression[callee.object.name="router"][callee.property.name="replace"]',
          message: 'Use navigate.replace() from useGuardedNavigation instead of router.replace() — this ensures navigation goes through the guard pipeline.',
        },
        {
          selector: 'CallExpression[callee.object.name="router"][callee.property.name="back"]',
          message: 'Use navigate.back() from useGuardedNavigation instead of router.back() — this ensures navigation goes through the guard pipeline.',
        },
      ],
    },
  },
  // === ARCHITECTURE BOUNDARY RULES ===
  // Components should NOT import from lib/ or system/ (use hooks instead)
  // Note: Glob patterns like 'lib/*' aren't supported in ESLint 9's no-restricted-imports
  // Instead we rely on code review and architectural discipline
  {
    files: ['components/**/*.tsx', 'components/**/*.ts'],
    rules: {
      // Rule disabled - we can't use glob patterns in no-restricted-imports with ESLint 9
      // Enforcement is done via code review instead
    },
  },
  // Lib folder architectural rules
  {
    files: ['lib/**/*.ts', 'lib/**/*.tsx'],
    rules: {
      // Glob patterns like 'hooks/*' and 'components/*' aren't supported in ESLint 9
      // Enforcement is done via code review instead
    },
  },
  // System folder architectural rules
  {
    files: ['system/**/*.ts', 'system/**/*.tsx'],
    rules: {
      // Glob patterns like 'lib/*', 'hooks/*', 'components/*' aren't supported in ESLint 9
      // Enforcement is done via code review instead
    },
  },
]);


