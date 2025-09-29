const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Add wasm support
config.resolver.assetExts.push("wasm");

module.exports = config;
// Note: If using Expo, ensure "expo" is in the "dependencies" of package.json