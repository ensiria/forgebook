# @forgebook/vue

Vue 3 for [Forgebook](https://www.npmjs.com/package/forgebook): the story types, the composables, the renderer the frame
mounts a story with, and the adapter that reads a component's props, events and slots, single-file components included.

**Requirements:** Vue 3.5 · `forgebook` · Vite 8.3.4+ · React in the project, for the catalogue's own interface (the frames that
draw your components load none) · [MIT licence](https://github.com/ensiria/forgebook/blob/develop/packages/vue/LICENSE)

```sh
npm install --save-dev forgebook @forgebook/vue
```

The catalogue's configuration names it as its framework:

```ts
// forgebook.config.ts
import { vue } from "@forgebook/vue/vite";
import { defineConfig } from "forgebook";

export default defineConfig({ framework: vue(), title: "My components", stories: ["src/**/*.stories.ts"] });
```

and the stories take their types from it:

```ts
import type { Meta, Story } from "@forgebook/vue";
import { h } from "vue";

import Badge from "./Badge.vue";

export default { title: "Components/Badge", component: Badge } satisfies Meta<typeof Badge>;

// the component with its args
export const Default: Story<typeof Badge> = { args: { label: "New" } };

// its slots, each as `#name`: a text, or a function that draws it
export const WithIcon: Story<typeof Badge> = { args: { label: "New", "#icon": () => h("i", "*") } };

// a render, returning a virtual node or a component, as Storybook's Vue stories do
export const InATemplate: Story<typeof Badge> = {
  render: (args) => ({ components: { Badge }, setup: () => ({ args }), template: '<Badge v-bind="args" />' })
};
```

A story's listeners are args too (`onRemove`), and the panel records them in Events. A story file checked with `tsc` sees
your `*.vue` shim; `vue-tsc` checks its args against the real component.

| Import | What it is |
|---|---|
| `@forgebook/vue` | `Meta`, `Story`, `Decorator`, `Preview`, `LogicMeta`: CSF 3 typed for Vue, the args from the component's props and slots |
| `@forgebook/vue/vite` | `vue()`, the framework adapter of `forgebook.config.ts`, with Vue's Vite plugin |
| `@forgebook/vue/texts`, `@forgebook/vue/clock` | A story's texts in the catalogue's language, and the story clock, as composables |

## What the catalogue reads

Props, events and slots come from [`vue-component-meta`](https://www.npmjs.com/package/vue-component-meta), so a
`<script setup lang="ts">`, a `defineComponent` and a functional component read the same, and `withDefaults` gives a prop's
default. A `.vue` file has no declaration to hold a comment, so the TSDoc block that opens its script speaks for the
component, with `@module`, `@useWhen` and the other tags. An event is listed as its listener (`onRemove`), a slot as the arg
that fills it (`#default`). `tsconfig.json` files that only list references, as `create-vue` writes them, are followed.

A story's catalogue pages load Vue's full build, so a `template` works in a story; your own app's build is not touched.
Vue's own plugin is the adapter's, so don't add `@vitejs/plugin-vue` to a catalogue. Generated server tests take
`vueRenderer` from `@forgebook/vue/renderer`; the catalogue's `forgebook new`, `forgebook docs --framework vue` and
`forgebook init --from storybook` (from `@storybook/vue3-vite`) read Vue too.

Named slots written Storybook's way, as a bare arg (`header`), reach the component as an attribute: write them `#header`. A
`render` with `v-bind="args"` passes its args as they are, so such a story fills its slots in its own template.
JSX in Vue stories needs `@vitejs/plugin-vue-jsx`, which the adapter does not add. "Used in" follows React's JSX, not Vue
templates, so it lists nothing yet.

The rest of its exports are what the catalogue loads itself. Getting started, the catalogue's features and its commands:
[Forgebook's README](https://github.com/ensiria/forgebook/blob/develop/packages/forgebook/README.md).
