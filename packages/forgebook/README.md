<a href="https://forgebook.dev"><img src="https://forgebook.dev/logo.svg" alt="Forgebook" width="64" height="64"></a>

# Forgebook

See every component in every theme, contrast, language and width. Write CSF stories, run `forgebook dev`: one frame
per story, switches for theme, contrast, motion and language, and a props table from the components' types.

> **Status:** 0.x, early. Its author's design system runs on it; the API may still change between minor versions,
> and every change is in the
> [changelog](https://github.com/ensiria/forgebook/blob/develop/packages/forgebook/CHANGELOG.md).

**Requirements:** Node 22.18 or later · Vite 8 (the catalogue is built on it; other bundlers are not supported) · React 19 today, through
[`@forgebook/react`](https://www.npmjs.com/package/@forgebook/react), React Native through react-native-web with
[`@forgebook/react-native-web`](https://www.npmjs.com/package/@forgebook/react-native-web); other frameworks plug in
through the same adapter (the catalogue's own interface is React either way) · npm, pnpm, yarn or bun ·
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
  // Forgebook's own controls this catalogue does without (direction: false drops the direction switch)
  controls: { sheets: false }
});
```

Without `toolbar`, the colour scheme, the contrast and the width start there. A control turned off in `controls`
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

## Coming from Storybook

Forgebook reads Storybook's story files as they are: CSF 3 and CSF 2 (`Template.bind({})`), titles of any depth and
titles from the file's path, `args` and `argTypes` (with their controls), actions from `fn()` or an `argTypes` action,
`play` with Testing Library (`@testing-library/dom` and `@testing-library/user-event`, optional peers), `loaders`,
`tags` (`!dev`, `!test`) and a story's `globals`.

It does not read MDX, doc blocks or addons. Actions are explicit only: an `on*` prop is not turned into an action by
its name.

To try it on a Storybook project, run `npx forgebook init --from storybook` in the folder that holds `.storybook`. It
writes `forgebook.config.ts`: the story globs of `main` (the MDX pages left out), the preview as Forgebook's preview,
and a switch for each toolbar global of the preview, applied by code as its decorators expect. `main` is loaded, so a
computed `stories` list is read too; the preview is read from its source, so only `globalTypes` written as plain values
become switches. It reads React on Vite (`@storybook/react-vite`) and React Native: Storybook's React Native Web
framework (`@storybook/react-native-web-vite`, its `modulesToTranspile` kept), its older webpack addon, and on-device
Storybook's `.rnstorybook` folder, whose stories then draw in the browser through
[`@forgebook/react-native-web`](https://www.npmjs.com/package/@forgebook/react-native-web). It never replaces a
configuration without `--force`, and lists what it left out.

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
through each package's own `tsconfig.json`. This repository's fixture catalogue is built this way, on two packages, and its
browser tests run in CI.

## Commands

| Command | What it does |
|---|---|
| `forgebook dev` / `forgebook build` | Runs the catalogue of `forgebook.config.ts`, or builds it into static files |
| `forgebook stories` | Lists every story with its id and links; fails when the story index has problems |
| `forgebook story <id>` | One story: its args, its component's props, its links in a view (`--view theme=dark`) |
| `forgebook init --from storybook` | Writes `forgebook.config.ts` from a project's `.storybook` (or on-device `.rnstorybook`) folder: its framework, story globs, preview and toolbar globals |
| `forgebook new <file>` | Writes a component's first stories from its props: the main story, one per choice, the worst case |
| `forgebook check <id>` | Runs the catalogue's browser checks on a story (or a component's stories): accessibility, spills, overlays, errors; with `@forgebook/testing` |
| `forgebook errors` | Lists what the open frames reported while you edited (a story that could not be shown, a failed play); `--follow` keeps listing |
| `forgebook shot <id>` | Takes a story's pictures, one PNG per view, at the view's width and the story's height; with `@forgebook/testing` |
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

## Mocking an API
A story that fetches gets its answers from [MSW](https://mswjs.io), an optional peer. Install it and write its worker into
the catalogue's public folder:
```sh
npm install --save-dev msw
npx msw init public
```
```tsx
import { http, HttpResponse } from "msw";
/** The list, from a mocked API. */
export const Loaded: Story<typeof Users> = {
  parameters: {
    msw: { handlers: [http.get("/api/users", () => HttpResponse.json([{ name: "Ada" }]))] }
  }
};
`parameters.msw.handlers` is a list, or a record of lists as MSW's Storybook addon writes it, so those stories move over
unchanged. MSW loads only for a story that has handlers, and a request none of them answers goes to the network. It works
on the dev server and in a static build.
## A preview for every pull request
`forgebook build` writes static files, so any static host gives each pull request its own catalogue, for free. `--base` is
for a host that serves it under a sub-path. This workflow builds on every pull request and keeps the result as an
artefact; the last step is yours, and any host works:
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

## For agents

`forgebook agents` gives a project's coding agents what they need without being told: how to write a story file here,
and the commands that check one, as a section of `AGENTS.md` (renewed in place when it runs again; `--skill` writes
the same as an Agent Skill any agent can load).

A coding agent can use the catalogue while it works: find a story's id, read a story's args and its component's
props, and hand a person the link that opens it. Add the MCP server to the project's agent configuration, for
example `.mcp.json` for Claude Code:

```json
{ "mcpServers": { "forgebook": { "command": "npx", "args": ["forgebook", "mcp"] } } }
```

It offers fourteen tools: `check_code`, `check_page`, which checks a real page of the application, `list_stories`, `changed_stories`, `find_component`, which finds a component by what it is for, `get_story`, `story_address`, `new_stories`, which writes a component's first stories from its props and answers the text without writing a file, `check_story`, which runs the catalogue's browser checks on a story and answers its problems (the project needs `@forgebook/testing` and Playwright for it), `recent_errors`, what the frames open in a browser reported while the agent edited (numbered: `since` gives only the new ones), and `story_shot`, a story's pictures in the answer itself, so the agent looks at what it made. `check`, `shot` and their tools take a view in the address's form (`theme=dark&width=360`) or as words (`"dark it 360"`). `get_story` also gives the components whose stories use the story's component (`usedIn`), so an agent finds a real use before writing one; `list_stories` gives it for every component when asked (`usedIn: true`, or `forgebook stories --used-in`), since it reads the package's import graph. Run from the catalogue's folder (or give
`--config`), it uses the running `forgebook dev` when there is one, and starts a dev server of its own otherwise,
kept while the agent's session lasts. The links name `http://localhost:5173` unless `--url` (or `FORGEBOOK_URL`) says
where `forgebook dev` runs.

A component's TSDoc can say what a person knows and an agent cannot guess: `@useWhen`, `@avoidWhen`, `@alternatives`,
`@deprecated` and `@replacedBy`. `forgebook story` and `get_story` return them as `docs.guidance`.
The most common mistake of an agent working on a design system is a colour or a size written by hand. Name your
[DTCG](https://www.designtokens.org/tr/2025.10/) files in the configuration, the base first and each theme in a file of
its own, and agents can ask what to write instead:
```ts
tokens: ["tokens.json", { file: "dark.tokens.json", mode: "dark" }]
```
```sh
npx forgebook tokens --category color --json
npx forgebook tokens --nearest "#1c1b1b" --json   # the nearest tokens, and whether each is really close
`forgebook mcp` offers the same as `list_tokens`, `get_token` and `nearest_token`. References (`{a.b}`, `$ref`), `$extends`
and `$root` are followed, and a base alias follows what a theme overrides. Deprecated tokens are never suggested. Colours
in sRGB, Display P3, Oklab, Oklch and HSL are compared; other spaces are listed but counted as `uncompared`. A theme can
reference the base; a `$ref` reaches only its own file.

An agent that cannot find a component writes a new one, often because the code and the designers use different words.
`forgebook find` and `find_component` search names, the meta's `keywords`, titles and stories, with the usual synonyms
(`modal` finds a `Dialog`): write `keywords: ["radio tile group"]` on `OptionCards` and it is found.

`forgebook check-code` and `check_code` read what a change adds, new files included, from where it left `--since`: a colour
written by hand, with the token to use when one clearly fits; a size that equals a token; a check turned off with no
reason (`@ts-ignore`, `eslint-disable`, `biome-ignore`, `stylelint-disable`); a test deleted. Only styles and components
are read for values: stories, tests, token definitions and generated files are left alone. A fix is a token's name, not
code to paste. It does not check props, imports or deprecated components. It exits non-zero on a problem, for CI.

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
| [`@forgebook/react-native-web`](https://www.npmjs.com/package/@forgebook/react-native-web) | React Native's components in the browser, through react-native-web |
| [`@forgebook/story-format`](https://www.npmjs.com/package/@forgebook/story-format) | The story format, for a library whose stories must not depend on a catalogue |
| [`@forgebook/testing`](https://www.npmjs.com/package/@forgebook/testing) | Tests generated from the stories |

## Contributing

Bugs, proposals and pull requests:
[CONTRIBUTING.md](https://github.com/ensiria/forgebook/blob/develop/CONTRIBUTING.md). Security problems:
[SECURITY.md](https://github.com/ensiria/forgebook/blob/develop/SECURITY.md).
