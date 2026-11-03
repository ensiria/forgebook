/**
 * What the page knows of a Nuxt project, as the plugin reads it on Node and hands it to the frame: its pages' routes,
 * its public runtime config, its app config and its components.
 *
 * @remarks
 * The plugin writes it as a module (`@forgebook/nuxt/project`, `pageProject.ts`), so it holds only what may reach a page: the
 * runtime config's `public` part and `app`, never its private keys, which Nuxt keeps on the server too.
 *
 * @module
 */
import type { Component } from "vue";

/** A route of the project's pages, as Nuxt names it from its file (`pages/blog/[slug].vue`). */
export type ProjectRoute = {
  /** The route's path, as vue-router writes it (`/blog/:slug()`). */
  readonly path: string;
  /** The route's name, as Nuxt writes it (`blog-slug`). */
  readonly name: string;
};

/** The runtime config the page reads: `useRuntimeConfig()`. */
export type PublicRuntimeConfig = {
  /** The project's `runtimeConfig.public`, its `NUXT_PUBLIC_` variables over it. */
  readonly public: Readonly<Record<string, unknown>>;
  /** Where the app is served from. */
  readonly app: {
    /** The app's base path (`app.baseURL`); `/` by default. */
    readonly baseURL: string;
    /** Where Nuxt serves its built files from; `/_nuxt/` by default. */
    readonly buildAssetsDir: string;
    /** The CDN the files are served from; empty by default. */
    readonly cdnURL: string;
  };
};

/** Loads one of the project's components, for a component a story's template names without importing it. */
export type ComponentLoader = () => Promise<Component | { readonly default: Component }>;

/** What the page knows of a Nuxt project. */
export type NuxtProject = {
  /** The routes of its pages; none when it has no `pages` folder. */
  readonly routes: readonly ProjectRoute[];
  /** Its runtime config, as the page reads it. */
  readonly runtimeConfig: PublicRuntimeConfig;
  /** Its app configs, the later over the earlier: `nuxt.config`'s `appConfig`, then `app.config.ts`'s. */
  readonly appConfigs: readonly Readonly<Record<string, unknown>>[];
  /** Its components, by the name Nuxt gives each, loaded when a template names one. */
  readonly components: Readonly<Record<string, ComponentLoader>>;
};

/** The project of a page with no Nuxt project read: no pages, an empty config, no components. */
export const EMPTY_PROJECT: NuxtProject = {
  routes: [],
  runtimeConfig: { public: {}, app: { baseURL: "/", buildAssetsDir: "/_nuxt/", cdnURL: "" } },
  appConfigs: [],
  components: {}
};
