// Metro configuration for D&D Toolkit
// Uses Sentry's Expo Metro config as base, with room for custom configuration
//
// To add custom Metro settings, modify the config object below.
// See: https://docs.expo.dev/guides/customizing-metro/

const { getSentryExpoConfig } = require("@sentry/react-native/metro");

// Get Sentry's Expo Metro configuration
const config = getSentryExpoConfig(__dirname);

// Add any custom Metro configuration here
// For example:
// config.resolver = {
//   ...config.resolver,
//   // Custom resolver settings
// };

module.exports = config;
