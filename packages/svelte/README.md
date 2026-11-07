# @forgebook/svelte

Svelte 5 for [Forgebook](https://www.npmjs.com/package/forgebook): the story types, the context helpers, the renderer the
frame mounts a story with, and the adapter that reads a component's props, snippets and callback props from its types.

**Requirements:** Svelte 5.46 · `forgebook` · Vite 8.3.4+ · React in the project, for the catalogue's own interface (the frames
that draw your components load none) · [MIT licence](https://github.com/ensiria/forgebook/blob/develop/packages/svelte/LICENSE)

```sh
npm install --save-dev forgebook @forgebook/svelte
```

The catalogue's configuration names it as its framework:

```ts
// forgebook.config.ts
import { svelte } from "@forgebook/svelte/vite";
import { defineConfig } from "forgebook";

export default defineConfig({ framework: svelte(), title: "My components", stories: ["src/**/*.stories.ts"] });
```

and the stories take their types from it:

```ts
import type { Meta, Story } from "@forgebook/svelte";

import Badge from "./Badge.svelte";

export default { title: "Components/Badge", component: Badge } satisfies Meta<typeof Badge>;

// the component with its args: its props, its callback props (`onremove`) among them
export const Default: Story<typeof Badge> = { args: { label: "New" } };

// a snippet filled with a text, as `#name`: `#children` is the content
export const WithIcon: Story<typeof Badge> = { args: { label: "New", "#icon": "*", "#children": "Details" } };

// a render, returning the component with props of its choosing, as Storybook's Svelte stories do
export const Danger: Story<typeof Badge> = {
  render: (args) => ({ Component: Badge, props: { ...args, tone: "danger" } })
};
```

A story is written in a `.ts` file, as CSF 3: a render returns a component, drawn with the args, or
`{ Component, props }`. A story that needs markup of its own (a component inside a layout, a `bind:`) is a small
`.svelte` file the render returns. A decorator returns the same, and the story reaches its component as `children`:

```ts
// forgebook.preview.ts
import type { Preview } from "@forgebook/svelte";

import ThemeFrame from "./ThemeFrame.svelte"; // sets its context, then {@render children()}

export default {
  decorators: [(_story, context) => ({ Component: ThemeFrame, props: { theme: context.globals["theme"] } })]
} satisfies Preview;
```

A snippet a story passes itself goes under the prop's own name (`children: createRawSnippet(…)`); the panel edits a
snippet as the text that fills it. The panel records a story's callback props in Events. A story file checked with `tsc`
sees your `*.svelte` shim; `svelte-check` checks its args against the real component.

| Import | What it is |
|---|---|
| `@forgebook/svelte` | `Meta`, `Story`, `Decorator`, `Preview`, `LogicMeta`: CSF 3 typed for Svelte, the args from the component's props |
| `@forgebook/svelte/vite` | `svelte()`, the framework adapter of `forgebook.config.ts`, with Svelte's Vite plugin |
| `@forgebook/svelte/texts`, `@forgebook/svelte/clock` | `getStoryText()`, a story's texts in the catalogue's language; `getStoryClock()` and `getStoryNow()`, the story clock, read as `.current` |

## What the catalogue reads

Props come from the component's types: `svelte2tsx`, which Svelte's language server and `svelte-check` use, writes each
`.svelte` file as TypeScript, so a `$props()` typed in TypeScript and one typed with JSDoc read the same, and the
destructuring gives each prop's default (`$bindable` included). The `<!-- @component -->` comment describes the
component, with `@useWhen` and the other tags; a TSDoc block that opens its script, with `@module`, is its summary. A
snippet is listed as the arg that fills it (`#icon`), a function prop named `on…` as an event, and what the component
passes on to an element (`HTMLAttributes`) is left out. A function with runes in a `.svelte.ts` module is documented by its
signature in a story about logic (`LogicMeta`).

Svelte's own plugin is the adapter's, and it reads your `svelte.config.js`, so don't add `@sveltejs/vite-plugin-svelte` to
a catalogue; in a Vite or Vitest configuration of your own that already has it, add `forgebookPlugin` without the
adapter's `vitePlugins()`. `svelte({ plugin })` passes options to Svelte's plugin, over what it reads from
`svelte.config.js`; they are `@sveltejs/vite-plugin-svelte`'s own, so they follow its major version. A SvelteKit app's components, which read `$app/*`, are drawn by
[`@forgebook/sveltekit`](https://www.npmjs.com/package/@forgebook/sveltekit), built on this adapter. The frame says a story is drawn once Svelte has settled, so a component that awaits (`experimental.async`)
is drawn before its play runs. Generated server tests take `svelteRenderer` from `@forgebook/svelte/renderer` and run in
Node (`environment: "node"`), since Svelte compiles a component apart for the server; the catalogue's
`forgebook new`, `forgebook docs --framework svelte` and `forgebook init --from storybook` (from `@storybook/svelte-vite`)
read Svelte too.

A snippet made from a text is drawn in a `span`, since Svelte draws a snippet made outside a component from one element.
Stories written in `.stories.svelte` files (Svelte CSF) are not read: write them in CSF 3, as above. "Used in" follows
React's JSX, not Svelte markup, so it lists nothing yet.

The rest of its exports are what the catalogue loads itself. Getting started, the catalogue's features and its commands:
[Forgebook's README](https://github.com/ensiria/forgebook/blob/develop/packages/forgebook/README.md).
