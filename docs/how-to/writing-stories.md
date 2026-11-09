---
title: How-to/Writing stories
order: 1
description: Story files, args and controls, the preview, plays, tags and statuses.
---

# Writing stories

A story file is CSF 3: the default export is the meta, each named export is a story. The types come from your
framework's adapter (`@forgebook/react`, `@forgebook/vue`…); the examples here are React.

## A story file

```tsx
// src/components/Badge.stories.tsx
import type { Meta, Story } from "@forgebook/react";

import { Badge } from "./Badge";

export default { title: "Components/Badge", component: Badge } satisfies Meta<typeof Badge>;

/** The label as most pages use it. */
export const Default: Story<typeof Badge> = { args: { label: "New" }, parameters: { main: true } };

/** A long label, to see how it wraps. */
export const WorstCase: Story<typeof Badge> = {
  args: { label: "A label much longer than any page would give it" },
  parameters: { group: "worst-case" }
};
```

- The one-line TSDoc above a story is the sentence the catalogue shows under it.
- `parameters.main: true` marks the story drawn at the top of the component's page.
- `parameters.group` puts a story under a heading of the page (`"states"`, `"worst-case"`).
- Without a `title`, the title comes from the file's path. A story's id is its source's id, then Storybook's id for
  the title and the export: `stories:components-badge--worst-case` for a catalogue's own stories (their source is
  `stories`), `ui:actions-button--plain` for a package's. `forgebook stories` lists them.
- Write `title`, `parameters.main`, `group` and `height` as plain values: the catalogue reads them without running the
  file.

`forgebook new <component file>` writes a first version of this file from the component's props.

## Which files are stories

`stories` in `forgebook.config.ts` lists globs from the configuration's folder. A glob that starts with `!` leaves files
out:

```ts
stories: ["src/**/*.stories.tsx", "!src/**/drafts/**"]
```

A `**` does not enter a folder whose name starts with a dot; `forgebook stories` names any story file it finds there.
`forgebook build` and `forgebook stories` stop when a pattern matches nothing (see
[troubleshooting](../troubleshooting.md#no-story-file-matches)); `forgebook dev` only warns, so you can start before the
first story.

## Args and controls

The Props tab draws a control for each prop from its TypeScript type, with nothing to write: a text field for a
`string`, buttons or a list for a union of literals, nested fields for objects and lists, JSON for what has no simpler
form. A story can name another control:

```ts
argTypes: {
  note: { control: "textarea" },
  tone: { control: "select", options: ["neutral", "success", "danger"] },
  onClick: { action: "clicked" }
}
```

The values set in the panel stay in the address (`args=`), so a link shares them. A story only receives the props its
panel can set, each with a value of its type; anything else in a link is listed above the story and left out.

The Props tab's **Worst case** button gives every text prop a long text with an unbreakable word, every number a huge
one and every list many items, and outlines what spills out of its parent.

The [panel's controls](../../packages/forgebook/README.md#the-panels-controls) in the reference list every type and
control.

## The preview

`forgebook.preview.ts` (or `.tsx`), beside the configuration, is what every story's frame loads first, as the app's
entry does for the app: global style sheets, and decorators that wrap every story in the providers the app has.

```tsx
// forgebook.preview.tsx
import "./src/index.css";

import type { Preview } from "@forgebook/react";

import { ThemeProvider } from "./src/theme";

export default {
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    )
  ]
} satisfies Preview;
```

`forgebook init` writes the style sheet imports it finds and names the providers, portals and fonts it could not
carry over. A decorator in a file's meta or a story wraps only those stories.

## Plays

A `play` function acts on the story once it is drawn. With `@testing-library/dom` and `@testing-library/user-event`
installed, every play gets `canvas` (Testing Library's queries, bound to the story) and `userEvent`; import
`@forgebook/story-format/testing-library` once to type them.

```tsx
import "@forgebook/story-format/testing-library";

export const Opened: Story<typeof Menu> = {
  play: async ({ canvas, userEvent, step }) => {
    await step("open the menu", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Options" }));
    });
  },
  parameters: { height: 240 }
};
```

- On a dev server a play runs when its story opens. In a build it waits, and the Interactions tab offers **Run**;
  `play: "on"` or `"off"` in the configuration sets that default, and `?play=on` or `?play=off` sets it for one link.
- Tests, `forgebook check` and the MCP tool `check_story` always run every play.
- `parameters.height` gives the frame room for what the play opens (a menu, a popover), in CSS px.
- The Interactions tab lists each step and action, and **Step through** stops before each one.

## Stories that load

A frame waits for what a story loads before it says the story is ready, so checks never read a fallback. With React
(Next.js and React Native too) and Vue (Nuxt too) that is every `Suspense` boundary; with any framework, also each module
the story imports with `import()` while it is first drawn, until it has loaded or failed. The wait lasts up to 10 s. Past
that, the story is `pending`, and `check` and `verify` report it as not verified. Say when that is intended, or give it
longer:

```tsx
export const Loading = { parameters: { suspense: { expected: true } } };
export const Slow = { parameters: { suspense: { timeout: 15_000 } } };
```

## Tags and statuses

Tags work as in CSF, on the preview, a meta or a story; `!name` removes one:

```ts
export default { component: Card, tags: ["review"] } satisfies Meta<typeof Card>;
```

When any story has a tag of its own, the sidebar offers a tag filter. `review`, `experimental` and `deprecated` are
statuses by default and show as badges; `statuses` in the configuration renames them, adds others or turns one off.

## More

- Hooks and functions get stories about logic: `parameters: { logic: true }` on the meta. See
  [hooks and functions](../../packages/forgebook/README.md#hooks-and-functions).
- An API a story fetches from is mocked with [`@forgebook/plugin-msw`](../../packages/plugin-msw/README.md).
- Each adapter's README covers what is specific to its framework: see [frameworks](./frameworks.md).
