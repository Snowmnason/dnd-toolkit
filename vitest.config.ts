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
    },
  },
});
