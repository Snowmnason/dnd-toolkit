// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const securityPlugin = require('eslint-plugin-security');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
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
      // detect-non-literal-regexp: Pattern-based cache invalidation requires dynamic regexes
      // Safe because patterns come from trusted constants (cache keys), not user input
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-require': 'error',
      // detect-object-injection: Cache/storage uses dynamic keys from constants
      // Safe because keys come from trusted STORAGE_KEYS or internal cache constants, not user input
      'security/detect-object-injection': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-unsafe-regex': 'error',
    },
  },
  // Cache layer is allowed to use these patterns safely
  {
    files: ['lib/cache/**/*.ts', 'lib/cache/**/*.tsx'],
    rules: {
      // Pattern-based invalidation requires dynamic regexes from controlled cache keys
      'security/detect-non-literal-regexp': 'off',
      // Storage layer uses dynamic keys from STORAGE_KEYS constants
      'security/detect-object-injection': 'off',
    },
  },
  // Storage layer uses controlled patterns
  {
    files: ['lib/storage/**/*.ts', 'lib/storage/**/*.tsx'],
    rules: {
      // Storage layer uses dynamic keys from STORAGE_KEYS constants
      'security/detect-object-injection': 'off',
    },
  },
  // Database layer uses controlled patterns
  {
    files: ['lib/database/**/*.ts', 'lib/database/**/*.tsx'],
    rules: {
      // Database keys are from constants or user IDs (safe)
      'security/detect-object-injection': 'off',
    },
  },
]);


