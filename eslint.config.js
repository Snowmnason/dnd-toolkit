// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const securityPlugin = require('eslint-plugin-security');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      // Generated build outputs — keep in sync with metro.config.js BLOCKED_DIRS
      'dist/**',
      'dist-desktop/**',
      'desktop/dist/**',
      'android/build/**',
      'android/.gradle/**',
      // Test infrastructure (linted separately by Jest/Vitest runners)
      '__mocks__/**',
      '__tests__/**',
      // Dev tooling and config — not app source
      'scripts/**',
      'docs/**',
      'supabase/**',
      '.github/**',
      '.vscode/**',
      '.idea/**',
    ],
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
  // All navigation must go through useNavigation to ensure the guard pipeline runs.
  // This catches: direct router.push/replace/back calls anywhere in the codebase.
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: [
      'system/Navigation/**', // EXCEPTION: Centralized transport layer (all router.* calls must go here)
      '**/*.test.ts', // Allow in unit/integration tests
      '**/*.test.tsx', // Allow in UI tests
      'providers/AppKernelProvider.tsx', // EXCEPTION: Bootstrap bridge — calls useRouter() and system/Navigation to seed the router instance alongside kernel init
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        // ---- Navigation actions ----
        {
          selector: 'CallExpression[callee.object.name="router"][callee.property.name="push"]',
          message: 'Use navigate.to() from useNavigation() instead of router.push() — this ensures navigation goes through the guard pipeline.',
        },
        {
          selector: 'CallExpression[callee.object.name="router"][callee.property.name="navigate"]',
          message: 'Use navigate.to() from useNavigation() instead of router.navigate() — this ensures navigation goes through the guard pipeline.',
        },
        {
          selector: 'CallExpression[callee.object.name="router"][callee.property.name="replace"]',
          message: 'Use navigate.replace() from useNavigation() instead of router.replace() — this ensures navigation goes through the guard pipeline.',
        },
        {
          selector: 'CallExpression[callee.object.name="router"][callee.property.name="back"]',
          message: 'Use navigate.back() from useNavigation() instead of router.back() — this ensures navigation goes through the guard pipeline.',
        },
        {
          selector: 'CallExpression[callee.object.name="router"][callee.property.name="dismiss"]',
          message: 'Use navigate.dismiss() from useNavigation() instead of router.dismiss() — this ensures navigation goes through the guard pipeline.',
        },
        {
          selector: 'CallExpression[callee.object.name="router"][callee.property.name="dismissAll"]',
          message: 'Use navigate.dismissAll() from useNavigation() instead of router.dismissAll() — this ensures navigation goes through the guard pipeline.',
        },
        {
          selector: 'CallExpression[callee.object.name="router"][callee.property.name="dismissTo"]',
          message: 'Use navigate.dismissAll(target) from useNavigation() instead of router.dismissTo() — this ensures navigation goes through the guard pipeline.',
        },
        // ---- State queries ----
        {
          selector: 'CallExpression[callee.object.name="router"][callee.property.name="canGoBack"]',
          message: 'Use navigate.canGoBack() from useNavigation() instead of router.canGoBack().',
        },
        {
          selector: 'CallExpression[callee.object.name="router"][callee.property.name="canDismiss"]',
          message: 'Use navigate.canDismiss() from useNavigation() instead of router.canDismiss().',
        },
        // ---- Utility ops ----
        {
          selector: 'CallExpression[callee.object.name="router"][callee.property.name="setParams"]',
          message: 'Use navigate.setParams() from useNavigation() instead of router.setParams().',
        },
        {
          selector: 'CallExpression[callee.object.name="router"][callee.property.name="prefetch"]',
          message: 'Use navigate.prefetch() from useNavigation() instead of router.prefetch().',
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


