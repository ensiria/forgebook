In a Nuxt project, `Badge.vue` and `Badge.stories.ts`, the types from `@forgebook/nuxt`: a component's auto-imports, aliases and
Nuxt's components work as in the app. Set what Nuxt would have given it with `parameters.nuxt`: `route`, `data`, `state`,
`cookies`, `runtimeConfig.public` and `appConfig`.

```ts
import type { Meta, Story } from "@forgebook/nuxt";

import Badge from "./Badge.vue";

export default { title: "Data/Badge", component: Badge } satisfies Meta<typeof Badge>;

/** The label as most pages use it. */
export const Default: Story<typeof Badge> = { args: { label: "New" }, parameters: { main: true } };
```

<!-- more -->

`route` is a path, or `{ name, params }` of a page; `data` is what `useAsyncData` and `useFetch` return, by key (`useFetch`'s key is the
request as made, `/api/products?page=2`). A story's `nuxt` replaces the meta's, whole. Its router moves and `navigateTo` calls are listed among the story's events; a
play reads them with `storyNuxt()` from `@forgebook/nuxt/story`.

The stories, the configuration and the rest of the adapter: `node_modules/@forgebook/nuxt/README.md`.
