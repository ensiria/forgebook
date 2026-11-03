# @forgebook/solid

Solid for [Forgebook](https://www.npmjs.com/package/forgebook): the story types, the primitives, the renderer the frame
mounts a story with, and the adapter that reads a component's props from its TypeScript types.

**Requirements:** Solid 1.9 · `forgebook` · Vite 8 · React in the project, for the catalogue's own interface (the frames
that draw your components load none) · [MIT licence](https://github.com/ensiria/forgebook/blob/develop/packages/solid/LICENSE)

```sh
npm install --save-dev forgebook @forgebook/solid react react-dom
```

The catalogue's configuration names it as its framework:

```ts
// forgebook.config.ts
import { solid } from "@forgebook/solid/vite";
import { defineConfig } from "forgebook";

export default defineConfig({ framework: solid(), title: "My components", stories: ["src/**/*.stories.tsx"] });
```

and the stories take their types from it:

```tsx
import type { Meta, Story } from "@forgebook/solid";

import { Badge } from "./Badge";

export default { title: "Components/Badge", component: Badge } satisfies Meta<typeof Badge>;

export const Default: Story<typeof Badge> = { args: { label: "New" } };

// a render runs once: read the args inside its JSX, or spread them, and each new value reaches the story in place
export const Inline: Story<typeof Badge> = {
  render: (args) => (
    <p>
      Status: <Badge label="" {...args} />
    </p>
  )
};
```

| Import | What it is |
|---|---|
| `@forgebook/solid` | `Meta`, `Story`, `Decorator`, `Preview`, `LogicMeta`: CSF 3 typed for Solid, the args from the component's props |
| `@forgebook/solid/vite` | `solid()`, the framework adapter of `forgebook.config.ts`, with Solid's Vite plugin |
| `@forgebook/solid/texts`, `@forgebook/solid/clock` | A story's texts in the catalogue's language (`useStoryText`), and the story clock as accessors (`useStoryNow()`) |

## What the catalogue does with Solid

A story runs once, as a Solid component does. New args from the panel, Replay or the events do not draw it again: each arg
is a signal of its own, and only what reads it updates, so a counter keeps its count and an open menu stays open. An arg
holds the value the story passed (an option object is that object, not a store's copy). The language, the switches a
decorator reads in `context.globals` and the story clock follow the same way. Read the args where Solid can follow them:
inside JSX or spread, never destructured at the top of a render. A story that reads a resource is ready, for its play
function, once the resource has loaded; what a story or its effects throw is shown in place of the story, and the next
args try it again.

Solid's plugin is the adapter's, so don't add `vite-plugin-solid` to a catalogue: it compiles your stories and
components, refreshes an edited one in its frame, and leaves the catalogue's own React alone.

Generated server tests run on Node, with Solid's server build: in the Vitest configuration they run in, give the plugin
`solid({ ssr: true })` and `environment: "node"`, then take `solidRenderer` from `@forgebook/solid/renderer`. They wait
for a story's resources. `forgebook new`, `forgebook docs --framework solid` and `forgebook init --from storybook` (from
`storybook-solidjs-vite`) read Solid too.

The rest of its exports are what the catalogue loads itself. Getting started, the catalogue's features and its commands:
[Forgebook's README](https://github.com/ensiria/forgebook/blob/develop/packages/forgebook/README.md).
