/**
 * The project the tests' renderer draws for, in place of the one the plugin writes: two pages, a public config, an app
 * config in two layers.
 *
 * @module
 */
import type { NuxtProject } from "../src/project.ts";

/** The tests' project. */
export const project: NuxtProject = {
  routes: [
    { path: "/", name: "index" },
    { path: "/blog/:slug()", name: "blog-slug" }
  ],
  runtimeConfig: {
    public: { siteName: "Shop", api: { base: "/api", version: 1 } },
    app: { baseURL: "/", buildAssetsDir: "/_nuxt/", cdnURL: "" }
  },
  appConfigs: [{ theme: { accent: "teal", radius: "4px" } }, { theme: { radius: "8px" } }],
  components: {}
};
