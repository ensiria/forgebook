# Forgebook

See every component in every theme, contrast, language and width. Write CSF stories, run `forgebook dev`: one frame
per story, switches for theme, contrast, motion and language, and a props table from the components' types.

> **Status:** 0.x, early. Its author's design system runs on it; the API may still change between minor versions,
> and every change is in the
> [changelog](https://github.com/ensiria/forgebook/blob/develop/packages/forgebook/CHANGELOG.md).

**Requirements:** Node 22.18 or later · Vite 8 (the catalogue is built on it; other bundlers are not supported) · React 19 today, through
[`@forgebook/react`](https://www.npmjs.com/package/@forgebook/react); other frameworks plug in through the same
adapter (the catalogue's own interface is React either way) · npm, pnpm, yarn or bun ·
[MIT licence](https://github.com/ensiria/forgebook/blob/develop/packages/forgebook/LICENSE)

## Install

In a project with React and Vite, both packages: `forgebook` is the catalogue, `@forgebook/react` the adapter it draws
React components with.

```sh
npm install --save-dev forgebook @forgebook/react
```

## A first catalogue

A component, with its props typed and documented:

```tsx
// src/Badge.tsx
export type BadgeProps = {
  /** The text. */
  readonly label: string;
  /** How it reads. @defaultValue "neutral" */
  readonly tone?: "neutral" | "success" | "danger";
};

/** A small label beside a title. */
export const Badge = ({ label, tone = "neutral" }: BadgeProps) => (
  <span className={`badge badge--${tone}`}>{label}</span>
);
```

Its stories, in [CSF 3](https://storybook.js.org/docs/api/csf):

```tsx
// src/Badge.stories.tsx
import type { Meta, Story } from "@forgebook/react";

import { Badge } from "./Badge";

export default { title: "Components/Badge", component: Badge } satisfies Meta<typeof Badge>;

/** The label as most pages use it. */
export const Default: Story<typeof Badge> = { args: { label: "New" } };

/** A success. */
export const Success: Story<typeof Badge> = { args: { label: "Paid", tone: "success" } };
```

The catalogue's configuration, beside `package.json`:

```ts
// forgebook.config.ts
import { react } from "@forgebook/react/vite";
import { defineConfig } from "forgebook";

export default defineConfig({
  framework: react(),
  title: "My components",
  stories: ["src/**/*.stories.tsx"]
});
```

Then:

```sh
npx forgebook dev      # the catalogue, live
npx forgebook build    # static files in dist/, for any web server
```

Badge's page shows its stories, each in its own frame, and an API table read from `BadgeProps`: `label` required,
`tone` with its three values and its default, each with its TSDoc.

## What a catalogue gives you

- **One frame per story**, so a story's styles and globals never leak into another, and its address opens it alone.
- **Switches** in the toolbar for theme, contrast and motion, and the languages you declare; a library adds its own
  (density, brand) through a preset.
- **Widths** to draw a story at, and a **compare** view that draws the same story once per value of one or two
  switches (every theme at both contrasts), per text size or per style sheet, side by side.
- **Props from the types**: the API table and the panel's controls come from the component's TypeScript props and
  their TSDoc, nothing written twice.
- **Interaction states and motion**: `:hover`, `:active`, `:focus`, `:focus-visible` and `:focus-within` forced on a
  story without a pointer; motion replayed on demand.
- **Packages as sources**: a library ships its stories (`StorySource`), and an app's catalogue lists them beside its
  own, each with its name, logo and texts.
- **`CATALOG.md`** for coding agents: `forgebook-docs` writes one dense line per component, hook and helper of a
  package, from its exports, their TSDoc and its stories.
- **Tests from the stories**, with [`@forgebook/testing`](https://www.npmjs.com/package/@forgebook/testing): every
  story in the browser with axe, spills and overlays, screenshots, and every story rendered on the server.

It adds about a dozen packages to a React and Vite project.

## Coming from Storybook

Forgebook reads Storybook's story files as they are: CSF 3 and CSF 2 (`Template.bind({})`), titles of any depth and
titles from the file's path, `args` and `argTypes` (with their controls), actions from `fn()` or an `argTypes` action,
`play` with Testing Library (`@testing-library/dom` and `@testing-library/user-event`, optional peers), `loaders`,
`tags` (`!dev`, `!test`) and a story's `globals`.

It does not read MDX, doc blocks or addons. Actions are explicit only: an `on*` prop is not turned into an action by
its name.

## Commands

| Command | What it does |
|---|---|
| `forgebook dev` / `forgebook build` | Runs the catalogue of `forgebook.config.ts`, or builds it into static files |
| `forgebook-docs` | Writes a package's `CATALOG.md` from its exports, their TSDoc and its stories |
| `forgebook-texts` | Checks a package's story texts and lists what each language still has to translate |

Each command prints its options with `--help`.

## Packages

| Package | What it is |
|---|---|
| `forgebook` | The catalogue: the shell, the frame, the Vite plugin, the commands |
| [`@forgebook/react`](https://www.npmjs.com/package/@forgebook/react) | React's story types, renderer and props reader |
| [`@forgebook/story-format`](https://www.npmjs.com/package/@forgebook/story-format) | The story format, for a library whose stories must not depend on a catalogue |
| [`@forgebook/testing`](https://www.npmjs.com/package/@forgebook/testing) | Tests generated from the stories |

## Contributing

Bugs, proposals and pull requests:
[CONTRIBUTING.md](https://github.com/ensiria/forgebook/blob/develop/CONTRIBUTING.md). Security problems:
[SECURITY.md](https://github.com/ensiria/forgebook/blob/develop/SECURITY.md).
