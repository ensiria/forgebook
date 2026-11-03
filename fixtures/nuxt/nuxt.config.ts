/**
 * The fixture app's Nuxt configuration: what the catalogue reads of it is its runtime config's public values, its app
 * config, its style sheets and its aliases. `runtimeConfig.apiSecret` is private, and must never reach the page.
 *
 * @module
 */
export default defineNuxtConfig({
  compatibilityDate: "2026-07-01",
  css: ["~/assets/main.css"],
  alias: { "#money": "./shared/utils/money" },
  runtimeConfig: {
    apiSecret: "server-only-value",
    public: { siteName: "Forge Shop", apiBase: "/api" }
  },
  appConfig: { theme: { accent: "teal", radius: "4px" } }
});
