# @forgebook/react

React for [Forgebook](https://www.npmjs.com/package/forgebook): the story types, the renderer the frame mounts a story
with, and the adapter that reads a React component's props from its TypeScript types.

**Requirements:** React 18.2 or 19 · `forgebook` · Vite 8.3.4+ · [MIT licence](https://github.com/ensiria/forgebook/blob/develop/packages/react/LICENSE)

```sh
npm install --save-dev forgebook @forgebook/react
```

The catalogue's configuration names it as its framework:

```ts
// forgebook.config.ts
import { react } from "@forgebook/react/vite";
import { defineConfig } from "forgebook";

export default defineConfig({ framework: react(), title: "My components", stories: ["src/**/*.stories.tsx"] });
```

`react()` brings React's Vite plugin, with Fast Refresh; a library whose files need it configured passes its options,
as `react({ include: /\.[jt]sx?$/ })` for JSX in `.js` files. Leave the plugin to the adapter rather than adding your own:
the adapter's plugins around it redraw an edited component sooner.

and the stories take their types from it:

```tsx
import type { Meta, Story } from "@forgebook/react";

import { Badge } from "./Badge";

export default { title: "Components/Badge", component: Badge } satisfies Meta<typeof Badge>;

export const Default: Story<typeof Badge> = { args: { label: "New" } };
```

| Import | What it is |
|---|---|
| `@forgebook/react` | `Meta`, `Story`, `Decorator`, `Preview`: CSF 3 typed for React, the args from the component's props |
| `@forgebook/react/vite` | `react()`, the framework adapter of `forgebook.config.ts`; it takes `@vitejs/plugin-react`'s options, as `react({ include: /\.[jt]sx?$/ })` to give Fast Refresh to `.js` files |
| `@forgebook/react/texts`, `@forgebook/react/clock` | A story's texts in the catalogue's language, and the story clock, as hooks |

The rest of its exports are what the catalogue loads itself. Getting started, the catalogue's features and its
commands: [Forgebook's README](https://github.com/ensiria/forgebook/blob/develop/packages/forgebook/README.md).
