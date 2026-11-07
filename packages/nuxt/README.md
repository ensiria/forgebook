# @forgebook/nuxt

Nuxt for [Forgebook](https://www.npmjs.com/package/forgebook): a Nuxt project's components drawn outside Nuxt, with what
they use of it. Their auto-imports, the `~` and `@` aliases, `#imports`, `#app` and `#components`, Nuxt's router
through `useRoute`, `navigateTo` and `NuxtLink`, `useFetch` and `useAsyncData`, `useState`, `useCookie`,
`useRuntimeConfig` and `useAppConfig`. It is [`@forgebook/vue`](https://www.npmjs.com/package/@forgebook/vue) with a
Vite plugin and a story's own Nuxt.

**Requirements:** Nuxt 3 or 4 · Vue 3.5 · vue-router 4.5 or 5 (Nuxt's) · `forgebook` · Vite 8.3.4+ · React in the project, for
the catalogue's own interface (the frames that draw your components load none) ·
[MIT licence](https://github.com/ensiria/forgebook/blob/develop/packages/nuxt/LICENSE)

```sh
npm install --save-dev forgebook @forgebook/nuxt
```

The catalogue's configuration, in the Nuxt project's folder, names it as its framework:

```ts
// forgebook.config.ts
import { nuxt } from "@forgebook/nuxt/vite";
import { defineConfig } from "forgebook";

export default defineConfig({
  framework: nuxt(),
  title: "My components",
  stories: ["app/components/**/*.stories.ts"]
});
```

and the stories take their types from it. A story says where its component is and what Nuxt would have given it, under
`parameters.nuxt`:

```ts
import type { Meta, Story } from "@forgebook/nuxt";

import BlogPost from "./BlogPost.vue"; // `useRoute()`, `useAsyncData(`post-${slug}`, …)`, `<BaseBadge>`

export default {
  title: "Blog/BlogPost",
  component: BlogPost,
  parameters: { nuxt: { route: { name: "blog-slug", params: { slug: "hello" } } } }
} satisfies Meta<typeof BlogPost>;

// what `useAsyncData` returns for its key, without calling its handler
export const Published: Story<typeof BlogPost> = {
  parameters: {
    nuxt: { route: "/blog/hello", data: { "post-hello": { title: "Hello", status: "published" } } }
  }
};
```

| `parameters.nuxt` | What it sets |
|---|---|
| `route` | Where the story starts: a path (`/blog/hello?tab=1`), or a location by path (`{ path, query, hash }`) or by a page's name (`{ name: "blog-slug", params: { slug: "hello" } }`); `/` by default |
| `data` | What `useAsyncData` and `useFetch` return, by key, without calling their handler. `useFetch`'s key is the request as it is made, unless it is given one: its URL with its query (`/api/products?page=2`), the method before it when not GET, the body after it (`POST /api/cart {"id":1}`) |
| `state` | What `useState` starts with, by key |
| `cookies` | What `useCookie` reads, by name |
| `runtimeConfig.public` | The runtime config's public values, over the project's |
| `appConfig` | The app config, over the project's |

A story's `nuxt` replaces the meta's whole, as every parameter does: a story that adds `data` writes its `route` too.
Without `data` for a key, the handler runs, and a request goes out: the catalogue's
[MSW handlers](https://github.com/ensiria/forgebook/blob/develop/packages/forgebook/README.md) answer it. A play reads
where the story went, and what it called, with `storyNuxt()`:

```ts
import { storyNuxt } from "@forgebook/nuxt/story";

export const GoesToAbout: Story<typeof SiteNav> = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("link", { name: "About" }));
    await canvas.findByText("On /about");
    if (storyNuxt().route.path !== "/about") throw new Error("Not on /about");
  }
};
```

| Import | What it is |
|---|---|
| `@forgebook/nuxt` | `Meta`, `Story`, `Preview`: Vue's story types, with `parameters.nuxt` |
| `@forgebook/nuxt/vite` | `nuxt()`, the framework adapter of `forgebook.config.ts`: Vue's plugin and this package's |
| `@forgebook/nuxt/story` | `storyNuxt()`: the story's route, its calls to Nuxt, its state, cookies and data |
| `@forgebook/nuxt/renderer` | `nuxtRenderer`, for the generated server tests (`storyServerTests(source, { renderer: nuxtRenderer })`) |

`@forgebook/nuxt/app/*`, `@forgebook/nuxt/project` and `@forgebook/nuxt/code` are internal: the code the plugin
writes and the catalogue's pages import them, so they may change in any release. A component imports Nuxt's names as it
does in the app (auto-imported, or from `#imports`).

## What a component gets

The plugin reads `nuxt.config` (with `defineNuxtConfig` given as Nuxt gives it) and the project's folders, and does what
Nuxt's build does for a component's code:

- **Auto-imports**: Vue's API, the files of `composables/`, `utils/` and `shared/utils/` (and `imports.dirs`), and
  Nuxt's composables, through unimport, the library Nuxt uses. `#imports` and `#app` export them too.
- **Components**: the files of `components/` (or the folders `components` names), named as Nuxt names them
  (`components/base/Button.vue` is `BaseButton`), their `Lazy` forms, and Nuxt's own (`NuxtLink`, `ClientOnly`,
  `DevOnly`, `NuxtLayout`, `NuxtErrorBoundary`, and `NuxtImg`, drawn as a plain image). `#components` exports them.
- **Aliases**: `~` and `@` (the sources' folder, `app/` in Nuxt 4's layout), `~~` and `@@` (the project's), `#shared`,
  `assets`, `public` and the config's `alias`.
- **The router**: vue-router's own, on a memory history, with a route for each file of `pages/` (named as Nuxt names
  them) and one for any other path. A link moves it, `useRoute` follows, and the frame's address never changes. Each
  move and each `navigateTo` is listed among the story's events; a link out of the app is recorded, not followed.
- **The config**: `useRuntimeConfig()` returns the runtime config's `public` part, its `NUXT_PUBLIC_` variables over it,
  and `app`; its private keys never reach the page. `useAppConfig()` returns `nuxt.config`'s `appConfig` and
  `app.config.ts`, merged. The style sheets of `css` load in every frame. `import.meta.client` is `true`.

What Nuxt does on its server has no server to run on: `useRequestHeaders` returns none, `useHead` and `useSeoMeta`
leave the frame's head alone, `definePageMeta` and route middleware do nothing, and `showError` keeps the error for
`useError` instead of drawing Nuxt's error page. The generated server tests run no `useAsyncData` handler: they draw
the story's `data`, or nothing.

Nuxt's own build is not run, so the work of a Nuxt module or plugin is not done: a component that needs what one
provides (a Pinia store, i18n) gets it from a decorator, and a module's components and composables are not
auto-imported. `#build/…` modules are Nuxt's build's own and fail by name. Nuxt layers (`extends`) and
`definePageMeta`'s `path` and `name` are not read. A Nuxt function this package does not stand in for is not given: a
file that uses one fails on it by name.

`forgebook init --from storybook` reads a project set up with `@storybook-vue/nuxt` (what Nuxt's Storybook module
writes), and says what a story sets differently. The rest of what Forgebook does is
[Forgebook's README](https://github.com/ensiria/forgebook/blob/develop/packages/forgebook/README.md).
