<a href="https://forgebook.dev"><img src="https://forgebook.dev/logo.svg" alt="Forgebook" width="64" height="64"></a>

# Forgebook

See every component in every theme, contrast, language and width. Write CSF stories, run `forgebook dev`: one frame
per story, switches for theme, contrast, motion and language, and a props table from the components' types.

> **Status:** 0.x, early. Its author's design system runs on it; the API may still change between minor versions,
> and every change is in the
> [changelog](https://github.com/ensiria/forgebook/blob/develop/packages/forgebook/CHANGELOG.md).

**Requirements:** Node 22.18 or later · Vite 8 (the catalogue is built on it; other bundlers are not supported) · React 19 through
[`@forgebook/react`](https://www.npmjs.com/package/@forgebook/react), Vue 3.5 through
[`@forgebook/vue`](https://www.npmjs.com/package/@forgebook/vue) (a Nuxt project's through
[`@forgebook/nuxt`](https://www.npmjs.com/package/@forgebook/nuxt)), Svelte 5 through
[`@forgebook/svelte`](https://www.npmjs.com/package/@forgebook/svelte) (a SvelteKit app's through
[`@forgebook/sveltekit`](https://www.npmjs.com/package/@forgebook/sveltekit)), Solid 1.9 through
[`@forgebook/solid`](https://www.npmjs.com/package/@forgebook/solid), Preact 10.19 or 11 through
[`@forgebook/preact`](https://www.npmjs.com/package/@forgebook/preact), Web Components with Lit 3 through
[`@forgebook/web-components`](https://www.npmjs.com/package/@forgebook/web-components), Angular 20 to 22 (Analog
included) through [`@forgebook/angular`](https://www.npmjs.com/package/@forgebook/angular), a Next.js project's
components through [`@forgebook/nextjs`](https://www.npmjs.com/package/@forgebook/nextjs), React Native through
react-native-web with [`@forgebook/react-native-web`](https://www.npmjs.com/package/@forgebook/react-native-web), or no
framework at all
through [`@forgebook/html`](https://www.npmjs.com/package/@forgebook/html) (stories that return an HTML string or a DOM
node); other frameworks plug in through the same adapter (the catalogue's own interface is React either way, and the
frame of a story in another framework loads none) · npm, pnpm, yarn or bun ·
[MIT licence](https://github.com/ensiria/forgebook/blob/develop/packages/forgebook/LICENSE)

## Install

In a project with React and Vite, both packages: `forgebook` is the catalogue, `@forgebook/react` the adapter it draws
React components with. On Vue, Svelte, Solid, Preact or Angular, `@forgebook/vue`, `@forgebook/svelte`,
`@forgebook/solid`, `@forgebook/preact` or `@forgebook/angular` takes its place, `@forgebook/nuxt` in a Nuxt project,
`@forgebook/sveltekit` in a SvelteKit app,
`@forgebook/web-components` for custom elements, and `@forgebook/html` for stories written in plain JavaScript or
TypeScript with no framework: each README has the configuration and the stories.

```sh
npm install --save-dev forgebook @forgebook/react
```

What Forgebook keeps between runs lives in `node_modules/.vite`, beside Vite's pre-bundled dependencies: Node's compile
cache of the `forgebook` command in `node_modules/.vite/forgebook/compile`, and what a dev server read of the stories in
`node_modules/.vite/forgebook/{docs,usage,code,index}`: each component's props, "Used in", a story file's code and the
sidebar's index, kept with the files they were read from, so a later start answers without reading the components with
TypeScript until one of those files, a configuration or the lock file changes. Removing `node_modules/.vite` starts from
nothing.

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
- **Edits drawn in place**: an edited story file, preview or component is drawn anew in its open frame, which keeps
  what you did in the story (a typed field, an open menu); a story with a play, loaders or set-ups runs them again. An
  edit that adds, renames or retitles a story reloads the pages, as an edit of an Angular story file does. Where the
  system's change events come late or never (a container's mounted volume, a Windows drive under WSL, a network
  drive), `forgebook dev --poll` checks the files itself.
- **Switches** for theme, contrast and motion, and the languages you declare; a library adds its own (density, brand)
  through a preset. A direction switch draws every story right to left, and a language declared `dir: "rtl"` does
  it by itself.
- **A toolbar each reader arranges**: whoever uses the catalogue pins the controls they use to the toolbar, orders
  them and hides the rest in the View menu; their browser keeps it ([below](#the-toolbar)).
- **A light and a dark catalogue**: the reader picks Light, Dark or System at the sidebar's foot (their browser keeps
  it); `appearance` in the configuration sets the default. The stories keep their own theme, from the view's switches.
- **Keys and named views**: a key cycles a control's values (`t` the theme, Shift+`t` back); the catalogue sets the
  key of any control (`keys: { width: "w" }`), a reader changes theirs in the View menu. The View menu's values are
  saved under a name and picked again; `views` in the configuration offers some to every reader. A dot marks each
  control whose value is not its default.
- **Touch on the computer**: the Touch switch turns the mouse into a finger for the stories, two with Shift
  ([below](#touch)); `forgebook dev --touch` opens Chromium with its real touch emulation.
- **Hooks and functions**: stories about logic, not looks, document a hook with its signature first
  ([below](#hooks-and-functions)).
- **Widths** to draw a story at, and a **compare** view that draws the same story once per value of one or two
  switches (every theme at both contrasts), per text size or per style sheet, side by side.
- **Props from the types**: the API table and the panel's controls come from the component's TypeScript props and
  their TSDoc, nothing written twice.
- **Props in groups**: a component with many props lists them under the groups their TSDoc names (`@group Paging`),
  and a prop typed with a documented object (`texts?: FinderTexts`) unfolds to list its members
  ([below](#props-in-groups)).
- **Shared values, checked**: the values set in the Props tab stay in the address (`args=`), so a link shares them.
  Since whoever writes a link chooses them, a story receives only the props it declares (its component's props, its
  `argTypes`, its own args) that the panel lets a person set, each with a value of that prop's type; anything else
  (`onclick`, `innerHTML`, a text for a number) is left out and listed above the story, with a button that removes it
  from the address. A value that is code never comes from a link.
- **The worst case in one press**: the Props tab's Worst case button gives every text prop a long text with a word too
  long to break and every number a huge one, kept in the address; the elements that then spill out of their parents
  are outlined and counted, as the browser tests find them. Reset undoes it.
- **Examples that fill the page**: on a component's page, any story's box opens over the page, at a width of its own,
  without loading its story again.
- **Used in**: a component's page lists the other components whose stories use it, directly or through another
  component (Tree renders Row, Row renders DropLine), each with the stories to open; read from the types, never kept
  by hand. It shows only when there is such a use; a reader folds it away; `usedIn: false` in the configuration turns
  it off.
- **The design beside the code**: a component's or a story's Figma link gives it a link to Figma and, with
  `@forgebook/plugin-figma`, a Design tab and a side-by-side view ([below](#design-links)).
- **Interaction states and motion**: `:hover`, `:active`, `:focus`, `:focus-visible` and `:focus-within` forced on a
  story without a pointer; motion replayed on demand.
- **Packages as sources**: a library ships its stories (`StorySource`), and an app's catalogue lists them beside its
  own, each with its name, logo, texts and design tokens.
- **Docs pages**: guides and foundations in Markdown, with live stories inside, in a section of their own above the
  components ([below](#docs-pages)).
- **`CATALOG.md`** for coding agents: `forgebook docs` writes one dense line per component, hook, helper, design token
  and docs page of a package, from its exports, their TSDoc, its stories and its source.
- **Tests from the stories**, with [`@forgebook/testing`](https://www.npmjs.com/package/@forgebook/testing): every
  story in the browser with axe, spills and overlays, screenshots, and every story rendered on the server.

It adds about a dozen packages to a React and Vite project.

## The toolbar

The View menu holds every control: the catalogue's switches, and Forgebook's own (the background, the style sheets, the
text size, the story's width, [who a page is read by](#who-reads-a-page)). The catalogue says which start on the toolbar and which it does without; each audience
then pins, orders and hides them, and that arrangement stays in their browser, per catalogue, never in the address
(a link shares the values, not someone's toolbar).

```ts
// forgebook.config.ts
export default defineConfig({
  framework: react(),
  title: "My components",
  stories: ["src/**/*.stories.tsx"],
  // what starts on the toolbar, in this order: a switch's id, or "backdrop", "sheets", "text", "width", "audience"
  toolbar: ["theme", "contrast", "width", "text"],
  // Forgebook's own controls this catalogue does without (direction: false drops the direction switch)
  controls: { sheets: false }
});
```

Without `toolbar`, the colour scheme, the contrast, the width and the device start there. A control turned off in `controls`
shows nowhere, not even on the toolbar, and keeps its default (the width can still be dragged on the stage). A preset
may set both; the catalogue's `toolbar` wins, and a control is off when any of them turns it off. A name in `toolbar`
that is no control at all stops the catalogue with an error saying which.

## Touch

The Touch switch (in View, `m` by default) lets a story be tried as on a phone, from the computer:

- the story receives a finger's events: `pointerdown`/`move`/`up` of the `touch` type and, in Chromium,
  `touchstart`/`move`/`end`; a tap clicks, a press held half a second opens the context menu;
- its CSS answers as a phone's: `(hover: none)` and `(pointer: coarse)` match, the mouse's `:hover` does not;
  `navigator.maxTouchPoints` says 5;
- the cursor is a round dot; Shift fixes a centre, and a press then puts a second finger mirrored around it, so a drag
  pinches and rotates;
- a drag scrolls what it can, as the `touch-action` on the way allows, and flings on.

A story reads the switch in its globals (`context.globals.touch`, `"mouse"` or `"touch"`) to draw only the version
that fits the pointer, and follows the switch live; a story fixes it with `globals: { touch: "touch" }`.

A story meant for a phone says so with `parameters: { touch: true }` (on the meta, for every story of the file; a
story's own `false` leaves it out). It starts touched with a finger whatever the switch says, and a Touch toggle on
its example's bar turns that off for it; on its own page, the Touch switch is the story's. The choice lasts while the
catalogue is open, and the address keeps the switch the other stories follow.

**It is a simulation.** Events made by a page are not trusted, so the browser's own reactions do not follow them:
its native scrolling (the drag's scrolling is an approximation, without the rubber band), focus and selection from a
touch, and `touch-action` applied by the browser. In Safari and Firefox the stories get pointer events only (only
Chromium lets a page build touch events). A virtual keyboard, the viewport shrinking under it, safe areas and real iOS
Safari need a device. For real touch events and native scrolling, `forgebook dev --touch` opens the catalogue in a
Chromium window with Chromium's own touch emulation (it needs `@forgebook/testing` and Playwright, as `check` does).
`controls: { touch: false }` takes the switch away.

## Devices

At phone and tablet sizes a story can be shown inside a drawn device, as a browser's device mode shows a page. The
Device control (on the toolbar after the width, and in View beside Touch) says what is shown, "No frame" or the model,
turns the frame off or picks a model; while a device is shown, a button beside it turns it on its side, and the
width's presets wait, since the device sets the width. The story gets
the model's real viewport (its width and its height), the screen's rounded corners clip it, and the status bar, the
camera's cut and the home indicator sit over it where the device has them. The choice is in the address
(`forgebook.device=pixel-9&forgebook.orientation=landscape`, under Forgebook's name so a catalogue's own `device` or
`orientation` switch keeps its parameter), so a link shares it; the compare view puts a device in each cell. The
control's id, for a configuration's `toolbar` and `controls`, is the same: `controls: { "forgebook.device": false }`
takes it away (a story's own default still frames it).

A story in a device is touched with the catalogue's simulated finger, as a phone is (see Touch below): the reader can
turn that off for it, as for a story marked for a phone, and a device that should keep the mouse says
`touch: false`.

| Model | Id | Viewport |
|---|---|---|
| iPhone 16 | `iphone-16` | 393 × 852 |
| iPhone 16 Pro Max | `iphone-16-pro-max` | 440 × 956 |
| iPhone 16e | `iphone-16e` | 390 × 844 |
| Pixel 9 | `pixel-9` | 412 × 923 |
| Galaxy S24 | `galaxy-s24` | 360 × 780 |
| Generic phone | `phone` | 360 × 800 |
| iPad mini | `ipad-mini` | 744 × 1133 |
| iPad Pro 13″ | `ipad-pro-13` | 1032 × 1376 |

The story is drawn inside the device's safe areas, as a page in a phone's browser is: the status bar, the camera's cut
and the home indicator take their room around it (59 and 34 px on an iPhone 16 upright, the sides on its side), and
the story's viewport is what is left (393 × 759). A story that draws edge to edge, as a full-screen app does, says
`edgeToEdge: true`: it gets the whole screen, and the frame tells it the safe areas as custom properties on its root,
`--forgebook-safe-area-top`, `-right`, `-bottom` and `-left`, since browsers keep `env(safe-area-inset-*)` at zero in
a frame. Read them with the real insets as the fallback, so the same CSS works on a phone:

```css
.screen {
  padding-top: var(--forgebook-safe-area-top, env(safe-area-inset-top));
}
```

An id names a model for good: it is never renamed or removed, and a new model gets a new id.

A story meant for a device says so, on its page and on its component's page:

```tsx
export default {
  title: "Screens/Settings",
  component: Settings,
  // every story of the file in an iPhone 16; a story's own fields win
  parameters: { device: { frame: true, model: "iphone-16" } }
} satisfies Meta<typeof Settings>;

export const Landscape: Story<typeof Settings> = { parameters: { device: { orientation: "landscape" } } };

// under the status bar, padded with the safe areas the frame tells it
export const FullScreen: Story<typeof Settings> = { parameters: { device: { edgeToEdge: true } } };

// in the iPhone, with the mouse
export const Pointer: Story<typeof Settings> = { parameters: { device: { touch: false } } };
```

A catalogue sets the default under every story with `device` in its configuration (`device: { model: "pixel-9" }`
only picks the model the button turns on). Nothing is framed for a catalogue and a story that set nothing. The reader's
choice wins over both: turned off, a framed story shows without its device.

The device is the shell's: the story's own document is the same, so the generated tests and `forgebook shot` stay
unframed, unless a view names a model (`forgebook shot <id> --view "iphone-16"`, or `"dark pixel-9 landscape"`), which
gives the picture framed (`portrait` and `landscape` need a model beside them; a catalogue's switch with a value
named like a model keeps the word, so write `forgebook.device=phone` then). The drawing and its styles load the first time a device is shown.

## Hooks and functions

A story can be about logic, not looks: a small scene that uses a hook or a function, there to document and try what it
does. It says so with `parameters: { logic: true }`, on the meta for every story of the file (a story's own `false`
leaves it out), written plainly: only the index reads it, so one written by code is a problem. Its meta's `component`
is the hook or the function, and each story has a `render` that draws its scene. In React, `LogicMeta` and `LogicStory` type
it (`@forgebook/react`):

```tsx
import type { LogicMeta, LogicStory } from "@forgebook/react";

import { useUndo } from "./useUndo";

export default { title: "Hooks/useUndo", component: useUndo, parameters: { logic: true } } satisfies LogicMeta<
  typeof useUndo
>;

/** A counter whose steps can be undone and redone. */
export const History: LogicStory = { render: () => <Counter />, play: async ({ canvasElement }) => { /* … */ } };
```

The catalogue marks it in the sidebar and beside its title; the component's page shows the call, a table of the
parameters (their types and `@param` texts) and the return value (`@returns`) in place of a props table; the story's
panel opens on Signature, with no tab of args (its scene takes none), and the bar puts away what only changes the looks
(the colour scheme, the contrast, the style sheets, the text size, the backdrop; the View menu still offers them) and
Compare: the story is drawn once, never compared. A section of its own is a title's
first segment, as for any component (`Hooks/useUndo` is under Hooks; the source's `families` orders the sections).
`@forgebook/testing` tests it once, not in every look, and takes no reference image of it.

## Who reads a page

A component's page holds what a designer, a coder and a tester each want, in an order that suits none of them. **Reading
for**, in the View menu, draws the same page for one of them. It is not another page: the frames stay where they are and
keep their state, and what goes around them is reordered and filtered.

| Reading for | First | Left out | Added |
|---|---|---|---|
| Everyone | The page as it always was | Nothing | Nothing |
| Designers | When to use it, then a larger demo | Code, the API reference, the sections on parts and test ids | Docs pages that show it, its design tokens |
| Coders | The API reference, parts and styling | Nothing | Every example's code, open |
| Testers | What the stories cover: each story, its group, its play function, whether the generated tests run it | The API reference, sections that are not about testing, "Used in" | A check of every story's accessibility, on request |

The address keeps it (`?component=…&audience=designer`), so a link opens the page as it was read, and the page says so with
a way back to all of it; it is not part of a named view, which holds how stories are drawn. A catalogue can start with another audience, pin the control, give it a key or do without it:

```ts
// forgebook.config.ts
export default defineConfig({
  framework: react(),
  title: "My components",
  stories: ["src/**/*.stories.tsx"],
  audience: "designer",
  toolbar: ["theme", "audience"],
  keys: { audience: "r" }
});
```

With `controls: { audience: false }` the catalogue's `audience` is the only one, whatever an address says, and the page
offers no way back. Names change
through `strings` (`"audiences.coder": "Developers"`, and `"audienceTexts.coverage"` for what the pages add).

A designer's guidance comes from the component's TSDoc (`@useWhen`, `@avoidWhen`, `@alternatives`, `@deprecated`,
`@replacedBy`). Tokens are those named after the component (`select.border`, `component.select.height`), the rest closed
under them, and load only when such a page is drawn. A play function is noted when the file writes it for the story: its
own, the meta's, or from a story of the file it spreads. In a documentation file, sections are told apart by the English
words of their `##` headings: parts, styling, test ids, hooks, API and props are left out for a designer, with every code
block; a tester gets accessibility, keyboard, states and test ids, or the whole file when no heading says any of them.

## Props in groups

A component with forty props reads better in groups. Name a prop's group in its TSDoc, with the `@group` tag TypeDoc
reads too:

```tsx
export type FinderProps = {
  /** The query. */
  readonly query?: string;
  /**
   * The page shown.
   *
   * @group Paging
   */
  readonly page?: number;
  /**
   * The texts it shows, for a translation.
   *
   * @group Texts
   */
  readonly texts?: FinderTexts;
};
```

- The API reference lists the props that name no group first, then each group under its name, in the order the
  groups first appear among the props; the events keep their own heading after them. The Props tab does the same: the
  props that name no group by control, as before, then each group with its controls, its toggles and the props it
  cannot set.
- Every group starts open; a reader folds one away from its name.
- To show some groups first, name them in order: `propGroups: ["Selection", "Paging"]` in the configuration for every
  component, or `parameters: { propGroups: ["Texts"] }` in a component's meta, written as a list of plain strings.
  The meta's come first, then the configuration's, then the rest as they appear. Nothing named, nothing changes.
- A prop whose type is an object the package declares, with TSDoc on at least one member (`FinderTexts`), has a
  "members" button beside its type: it lists the members under the row, with their types, defaults and TSDoc. Only one
  level, and only once unfolded, so large text types cost the page nothing until read.
- With `eslint-plugin-tsdoc`, declare the tag in your `tsdoc.json`:
  `{ "tagName": "@group", "syntaxKind": "block", "allowMultiple": false }`.

## Docs pages

Guides, foundations and recipes are Markdown files with a little front matter, not MDX: a page is read at build time, and
nothing is compiled in the browser. A project lists them in its configuration (`docs: ["docs/**/*.md"]`); a
library gives them with its source, so every catalogue that shows it gets them:

```ts
// packages/ui/stories.ts
import docs from "./docs/**/*.md?forgebook-docs-pages";
import files from "./src/**/*.stories.tsx?forgebook-files";

export const source: StorySource = { id: "acme", name: "Acme UI", files: [files], docs: [docs], sheets };
```

A page says where it goes, then writes what it has to say; a fence named `story` draws a story in its frame, one named
`props` a component's API table from its types:

````md
---
title: Guides/Theming
order: 2
description: How the library follows the catalogue's theme.
---

The buttons read their colours from the page's theme.

```story acme:actions-button--primary
```

## The props

```props acme:actions-button
```

See [the colours](./colours.md#brand), or [every state](?component=acme:actions-button).
````

- `title` places the page: `Guides/Theming` is a page of the group Guides. Without one, the file's opening `#` heading
  or its name; `order` sorts the pages, lower first, then the pages without one by title. The address is
  `?page=acme:guides-theming`, and a heading's anchor follows it (`#the-props`), made as GitHub makes them.
- Stories load as they come near, follow the view's switches live, and keep their bar: their code, their box over the
  page, a link to their own page. A story of another source works too: the id is the whole one `forgebook stories` lists.
- A link to another page is written to its file (`./colours.md#brand`), so it works in the repository too. Images are
  relative to the file, and go through the build. A fence must sit at the page's top level, not inside a list or a quote.
- The page gets its look from the shell's palette, so a `shell.theme` and both appearances reach it; a page with two
  headings or more lists them beside its text, or above it on a narrow page.
- `forgebook stories` fails when a page names a story or a component that is not there, a link leads to no page, or an
  image is not a file of its package, so a rename never breaks a page unseen.
- A page is trusted as a story's code is: Markdown lets it hold raw HTML, which runs in the catalogue. Review one as you
  review code, and do not build a catalogue from pages you did not write.

## Design links

A component carries its own link to Figma, on its meta; a story with a design of its own writes it over the meta's:

```ts
export default {
  title: "Actions/Button",
  component: Button,
  parameters: { design: { figma: "https://www.figma.com/design/AbC123/Kit?node-id=12-34" } }
} satisfies Meta<typeof Button>;

export const Danger: Story<typeof Button> = {
  parameters: { design: { figma: "https://www.figma.com/design/AbC123/Kit?node-id=56-78" } }
};
```

The component's header then links to Figma. With [`@forgebook/plugin-figma`](https://www.npmjs.com/package/@forgebook/plugin-figma)
listed in `plugins`, the story's panel has a **Design** tab with the node embedded and **Compare with the story**, the
story and its design side by side over the page, at the story's width and with the panel's values. Comparing is for your
eyes: Forgebook draws no overlay and gives no match percentage, because Figma and a browser render differently and such a
number would mislead. The tab loads, with Figma, only when opened. A docs page shows a design with a fence named `figma`, its
link after the name.

Write the link plainly, as a string: the index reads it without running the file, so a link written by code is a problem.
A link that is not `https` on `figma.com`, or does not name a `design`, `file`, `proto`, `board`, `slides` or `deck`, is
reported with the index's problems and never embedded; the component keeps its stories. What is kept of a link is its
file, branch and node, so a shared link's other parameters are dropped. A `design` parameter without
`figma` (Storybook's design addon uses the same name) is left alone.

Nothing here needs a Figma token: the embed shows what the reader's own Figma session or the file's sharing allows, and
a private file asks them to sign in, inside the embed. That sign-in needs the browser's storage access, so a reader who
blocks it uses Open in Figma. A catalogue published with a Content Security Policy allows
`frame-src https://embed.figma.com https://www.figma.com`. Turn the tab off with `tabs: { figma: false }`; the header's link stays.

`forgebook story` and `get_story` return `design`: the link, the `fileKey` and `nodeId` a Figma tool takes, and the
`address` of the Design tab to hand a person (it opens the story alone without the plugin). `list_stories` gives each component's, and `CATALOG.md` lists it.

## Coming from Storybook

Forgebook reads Storybook's story files as they are: CSF 3 and CSF 2 (`Template.bind({})`), titles of any depth and
titles from the file's path, `args` and `argTypes` (with their controls), actions from `fn()` or an `argTypes` action,
`play` with Testing Library (`@testing-library/dom` and `@testing-library/user-event`, optional peers), `loaders`,
`tags` (`!dev`, `!test`), a story's `globals`, JSX in `.js` story files (listed and shown as code; Vite compiles JSX only in
`.jsx` and `.tsx`, so such a library adds the plugin its own Storybook uses for them, through the framework's plugins),
hooks in a `render` or a decorator (React and
Preact, with the story's state kept when a decorator draws `<Story />`), a preview's named exports beside its default
export, and the text values of its `globalTypes` defaults and `initialGlobals`, which its decorators read. The answers
to tools and agents read a preview's args and parameters on the server: a package it imports that only a browser can
load (Storybook's docs blocks, which read `document` as they load) is left as a placeholder there, which the preview can
keep in a parameter or call (an addon's factory) but not read. A preview that still cannot load (it reads one, or one of
its own files reads `document`) leaves the answers working: it is left out of them and named among their problems. A
`**` pattern skips `node_modules` unless it names it.

It lists what Storybook's indexer lists:

- every named export as a story, whatever writes its value: an object, a function, a helper's result
  (`export const Chromatic = storiesFor(…)`), another constant (`export const Default: StoryFn = Template`) or a
  re-export (`export { A as B }`, from the file or another module); `includeStories` and `excludeStories` leave some
  out, as there;
- the meta written in place or held in a constant (`export default meta`, `export { meta as default }`);
- files with one title as one component: its stories come from every file, in the order of their paths, each with its
  own file's meta, and its page takes the first file's docs and documentation file. Two stories with one id are a
  problem, and the second is left out;
- Storybook's ids, so a link carries over: `inputs-readmore--open-by-default` for the title `Inputs/ReadMore` and the
  export `OpenByDefault`, the meta's `id` in place of its title, and a story's own `parameters.__id`. An address,
  `forgebook story`, `forgebook check` and the MCP tools still take the ids Forgebook gave before it followed
  Storybook's (`inputs-read-more--open-by-default`), and open the story under its own; a picture stored under such an
  id still counts as the story's baseline until `forgebook shot --update` stores one under its id.

A story without a `name` is named from its export's words as Storybook splits them, in sentence case
(`CustomSVGIcon` → "Custom SVG icon").

A component's props are read with the configuration an editor reads its story file with: the nearest `tsconfig.json`
up the file's folders that holds it, or a project it references. A monorepo whose packages hold only their sources
and whose root holds the stories, with the paths to the packages' sources, gets its props tables as Storybook does.

It does not read MDX, doc blocks or addons. Actions are explicit only: an `on*` prop is not turned into an action by
its name.

To try it on a Storybook project, run `npx forgebook init --from storybook` in the folder that holds `.storybook`. It
writes `forgebook.config.ts`: the story globs of `main` (the MDX pages left out), the preview as Forgebook's preview,
and a switch for each toolbar global of the preview, applied by code as its decorators expect. `main` is loaded, so a
computed `stories` list is read too; the preview is read from its source, so only `globalTypes` written as plain values
become switches. It reads React, Vue, Svelte, Preact, Solid, Web Components and plain HTML on Vite
(`@storybook/react-vite`, `@storybook/vue3-vite`, `@storybook/svelte-vite`, `@storybook/sveltekit` (whose
`sveltekit_experimental` parameters `@forgebook/sveltekit` reads as they are),
`@storybook/preact-vite`, `storybook-solidjs-vite`, `@storybook/web-components-vite`, `@storybook/html-vite`, and
Nuxt's `@storybook-vue/nuxt`), Angular (`@storybook/angular`, `@analogjs/storybook-angular`, with the TypeScript
configuration its stories were compiled with) and Next.js (`@storybook/nextjs-vite`, and `@storybook/nextjs` on webpack,
whose stories are the same), never replaces a configuration without `--force`, and lists what it left out. A Next.js
project gets `framework: nextjs()` and keeps its stories' `parameters.nextjs`:
[`@forgebook/nextjs`](https://github.com/ensiria/forgebook/blob/develop/packages/nextjs/README.md) says what it draws.
React Native is read from Storybook's React Native Web framework (`@storybook/react-native-web-vite`, its
`modulesToTranspile` kept), its older webpack addon, and on-device Storybook's `.rnstorybook` folder, whose stories then
draw in the browser through [`@forgebook/react-native-web`](https://www.npmjs.com/package/@forgebook/react-native-web).

## Monorepos

Each package hands its stories to one catalogue, a package of its own that imports nothing from the libraries but their
`stories` export. A package writes a source and exports it:

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

The catalogue depends on each package and lists their sources, and `watch` lets the dev server see story files added to
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

A story's id starts with its source's (`ui:actions-button--plain`), so two packages can both have a `Button`. Props are read
through the `tsconfig.json` that holds the story file: the package's own, or the first one up its folders that lists it. This repository's fixture catalogue is built this way, on two packages, and its
browser tests run in CI.

## Commands

| Command | What it does |
|---|---|
| `forgebook dev` / `forgebook build` | Runs the catalogue of `forgebook.config.ts`, or builds it into static files |
| `forgebook prebundle` | Pre-bundles the catalogue's dependencies, as `dev` does on a first start: before it, in CI or an image |
| `forgebook stories` | Lists every story with its id and links; fails when the story index has problems |
| `forgebook story <id>` | One story: its args, its component's props, its links in a view (`--view theme=dark`) |
| `forgebook init --from storybook` | Writes `forgebook.config.ts` from a project's `.storybook` (or on-device `.rnstorybook`) folder: its framework, story globs, preview and toolbar globals |
| `forgebook new <file>` | Writes a component's first stories from its props: the main story, one per choice, the worst case |
| `forgebook check <id>` | Runs the catalogue's browser checks on a story (or a component's stories): accessibility, spills, overlays, errors; with `@forgebook/testing` |
| `forgebook errors` | Lists what the open frames reported while you edited (a story that could not be shown, a failed play); `--follow` keeps listing |
| `forgebook shot <id>` | Takes a story's pictures, one PNG per view, at the view's width and the story's height (framed in a device a view names); with `@forgebook/testing` |
| `forgebook pages` | Lists the docs pages with their ids and addresses; fails when the index has problems |
| `forgebook page <id>` | One docs page's Markdown; its headings too with `--json` |
| `forgebook diff <id>` | Compares a story's pictures with the baselines `forgebook shot --update` stored: the region, the percentage and a marked picture; fails when anything differs |
| `forgebook mcp` | Serves the same answers to an agent over the Model Context Protocol |
| `forgebook check-page` | Runs the checks on a real page of the application, by its address |
| `forgebook changed` | Lists the stories a change touches, through what they import |
| `forgebook verify` | Runs the checks on every story a change touches, with one exit code |
| `forgebook find` | Finds components by what they are for, in your own words |
| `forgebook tokens` | The design tokens, one of them, or the token nearest a value (`--nearest "#1c1b1b"`) |
| `forgebook check-code` | Checks what a change adds against the design system, with an exit code for CI |
| `forgebook agents` | Adds Forgebook's instructions to the project's `AGENTS.md` (and an [Agent Skill](https://agentskills.io) with `--skill`, in `.agents/skills` and `.claude/skills`) |
| `forgebook docs` | Writes a package's `CATALOG.md` and `llms.txt` from its exports, their TSDoc and its stories |
| `forgebook-texts` | Checks a package's story texts and lists what each language still has to translate |

Each command prints its options with `--help`; `stories` and `story` print JSON with `--json`.

`forgebook build` names each script it writes by its hash alone (`assets/3f9a1c2b.js`): a catalogue names every story
file's scripts once per loader, so shorter names make a smaller build. To read what a build holds, name each script after
its module too (`assets/Button-3f9a1c2b.js`), for one build with `forgebook build --readable-names`, or for every build in
the configuration:

```ts
export default defineConfig({ /* … */ build: { readableNames: true } });
```

## Mocking an API

A story that fetches gets its answers from [MSW](https://mswjs.io), through
[`@forgebook/plugin-msw`](https://www.npmjs.com/package/@forgebook/plugin-msw). Install both, list the plugin, and write
MSW's worker into the catalogue's public folder:

```sh
npm install --save-dev msw @forgebook/plugin-msw
npx msw init public
```

```ts
// forgebook.config.ts
import { msw } from "@forgebook/plugin-msw";

export default defineConfig({ /* … */ plugins: [msw()] });
```

```tsx
import { http, HttpResponse } from "msw";

/** The list, from a mocked API. */
export const Loaded: Story<typeof Users> = {
  parameters: {
    msw: { handlers: [http.get("/api/users", () => HttpResponse.json([{ name: "Ada" }]))] }
  }
};
```

`parameters.msw.handlers` is a list, or a record of lists as MSW's Storybook addon writes it, so those stories move over
unchanged. MSW loads only for a story that has handlers, and a request none of them answers goes to the network. On a
component page, where one worker serves every frame, each story's handlers answer its own frame only: a story with none
goes to the network. The panel's **Network** tab lists the story's handlers and its requests, each answered by a mock or
by the network, its query left out. It works on the dev server and in a static build. Without the plugin listed,
`parameters.msw` does nothing, and a story's requests reach the network.

## Plugins

A plugin is a package a catalogue lists; until it is listed, it adds nothing and costs nothing:

```ts
import { figma } from "@forgebook/plugin-figma";
import { msw } from "@forgebook/plugin-msw";

export default defineConfig({ /* … */ plugins: [figma(), msw()] });
```

A plugin can add a panel tab, a toolbar switch, a docs block, and what runs around a story in its frame; it cannot rearrange
the shell. Turn a plugin's tab off like any other (`tabs: { figma: false }`), rename it (`strings: { "tabs.figma": "Figma" }`)
or translate its texts (`strings: { "plugin.figma.compare": "Confronta" }`). `forgebook plugins --json` and `list_plugins`
say what a catalogue has.

The contract, with how to write one and what it leaves out, is [PLUGINS.md](https://github.com/ensiria/forgebook/blob/develop/packages/forgebook/PLUGINS.md).

## A preview for every pull request
`forgebook build` writes static files, so any static host gives each pull request its own catalogue, for free. `--base` is
for a host that serves it under a sub-path. A host that sets a `Content-Security-Policy` needs `blob:` in `script-src` for
the Accessibility card: a build keeps axe gzipped, and the frame runs it from a blob once unpacked. This workflow builds on
every pull request and keeps the result as an artefact; the last step is yours, and any host works:
```yaml
# .github/workflows/catalogue-preview.yml
name: catalogue preview
on:
  pull_request:
permissions:
  contents: read
jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npx forgebook build --out preview --base "/pr-${{ github.event.number }}/"
      - uses: actions/upload-artifact@v4
          name: catalogue-preview
          path: preview
      # then publish the folder, for example:
      # GitHub Pages:  actions/upload-pages-artifact, then actions/deploy-pages (one site, so without --base per PR)
      # Cloudflare:    npx wrangler pages deploy preview --branch "pr-${{ github.event.number }}"
      # Your server:   rsync -az preview/ "user@host:/var/www/previews/pr-${{ github.event.number }}/"
A pull request from a fork gets no secrets, so a step that deploys only works for branches of your own repository.
## Stories on an origin of their own

A story's code, or a value a shared link puts in one of its props (an `href`, an `html`), runs in its frame. So that it
cannot read or act on the catalogue, the frames run on another origin than the catalogue's page:

- **On the dev server**, by default: a second port, the catalogue's + 1 (`forgebook dev` prints it as `Frames`). The
  catalogue refuses what another origin's page asks of it, and the frames' port serves only the frame page, the public
  folder and the modules your stories import: a frame cannot call the agent API (`/__forgebook/api/`) or read a file
  of the project that no story imports. Choose the port with `--frame-port` or `frames: { port }`.
- **In a static build**, the frames share the catalogue's origin, unless you serve the same files from a second host
  and name both, ideally two subdomains of one site (two different sites make the frame's cookies third-party):

```ts
export default defineConfig({
  // …
  frames: { origins: { catalogue: "https://ui.example.com", frames: "https://ui-frames.example.com" } }
});
```

`origins` also serves a dev server behind a proxy that gives each port a host of its own. `frames: "same-origin"` keeps
the frames on the catalogue's origin everywhere, for a place that opens one port only; then a story's code can reach the
catalogue as before; `forgebook dev --frames same-origin` does the same for one run, and `--frames isolated` the reverse. What the frames could use on the catalogue's origin still works on theirs: storage, cookies, MSW's
worker, the clipboard, full screen, the camera and the microphone. A story's link can no longer take the catalogue's
tab to another address.

What stays reachable from a frame: the code it runs (your stories, their components, what the catalogue imports), the
errors Vite sends every page while you edit, and `forgebook errors`, where a frame reports its own errors. If the
default port is taken, the frames move to the next free one, so their storage moves with them; give `--frame-port` to
keep it.

An embed (`?embed`) and an MCP client's inline preview are pages of the catalogue's origin that frame the story on the
frames' origin in turn, as the catalogue does: a page or a host that frames them names the catalogue's origin only (in
its `frame-src`, in the preview's `frameDomains`).

## Your look in the shell
The catalogue's page can take your library's colours, fonts and corners. Nothing runs in the browser for it: the theme is
written into the page at build, and the frames are left alone, since they belong to your stories.
```ts
// forgebook.config.ts
shell: {
  theme: {
    light: { accent: "#7036c4", "accent-text": "#5a2aa0" },
    dark: { accent: "#b28bff" },
    fonts: { sans: "Inter, sans-serif" },
    radius: { control: "4px", card: "8px" }
}
Every role is optional, and typed by `ShellTheme` (`import type { ShellTheme } from "forgebook/shell-theme"`): the grounds
`window`, `sidebar`, `surface`; `separator`, `hover`; the texts `text`, `text-secondary`, `text-tertiary`, `accent-text`,
`danger-text`; `accent`; and the `code-*` colours. Renaming or removing a role is a breaking change. A preset can give a
theme too, and the catalogue's wins role by role.
The reader's Appearance menu also offers **Follow the story**, where the catalogue has a theme switch: a dark story in a
dark shell. It stays on the system's while comparing, since several themes share the stage. `appearance: "story"` makes
it the catalogue's default; a reader's own choice always wins.
When the catalogue starts, a role that does not exist is named, and so is a hex colour that leaves a text or code under
4.5:1 on its ground, or the accent, which draws the keyboard's focus, under 3:1. Other colour notations are not checked.
Fonts are yours to load: a web font goes in a style sheet of your own, `shell.css`, with `@font-face`. That sheet loads
after the shell's. It is also an escape hatch, since the shell's class names are not public API and can change in any
release. Layout is not themable, though a font does change how wide text runs.

## Embedding and white-label

Add `embed` to a story's address and the catalogue's page shows that story alone, with no sidebar, toolbar or panel, in
your theme: paste it in a wiki, in Notion, or in an iframe of your own.

```html
<iframe src="https://ui.example.com/?embed&story=acme:button--primary&theme=dark" title="Button" width="100%" height="320" style="border: 0"></iframe>
```

The story bar's **Embed** button gives the link and this code for the story and view on screen, with the values set in the
panel; `forgebook story <id>` and the `story_address` tool give the same link as `links.embed`. The switches, the
background, the language, `args`, `width` and `height` are read from the address; the stage's own settings (compare, zoom,
the panel, the device frame) are not. The story stays live, and it fills the box it gets, scrolling inside it when it is taller. Docs pages will
be embedded the same way once they exist, and oEmbed, so that a wiki can turn a pasted link into a frame on its own, comes
later.

A page of your own can follow the story's height. An embed posts `{ type: "forgebook:embed-size", height }` to the page around
it, and the Embed button's **Follow the story's height** adds the few lines that listen. Check `event.source` and
`event.origin` in your own listener, as those lines do. The story needs `allow-scripts allow-same-origin` if you sandbox the
iframe, since its modules are loaded as those of its own origin.

An embed sends nothing but the height and listens to nothing from the page around it, and it keeps working where a browser
denies a third-party frame its storage. What it does take from outside is its address: like the catalogue's own `args`, the
address reaches the story's props, so a story that renders a prop as raw HTML should not be published for anyone to frame.
And a height says something: a page that can reach your catalogue can tell whether a story exists.

Forgebook sets no framing headers, on the dev server or in a build, so what you host keeps the rules it has. To choose who may
frame your catalogue, answer with `Content-Security-Policy: frame-ancestors` on your own server, which is the way to protect a
private one; `X-Frame-Options: DENY` turns embedding off. `controls: { embed: false }` takes the button away, not the address,
since any page can frame what it can open.

To leave no trace of Forgebook's mark, turn the branding off:

```ts
// forgebook.config.ts
title: "Acme UI",
logo: "acme.svg",
shell: { branding: false }
```

The sidebar then shows your logo and title, or your title alone without a logo, and the page's icon is your logo or none.
It is on by default. The theme reaches everything Forgebook draws: the catalogue, an embed around its story, its loading and
missing-story messages, and the box a frame shows when a story fails.

## For agents

`forgebook agents` gives a project's coding agents what they need without being told: how to write a story file here,
and the commands that check one, as a section of `AGENTS.md` (renewed in place when it runs again; `--skill` writes
the same as an Agent Skill any agent can load).

A coding agent can use the catalogue while it works: find a story's id, read a story's args and its component's
props, and hand a person the link that opens it. Add the MCP server to the project's agent configuration, for
example `.mcp.json` for Claude Code:

```

A library with design tokens (`tokens` in the configuration) can theme the shell from them in a few lines. Each role takes the
token's value in both appearances, its `light` and `dark` themes first; colours written by hand win, and a token that
is not there or is no colour is warned about and leaves the shell's own. The theme is read when the configuration is, so
restart after editing the tokens.

```ts
shell: { theme: { fromTokens: { accent: "color.brand.primary", surface: "color.background.card" } } }
```json
{ "mcpServers": { "forgebook": { "command": "npx", "args": ["forgebook", "mcp"] } } }
```

It offers sixteen tools: `check_code`, `check_page`, which checks a real page of the application, `list_stories`, `changed_stories`, `find_component`, which finds a component by what it is for, `get_story`, `story_address`, `new_stories`, which writes a component's first stories from its props and answers the text without writing a file, `check_story`, which runs the catalogue's browser checks on a story and answers its problems (the project needs `@forgebook/testing` and Playwright for it), `recent_errors`, what the frames open in a browser reported while the agent edited (numbered: `since` gives only the new ones), and `story_shot`, a story's pictures in the answer itself, so the agent looks at what it made, and `list_pages` and `get_page`, which read the catalogue's docs pages as Markdown. `check`, `shot` and their tools take a view in the address's form (`theme=dark&width=360`) or as words (`"dark it 360"`); every story's `links.component` opens its component's page in that view, so `--view audience=designer` on `forgebook story` and `get_story` gives a link to send a designer. `get_story` also gives the components whose stories use the story's component (`usedIn`), so an agent finds a real use before writing one; `list_stories` gives it for every component when asked (`usedIn: true`, or `forgebook stories --used-in`), since it reads the package's import graph. Run from the catalogue's folder (or give

It offers seventeen tools: `visual_diff`, `check_code`, `check_page`, which checks a real page of the application, `list_stories`, `changed_stories`, `find_component`, which finds a component by what it is for, `get_story`, `story_address`, `new_stories`, which writes a component's first stories from its props and answers the text without writing a file, `check_story`, which runs the catalogue's browser checks on a story and answers its problems (the project needs `@forgebook/testing` and Playwright for it), `recent_errors`, what the frames open in a browser reported while the agent edited (numbered: `since` gives only the new ones), and `story_shot`, a story's pictures in the answer itself, so the agent looks at what it made, and `list_pages` and `get_page`, which read the catalogue's docs pages as Markdown. `check`, `shot` and their tools take a view in the address's form (`theme=dark&width=360`) or as words (`"dark it 360"`). `get_story` also gives the components whose stories use the story's component (`usedIn`), so an agent finds a real use before writing one; `list_stories` gives it for every component when asked (`usedIn: true`, or `forgebook stories --used-in`), since it reads the package's import graph. Run from the catalogue's folder (or give
`--config`), it uses the running `forgebook dev` when there is one, and starts a dev server of its own otherwise,
kept while the agent's session lasts; that server keeps its pre-bundled dependencies in
`node_modules/.vite/forgebook-commands`, apart from those of a `forgebook dev` running in the same folder. The links name `http://localhost:5173` unless `--url` (or `FORGEBOOK_URL`) says
where `forgebook dev` runs.

`get_story` gives a story's design too (`design`, [above](#design-links)), so an agent can read the node with a Figma tool
and compare it with `story_shot`.

#### Inline previews

A client that renders [MCP Apps](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)
gets one more tool, `story_preview`, and the page `ui://forgebook/story-preview` to show its answer in: the story, live,
inside the conversation, with a button that opens it in the catalogue. Any other client gets the answers it always got:
the tool is not listed, and `story_shot` is how it sees a story. Nothing runs until the tool is called: a client may read
the page ahead of time, and that starts no server and loads no story. When no `forgebook dev` runs, one is started for the
first preview and kept for the session.

The story comes from a local server, and the host decides whether it gets in. A browser refuses a public page's frame to
a local address (Chromium's Local Network Access), so a host whose app runs on a public origin, as a web client's does,
shows the story's picture instead: the page asks the host to run `story_shot`, and needs Playwright as that tool does. The
page's words are replaceable as the shell's are (`strings`): `previewOpen`, `previewWaiting`, `previewLoading`,
`previewTakingPicture`, `previewUnavailable`, `previewCancelled`, `previewPicture`, `previewFrame`.

A component's TSDoc can say what a person knows and an agent cannot guess: `@useWhen`, `@avoidWhen`, `@alternatives`,
`@deprecated` and `@replacedBy`. `forgebook story` and `get_story` return them as `docs.guidance`.
The most common mistake of an agent working on a design system is a colour or a size written by hand. Name your
[DTCG](https://www.designtokens.org/tr/2025.10/) files in the configuration, the base first and each theme in a file of
its own, and agents can ask what to write instead:
```ts
tokens: ["tokens.json", { file: "dark.tokens.json", mode: "dark" }]
```
A library gives its tokens to every catalogue that shows it: the same list on its source, by path from the module that
declares the source. It is read from that module's text, never by running it, so a broken story cannot hide a token: write
it in the object of `export const source`, with plain strings and paths inside the package. A source re-exported or
spread from another module gives no tokens.
```ts
export const source: StorySource = { id: "acme-ui", tokens: ["tokens.json"] /* … */ };
```
A catalogue reads each source's files in its `sources` order, then its own, so its aliases reach a library's palette. When
two authors give one token different values in the same theme the last stands, which makes the catalogue's own the final
word: it is what puts the libraries together. The answer says so in `clashes` (`kept`, `replaced`), the command warns,
and neither fails: a clash is a choice to review, not a token that cannot be read. A file over another may write only
`$value`: the token keeps its type, description and deprecation.
```sh
npx forgebook tokens --category color --json
npx forgebook tokens --nearest "#1c1b1b" --json   # the nearest tokens, and whether each is really close
`forgebook mcp` offers the same as `list_tokens`, `get_token` and `nearest_token`. References (`{a.b}`, `$ref`), `$extends`
and `$root` are followed, and a base alias follows what a theme overrides. Deprecated tokens are never suggested. Colours
in sRGB, Display P3, Oklab, Oklch and HSL are compared; other spaces are listed but counted as `uncompared`. A theme can
reference the base; a `$ref` reaches only its own file.

An agent that cannot find a component writes a new one, often because the code and the designers use different words.
`forgebook build --agent-index` adds `forgebook-agent.json` to the built catalogue, and `forgebook mcp --from <address or
folder>` serves it with no dev server and no repository: a team that consumes a published library gives its agents
`list_stories`, `get_story`, `story_address`, `find_component` and the token tools. It holds your stories' props, docs and
tokens, and anyone who reaches the site can read it, so it is written only when asked. From a folder, links are paths.

`forgebook find` and `find_component` search names, the meta's `keywords`, titles and stories, with the usual synonyms
(`modal` finds a `Dialog`): write `keywords: ["radio tile group"]` on `OptionCards` and it is found.

`forgebook check <id> --semantic` also asks a model what axe cannot see: whether a heading describes its section, an
image's text says what it shows, a label says what its control does. It is off unless asked, and sends each story's
accessibility tree and picture to the OpenAI-compatible API in `FORGEBOOK_SEMANTIC_URL`, with `FORGEBOOK_SEMANTIC_MODEL` and,
when it needs one, `FORGEBOOK_SEMANTIC_KEY`. No model comes with Forgebook and no key is stored. What it answers lands in
`judgements`, apart from the problems, as an opinion: it does not fail the check.

`forgebook check-code` and `check_code` read what a change adds, new files included, from where it left `--since`: a colour
written by hand, with the token to use when one clearly fits; a size that equals a token; a check turned off with no
reason (`@ts-ignore`, `eslint-disable`, `biome-ignore`, `stylelint-disable`); a test deleted. Only styles and components
are read for values: stories, tests, token definitions and generated files are left alone. A fix is a token's name, not
code to paste. It does not check props, imports or deprecated components. It exits non-zero on a problem, for CI.

A library tells agents what it offers with `forgebook docs`, run in its folder: `CATALOG.md`, one dense line per
component, hook, helper and style module (what it is, how to import it, its props, the id of a story that shows it),
docs page and design token of its source (its value, each theme's, what it aliases, what it is for), and `llms.txt`,
which points an agent to it and links the pages. The file's name, its sections and the subpaths left out are set in the
package's `package.json`:

```json
{ "forgebook": { "catalog": { "file": "CATALOG.md", "sections": ["components", "pages", "modules"], "exclude": ["./internal/*"] } } }
```

`forgebook docs --check` fails in CI when either file is stale. In CI, `forgebook stories --json` fails on a broken story file (a title taken twice, a title that cannot be placed) or a
docs page that names what is not there, and its JSON lists every story for a script.

## Packages

| Package | What it is |
|---|---|
| `forgebook` | The catalogue: the shell, the frame, the Vite plugin, the commands |
| [`@forgebook/react`](https://www.npmjs.com/package/@forgebook/react) | React's story types, renderer and props reader |
| [`@forgebook/vue`](https://www.npmjs.com/package/@forgebook/vue) | Vue's story types, renderer and props, events and slots reader |
| [`@forgebook/svelte`](https://www.npmjs.com/package/@forgebook/svelte) | Svelte's story types, renderer and props, snippets and callback props reader |
| [`@forgebook/sveltekit`](https://www.npmjs.com/package/@forgebook/sveltekit) | SvelteKit on Svelte's adapter: `$app/state`, navigation, forms, paths, the environment and a page's `load` in a story |
| [`@forgebook/solid`](https://www.npmjs.com/package/@forgebook/solid) | Solid's story types, renderer (args update in place) and props reader |
| [`@forgebook/preact`](https://www.npmjs.com/package/@forgebook/preact) | Preact's story types, renderer (on Preact itself, no compat) and props reader |
| [`@forgebook/web-components`](https://www.npmjs.com/package/@forgebook/web-components) | Web Components' story types, Lit renderer, and reader of the Custom Elements Manifest |
| [`@forgebook/html`](https://www.npmjs.com/package/@forgebook/html) | Plain HTML's story types, renderer and args reader, for stories with no framework |
| [`@forgebook/angular`](https://www.npmjs.com/package/@forgebook/angular) | Angular's and Analog's story types and helpers, renderer, and inputs, outputs and content reader |
| [`@forgebook/react-native-web`](https://www.npmjs.com/package/@forgebook/react-native-web) | React Native's components in the browser, through react-native-web |
| [`@forgebook/nextjs`](https://www.npmjs.com/package/@forgebook/nextjs) | A Next.js project's components outside Next.js: images, fonts, links, both routers, server components |
| [`@forgebook/nuxt`](https://www.npmjs.com/package/@forgebook/nuxt) | A Nuxt project's components outside Nuxt, on Vue's |
| [`@forgebook/story-format`](https://www.npmjs.com/package/@forgebook/story-format) | The story format, for a library whose stories must not depend on a catalogue |
| [`@forgebook/testing`](https://www.npmjs.com/package/@forgebook/testing) | Tests generated from the stories |
| [`@forgebook/plugin-figma`](https://www.npmjs.com/package/@forgebook/plugin-figma) | A story's design in the panel, and beside the story |
| [`@forgebook/plugin-msw`](https://www.npmjs.com/package/@forgebook/plugin-msw) | A story's API answered by its handlers, and a Network tab |

## Contributing

Bugs, proposals and pull requests:
[CONTRIBUTING.md](https://github.com/ensiria/forgebook/blob/develop/CONTRIBUTING.md). Security problems:
[SECURITY.md](https://github.com/ensiria/forgebook/blob/develop/SECURITY.md).
