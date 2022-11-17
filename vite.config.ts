/// <reference types="vitest" />
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { ViteMinifyPlugin } from "vite-plugin-minify";

export default defineConfig({
  plugins: [vue(), ViteMinifyPlugin({})],
  test: {
    coverage: {
      reporter: ["text", "json", "html"],
      provider: "c8",
    },
    environment: "jsdom",
  },
});
