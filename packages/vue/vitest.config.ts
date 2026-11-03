/**
 * The Vue package's tests: the renderer draws stories in a simulated page, single-file components compiled by Vue's
 * plugin.
 *
 * @module
 */
import plugin from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [plugin()],
  // the full build, as a catalogue's page has it: the tests' stories write templates too
  resolve: { alias: [{ find: /^vue$/, replacement: "vue/dist/vue.esm-bundler.js" }] },
  test: { environment: "happy-dom" }
});
