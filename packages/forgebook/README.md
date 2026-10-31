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
- **Switches** for theme, contrast and motion, and the languages you declare; a library adds its own (density, brand)
  through a preset.
- **A toolbar each reader arranges**: whoever uses the catalogue pins the controls they use to the toolbar, orders
  them and hides the rest in the View menu; their browser keeps it ([below](#the-toolbar)).
- **Widths** to draw a story at, and a **compare** view that draws the same story once per value of one or two
  switches (every theme at both contrasts), per text size or per style sheet, side by side.
- **Props from the types**: the API table and the panel's controls come from the component's TypeScript props and
  their TSDoc, nothing written twice.
- **Examples that fill the page**: on a component's page, any story's box opens over the page, at a width of its own,
  without loading its story again.
- **Used in**: a component's page lists the other components whose stories use it, directly or through another
  component (Tree renders Row, Row renders DropLine), each with the stories to open; read from the types, never kept
  by hand. A reader folds it away; `usedIn: false` in the configuration turns it off.
- **Interaction states and motion**: `:hover`, `:active`, `:focus`, `:focus-visible` and `:focus-within` forced on a
  story without a pointer; motion replayed on demand.
- **Packages as sources**: a library ships its stories (`StorySource`), and an app's catalogue lists them beside its
  own, each with its name, logo and texts.
- **`CATALOG.md`** for coding agents: `forgebook docs` writes one dense line per component, hook and helper of a
  package, from its exports, their TSDoc and its stories.
- **Tests from the stories**, with [`@forgebook/testing`](https://www.npmjs.com/package/@forgebook/testing): every
  story in the browser with axe, spills and overlays, screenshots, and every story rendered on the server.

It adds about a dozen packages to a React and Vite project.

## The toolbar

The View menu holds every control: the catalogue's switches, and Forgebook's own (the background, the style sheets, the
text size, the story's width). The catalogue says which start on the toolbar and which it does without; each reader
then pins, orders and hides them, and that arrangement stays in their browser, per catalogue, never in the address
(a link shares the values, not someone's toolbar).

```ts
// forgebook.config.ts
export default defineConfig({
  framework: react(),
  title: "My components",
  stories: ["src/**/*.stories.tsx"],
  // what starts on the toolbar, in this order: a switch's id, or "backdrop", "sheets", "text", "width"
  toolbar: ["theme", "contrast", "width", "text"],
  // Forgebook's own controls this catalogue does without
  controls: { sheets: false }
});
```

Without `toolbar`, the colour scheme, the contrast and the width start there. A control turned off in `controls`
shows nowhere, not even on the toolbar, and keeps its default (the width can still be dragged on the stage). A preset
may set both; the catalogue's `toolbar` wins, and a control is off when any of them turns it off. A name in `toolbar`
that is no control at all stops the catalogue with an error saying which.

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
| `forgebook stories` | Lists every story with its id and links; fails when the story index has problems |
| `forgebook story <id>` | One story: its args, its component's props, its links in a view (`--view theme=dark`) |
| `forgebook new <file>` | Writes a component's first stories from its props: the main story, one per choice, the worst case |
| `forgebook mcp` | Serves the same answers to an agent over the Model Context Protocol |
| `forgebook docs` | Writes a package's `CATALOG.md` and `llms.txt` from its exports, their TSDoc and its stories |
| `forgebook-texts` | Checks a package's story texts and lists what each language still has to translate |

Each command prints its options with `--help`; `stories` and `story` print JSON with `--json`.

## For agents

A coding agent can use the catalogue while it works: find a story's id, read a story's args and its component's
props, and hand a person the link that opens it. Add the MCP server to the project's agent configuration, for
example `.mcp.json` for Claude Code:

```json
{ "mcpServers": { "forgebook": { "command": "npx", "args": ["forgebook", "mcp"] } } }
```

It offers four tools: `list_stories`, `get_story`, `story_address`, and `new_stories`, which writes a component's first stories from its props and answers the text without writing a file. `get_story` also gives the components whose stories use the story's component (`usedIn`), so an agent finds a real use before writing one; `list_stories` gives it for every component when asked (`usedIn: true`, or `forgebook stories --used-in`), since it reads the package's import graph. Run from the catalogue's folder (or give
`--config`), it uses the running `forgebook dev` when there is one, and starts a dev server of its own otherwise,
kept while the agent's session lasts. The links name `http://localhost:5173` unless `--url` (or `FORGEBOOK_URL`) says
where `forgebook dev` runs.

A library tells agents what it offers with `forgebook docs`, run in its folder: `CATALOG.md`, one dense line per
component, hook, helper and style module (what it is, how to import it, its props, the id of a story that shows it),
and `llms.txt`, which points an agent to it. The file's name, its sections and the subpaths left out are set in the
package's `package.json`:

```json
{ "forgebook": { "catalog": { "file": "CATALOG.md", "sections": ["components", "modules"], "exclude": ["./internal/*"] } } }
```

`forgebook docs --check` fails in CI when either file is stale. In CI, `forgebook stories --json` fails on a broken story file (a title taken twice, a title that cannot be placed),
and its JSON lists every story for a script.

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
