const createExpoWebpackConfigAsync = require("@expo/webpack-config");
const fs = require("fs");
const { sources } = require("webpack");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // --- 1. Patch externals for Skia (Reanimated workaround) ---
  config.externals = {
    ...(config.externals || {}),
    "react-native-reanimated": "require('react-native-reanimated')",
    "react-native-reanimated/lib/reanimated2/core":
      "require('react-native-reanimated/lib/reanimated2/core')",
  };

  // --- 2. Ensure canvaskit.wasm gets copied into build ---
  config.plugins.push(
    new (class CopySkiaPlugin {
      apply(compiler) {
        compiler.hooks.thisCompilation.tap("AddSkiaPlugin", (compilation) => {
          compilation.hooks.processAssets.tapPromise(
            {
              name: "copy-skia",
              stage:
                compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
            },
            async () => {
              const src = require.resolve(
                "canvaskit-wasm/bin/full/canvaskit.wasm"
              );
              if (!compilation.getAsset("canvaskit.wasm")) {
                const wasmFile = await fs.promises.readFile(src);
                compilation.emitAsset(
                  "canvaskit.wasm",
                  new sources.RawSource(wasmFile)
                );
              }
            }
          );
        });
      }
    })()
  );

  // --- 3. Polyfill Node core modules (fs, path, etc.) ---
  config.plugins.push(new NodePolyfillPlugin());

  // --- 4. Add aliases to suppress warnings & fix asset resolution ---
  config.resolve.alias = {
    ...config.resolve.alias,
    "react-native-reanimated/package.json": require.resolve(
      "react-native-reanimated/package.json"
    ),
    "react-native-reanimated": require.resolve("react-native-reanimated"),
    "react-native/Libraries/Image/AssetRegistry": false,
  };

  return config;
};
