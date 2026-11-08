---
title: How-to/Frameworks
order: 7
description: The adapter for each framework, and where its own setup is written.
---

# Frameworks

The catalogue is framework-independent: a framework is an adapter package that draws its components, writes their code
and reads their props. `forgebook init` picks the adapter from `package.json`; `--framework <name>` chooses when it
cannot. Install `forgebook` with the adapter, and React for the catalogue's own interface (a story's frame in another
framework loads none).

| Framework | Adapter | `--framework` | Setup |
|---|---|---|---|
| React | `@forgebook/react` | `react` | [README](../../packages/react/README.md) |
| Vue 3.5 | `@forgebook/vue` | `vue` | [README](../../packages/vue/README.md) |
| Nuxt | `@forgebook/nuxt` | `nuxt` | [README](../../packages/nuxt/README.md) |
| Svelte 5 | `@forgebook/svelte` | `svelte` | [README](../../packages/svelte/README.md) |
| SvelteKit | `@forgebook/sveltekit` | `sveltekit` | [README](../../packages/sveltekit/README.md) |
| Solid | `@forgebook/solid` | `solid` | [README](../../packages/solid/README.md) |
| Preact | `@forgebook/preact` | `preact` | [README](../../packages/preact/README.md) |
| Web Components (Lit) | `@forgebook/web-components` | `web-components` | [README](../../packages/web-components/README.md) |
| Angular and Analog | `@forgebook/angular` | `angular` | [README](../../packages/angular/README.md) |
| Next.js | `@forgebook/nextjs` | `nextjs` | [README](../../packages/nextjs/README.md) |
| React Native, through react-native-web | `@forgebook/react-native-web` | `react-native-web` | [README](../../packages/react-native-web/README.md) |
| No framework (HTML strings or DOM nodes) | `@forgebook/html` | `html` | [README](../../packages/html/README.md) |

Each README gives the versions it supports, the configuration and a story. An agent reads the same with
`forgebook guide <framework>`.

The configuration names the adapter as its framework, and stories take their types from it:

```ts
// forgebook.config.ts
import { vue } from "@forgebook/vue/vite";
import { defineConfig } from "forgebook";

export default defineConfig({
  framework: vue(),
  title: "My components",
  stories: ["src/**/*.stories.ts"]
});
```

## The app's own build

A catalogue draws your components with your app's build, with nothing to write: the aliases of `tsconfig.json`, the
`vite.config` beside the configuration (its aliases, `define`, Sass options and plugins), and the project's PostCSS.
Loading a `vite.config` or a PostCSS configuration runs it, as `vite dev` does. `forgebook dev` prints what it read;
`appBuild: false` in the configuration turns it all off, and `appBuild: { skipPlugins: ["name"] }` leaves one plugin
out. See [the app's build](../../packages/forgebook/README.md#the-apps-build).

Plugins of the catalogue itself (MSW for mocked requests, Figma links) are listed in
[PLUGINS.md](../../packages/forgebook/PLUGINS.md).
