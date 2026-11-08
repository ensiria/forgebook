---
title: How-to/Monorepos
order: 9
description: One catalogue for several packages, each handing over its stories as a source.
---

# Monorepos

Each package hands its stories to one catalogue: a package of its own that imports nothing from the libraries but
their `stories` export.

A library writes a source and exports it:

```ts
// packages/ui/stories.ts
/// <reference types="@forgebook/story-format/client" />
import type { StorySource } from "@forgebook/story-format/source";

import files from "./src/**/*.stories.tsx?forgebook-files";

export const source: StorySource = { id: "ui", name: "UI", files: [files] };
```

```jsonc
// packages/ui/package.json
{ "exports": { "./stories": "./stories.ts" } }
```

The catalogue depends on each package and lists their sources; `watch` lets the dev server see story files added to
them:

```ts
// apps/catalogue/forgebook.config.ts
export default defineConfig({
  framework: react(),
  title: "Acme",
  sources: ["@acme/ui/stories", "@acme/charts/stories"],
  watch: ["../../packages/ui/src", "../../packages/charts/src"]
});
```

- A story's id starts with its source's (`ui:actions-button--plain`), so two packages can both have a `Button`.
- Props are read through the `tsconfig.json` that holds the story file.
- A source can also give docs pages, design tokens and texts; see [monorepos](../../packages/forgebook/README.md#monorepos)
  in the reference.

`forgebook init` in a workspace runs in the package that holds the components; `init --agents` writes the agents'
files at the repository's root, pointing at that package.
