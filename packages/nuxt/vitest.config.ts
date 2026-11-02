/**
 * The Nuxt package's tests: the stand-ins and the renderer in a simulated page, the plugin's logic on its own.
 *
 * @module
 */
import plugin from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [plugin()],
  // the full build, as a catalogue's page has it; the project the plugin would write, as the tests give it
  resolve: {
    alias: [
      { find: /^vue$/, replacement: "vue/dist/vue.esm-bundler.js" },
      {
        find: /^virtual:forgebook-nuxt\/project$/,
        replacement: new URL("test/project.ts", import.meta.url).pathname
      }
    ]
  },
  test: { environment: "happy-dom" }
});
