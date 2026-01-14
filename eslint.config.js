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
]);


