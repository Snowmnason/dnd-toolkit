import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./__tests__/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      // Alias react-native to a local stub to avoid parsing native package in tests
      "react-native": path.resolve(__dirname, "./__mocks__/react-native.ts"),
      // Fix deep import resolution for react-native's Promise polyfill
      // Some bundled imports omit the .js extension which ESM resolution in the test
      // runner rejects. Point the deep import to the actual .js file in node_modules.
      "promise/setimmediate/es6-extensions": path.resolve(
        __dirname,
        "node_modules/promise/setimmediate/es6-extensions.js",
      ),
    },
  },
});
