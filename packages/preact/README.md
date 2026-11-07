# @forgebook/preact

Preact for [Forgebook](https://www.npmjs.com/package/forgebook): the story types, the hooks, the renderer the frame mounts
a story with, on Preact itself, and the adapter that reads a component's props from its TypeScript types.

**Requirements:** Preact 10.19 or 11 · `forgebook` · React 18.2 or 19 in the project, for the catalogue's own interface (the
frames that draw your components load none) · [MIT licence](https://github.com/ensiria/forgebook/blob/develop/packages/preact/LICENSE)

```sh
npm install --save-dev forgebook @forgebook/preact react react-dom
```

The catalogue's configuration names it as its framework:

```ts
// forgebook.config.ts
import { preact } from "@forgebook/preact/vite";
import { defineConfig } from "forgebook";

export default defineConfig({ framework: preact(), title: "My components", stories: ["src/**/*.stories.tsx"] });
```

and the stories take their types from it:

```tsx
import type { Meta, Story } from "@forgebook/preact";
import { useState } from "preact/hooks";

import { Badge } from "./Badge";

export default { title: "Components/Badge", component: Badge } satisfies Meta<typeof Badge>;

export const Default: Story<typeof Badge> = { args: { label: "New" } };

// a render may call hooks: it runs as a component of its own
export const Counting: Story<typeof Badge> = {
  render: (args) => {
    const [count, setCount] = useState(0);
    return <Badge {...args} count={count} onRemove={() => setCount(count + 1)} />;
  }
};
```

Your `tsconfig.json` says which JSX the stories are written in, as Preact's guide writes it:
`"jsx": "react-jsx", "jsxImportSource": "preact"`. Vite reads it for each file, so the catalogue's own React keeps its JSX.
A runtime named in the Vite configuration instead (`oxc.jsx.importSource`) is kept as you wrote it, for every file.

| Import | What it is |
|---|---|
| `@forgebook/preact` | `Meta`, `Story`, `Decorator`, `Preview`, `LogicMeta`: CSF 3 typed for Preact, the args from the component's props |
| `@forgebook/preact/vite` | `preact()`, the framework adapter of `forgebook.config.ts`, with Preact's refresh |
| `@forgebook/preact/texts`, `@forgebook/preact/clock` | A story's texts in the catalogue's language, and the story clock, as hooks |

## What the catalogue does with Preact

The stories are drawn by Preact, not by React through `preact/compat`: no alias of `react`, so the catalogue's interface
keeps React and your components keep Preact's own hooks, signals and context. A function component and a class component
read the same: the props from the first parameter's type (or the class's), events as `on*` props. New args render the
story again and Preact keeps its state; an edited component updates in its frame through Prefresh. A story's render runs
as a component of its own, so it may call hooks, and what it throws, or what an effect throws, is shown in place of the
story. Generated server tests take `preactRenderer` from `@forgebook/preact/renderer`; they wait for what a story suspends
on (`lazy`). `forgebook new`, `forgebook docs --framework preact` and `forgebook init --from storybook` (from
`@storybook/preact-vite`) read Preact too.

The rest of its exports are what the catalogue loads itself. Getting started, the catalogue's features and its commands:
[Forgebook's README](https://github.com/ensiria/forgebook/blob/develop/packages/forgebook/README.md).
