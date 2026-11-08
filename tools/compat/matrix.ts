/**
 * The compatibility matrix: every published package that renders stories, the fixture catalogue that exercises it, and
 * the tools it is tested against. Each tool's lines come from the range the package claims (its peer dependency, by
 * default), so the page tests what the package promises and a promise nobody tests cannot be added by a range alone.
 *
 * @module
 */
import type { CompatMatrix } from "./compat.types.ts";

/** The matrix the weekly run and the page read. */
export const COMPAT_MATRIX: CompatMatrix = {
  hosts: {
    // every adapter's plugin runs inside the Vite the catalogue starts: forgebook's own dependency
    vite: {
      label: "Vite",
      packages: ["vite"],
      range: { field: "dependencies", folder: "packages/forgebook" }
    },
    // React publishes its next release as canaries numbered below `latest`, so the newest-ahead rule finds none
    react: { label: "React", packages: ["react", "react-dom"], prerelease: { tag: "canary" } },
    vue: { label: "Vue", packages: ["vue"] },
    vueRouter: { label: "vue-router", packages: ["vue-router"] },
    svelte: { label: "Svelte", packages: ["svelte"] },
    solid: { label: "Solid", packages: ["solid-js"] },
    preact: { label: "Preact", packages: ["preact"] },
    lit: { label: "Lit", packages: ["lit"] },
    angular: {
      label: "Angular",
      packages: [
        "@angular/core",
        "@angular/common",
        "@angular/compiler",
        "@angular/compiler-cli",
        "@angular/platform-browser",
        "@angular/platform-server",
        "@angular/build"
      ],
      // Angular 20's compiler refuses TypeScript 6, which the fixtures pin; a project on Angular 20 has its 5.9
      companions: { "20": { typescript: "5.9" } }
    },
    next: { label: "Next.js", packages: ["next"] },
    sveltekit: { label: "SvelteKit", packages: ["@sveltejs/kit"] },
    reactNativeWeb: { label: "React Native Web", packages: ["react-native-web"] }
  },
  adapters: [
    {
      name: "forgebook",
      folder: "packages/forgebook",
      fixture: "fixtures/app",
      hosts: [{ host: "react" }, { host: "vite" }],
      note: "React here is the catalogue's own interface, which every adapter's catalogue loads."
    },
    {
      name: "@forgebook/react",
      folder: "packages/react",
      fixture: "fixtures/app",
      hosts: [{ host: "react" }, { host: "vite" }]
    },
    {
      name: "@forgebook/vue",
      folder: "packages/vue",
      fixture: "fixtures/vue",
      hosts: [{ host: "vue" }, { host: "vite" }]
    },
    {
      name: "@forgebook/svelte",
      folder: "packages/svelte",
      fixture: "fixtures/svelte",
      hosts: [{ host: "svelte" }, { host: "vite" }]
    },
    {
      name: "@forgebook/solid",
      folder: "packages/solid",
      fixture: "fixtures/solid",
      hosts: [{ host: "solid" }, { host: "vite" }]
    },
    {
      name: "@forgebook/preact",
      folder: "packages/preact",
      fixture: "fixtures/preact",
      hosts: [{ host: "preact" }, { host: "vite" }]
    },
    {
      name: "@forgebook/web-components",
      folder: "packages/web-components",
      fixture: "fixtures/web-components",
      hosts: [{ host: "lit" }, { host: "vite" }]
    },
    { name: "@forgebook/html", folder: "packages/html", fixture: "fixtures/html", hosts: [{ host: "vite" }] },
    {
      name: "@forgebook/angular",
      folder: "packages/angular",
      fixture: "fixtures/angular",
      hosts: [{ host: "angular" }, { host: "vite" }]
    },
    {
      name: "@forgebook/nextjs",
      folder: "packages/nextjs",
      fixture: "fixtures/nextjs",
      hosts: [{ host: "next" }, { host: "vite" }]
    },
    {
      name: "@forgebook/nuxt",
      folder: "packages/nuxt",
      fixture: "fixtures/nuxt",
      hosts: [{ host: "vue" }, { host: "vueRouter" }, { host: "vite" }],
      note:
        "Nuxt itself is not installed: the package gives a component what Nuxt would (auto-imports, aliases, its " +
        "router and data composables), so what is tested is that on Vue, vue-router and Vite."
    },
    {
      name: "@forgebook/sveltekit",
      folder: "packages/sveltekit",
      fixture: "fixtures/sveltekit",
      hosts: [
        {
          host: "sveltekit",
          range: {
            range: "^2.0.0 || ^3.0.0",
            why: "the package's README; SvelteKit is no peer dependency, its modules are given by the package"
          },
          // the package's fixture is a SvelteKit 3 app, which SvelteKit 2 refuses as written: its line has an app of its own
          fixtures: { "2": "fixtures/sveltekit2" }
        },
        { host: "vite" }
      ]
    },
    {
      name: "@forgebook/react-native-web",
      folder: "packages/react-native-web",
      fixture: "fixtures/react-native",
      hosts: [{ host: "reactNativeWeb" }, { host: "react" }, { host: "vite" }]
    }
  ]
};
