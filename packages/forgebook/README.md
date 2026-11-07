<a href="https://forgebook.dev"><img src="https://forgebook.dev/logo.svg" alt="Forgebook" width="64" height="64"></a>

# Forgebook

See every component in every theme, contrast, language and width. Write CSF stories, run `forgebook dev`: one frame
per story, switches for theme, contrast, motion and language, and a props table from the components' types.

> **Status:** 0.x, early. Its author's design system runs on it; the API may still change between minor versions,
> and every change is in the
> [changelog](https://github.com/ensiria/forgebook/blob/develop/packages/forgebook/CHANGELOG.md).

**Requirements:** Node 22.18 or later (the catalogue is built on it; other bundlers are not supported) · React 19 through
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

## Start with one command

```sh
npx forgebook init
```

It asks nothing, so an agent can run it. In the folder of the package that holds the components, it reads the framework
(React, Vue, Svelte, Solid, Preact, Lit, Angular, Next.js, Nuxt, SvelteKit, React Native Web) and the package manager
from the project's files, and writes:

- `forgebook.config.ts`: the adapter, the title, and story globs over the folders that exist;
- `forgebook.preview.ts` (`.tsx` where stories are), when the app loads global style sheets: the imports of its entry
  (Vite's `index.css`, a Next.js root layout's `globals.css`, a SvelteKit layout's, `angular.json`'s `styles`), since
  stories look wrong without them. Nuxt's adapter reads `css` from `nuxt.config` itself, so it needs none.

Then it prints what is left, each thing named, and the next commands. The packages to add are in the exact command of
the project's package manager; `--install` runs it. It lists React even on Vue, say, because Forgebook's shell needs it and not every package manager installs a peer by
itself. Vite is Forgebook's own dependency: a project on an older one installs it beside its own, which stays as it is.

```sh
npx forgebook new src/Badge.tsx   # a component's first stories
npx forgebook dev                 # the catalogue, live
npx forgebook stories --json      # what it lists, and what did not read
```

It writes nothing and exits with an error when:

- a file is already there (a configuration or a preview, under any name it is read by): `--force` replaces it;
- `package.json` names no framework it supports, or two that stand on their own: `--framework <name>` chooses (`html`
  for no framework). An adapter already in `package.json` settles it;
- a framework, React or Vite in `package.json` cannot reach the version Forgebook takes: the message names each.

- the project has a `.storybook` (or `.rnstorybook`) folder: `--from storybook` takes [that route](#from-storybook),
  which loads its `main` and so runs its code, or `--framework <name>` starts from the dependencies;
- a file it would write is a link: it never writes through one, even with `--force`.

`init` runs no code of the project unless `--from storybook` or `--install` asks it to; `--install` is an install like
any other, with the project's package manager settings and the packages' scripts. `--json` prints the result as a document, a refusal
too (`refused`, `message`, `hint`, `supported`, exit code 1; a wrong command line is exit code 2, with no document), with `nextSteps` as `{ kind, file, message }`: `kind` is `style-sheet`,
`provider`, `portal`, `head`, `font`, `postcss`, `setup`, `version` or `storybook`.

### What init cannot work out

A catalogue runs no entry of the app, so what one does for the app does not happen for a story. Each of these is
reported with the file it was read from:

- **Providers**, the components that wrap the app, and what it installs (`app.use(router)`, `provideRouter()`): a decorator
  in the preview gives them to the stories that need them.
- **Portals**: an element beside the app's root in its page (`#modal-root`). A decorator adds it.
- **The page's head**: a font's or a CDN's `<link>` goes to `head` in the configuration.

### The app's build

A catalogue draws your components with your app's build, with nothing to write:

| What | Where it is read from | Runs your code? |
|---|---|---|
| Aliases | `tsconfig.json`'s `paths` and `baseUrl` (through `extends` and `references`) | No: read as text, Vite resolves them |
| Aliases, `define`, Sass options, `.env` settings, your Vite plugins (Tailwind's, SVGR…) | `vite.config.*` beside the catalogue's configuration | **Yes**, as `vite dev` does |
| Tailwind before 4, Autoprefixer, any PostCSS plugin | `postcss.config.*`, `.postcssrc*`, `package.json`'s `postcss`, up to the repository's root | **Yes**: a script, and the plugins any of them names |

So every command that starts the catalogue runs those files, on purpose: `forgebook stories` and `check` as well as `dev`.
The catalogue's own configuration and your components already run there, and this is the build you run every day. A first
`dev` start loads a `vite.config` twice, as its pre-bundling runs in a process of its own. `forgebook init` never runs them:
it reads their names and reports them (`appBuild` in `--json`, with `runsCode`). `forgebook dev` prints what it read; what
could not be read is said on stderr by every command.

From a `vite.config`, a catalogue takes how modules and style sheets resolve and compile, and never the app's page,
server or output (`root`, `base`, `build`, `server`), from the file and from what its plugins' `config` hooks return; a
plugin that changes the configuration in place is not stopped. A plugin's `configureServer`, where one starts a backend or a
watcher, runs on `forgebook dev` and not on a command's own server (`stories`, `check`, `verify`, `mcp`). Its plugins go in, apart from
two kinds: the framework's own, which the adapter brings, and those known to build an app rather than draw a component
(routers, service workers, source-map uploads, type checkers). That second list is names, so an upload plugin it does not
know runs on `forgebook build`: name it in `skipPlugins`. A plugin's `transformIndexHtml` reaches the frames, not the
catalogue's page. A `define` that writes out a whole `process.env` is left out, since a catalogue bundles code the app does
not. A file that fails to load is said with what to do; stories that do not need it still draw.

Not read: the options of the framework's own plugin (`react({ jsxImportSource })` goes to the adapter), and `css.modules`
(Lightning CSS has `css.lightningcss.cssModules`, and no `localsConvention`); both are said. A workspace's other packages'
`tsconfig` paths are not looked for, only the catalogue's own folder's, as `extends` and `references` lead on from it.

A `vite.config` holding only Vite's import and the framework's plugin is not loaded at all, so a new project pays for
none of this. Next.js, Nuxt, SvelteKit, Angular and React Native read what is theirs themselves, as their own sections say.

To turn it off:

```ts
export default defineConfig({
  // …
  appBuild: false // or each part:
  // appBuild: { viteConfig: false, postcss: false, tsconfigPaths: false, skipPlugins: ["some-plugin"], keepPlugins: ["react-router"] }
});
```

A plugin's name is the one `forgebook dev` prints, not its package's. A PostCSS configuration in YAML is not read (`init`
says so). PostCSS runs on plain CSS and on a component's `<style>` block, with the sheets they import by relative path; a
Sass file goes through its own compiler alone.

## A first catalogue

The same by hand, which is also what the command writes. A component, with its props typed and documented:

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

### Which files

`stories` (and `docs`, for [docs pages](#docs-pages)) lists globs from the configuration's folder. A glob that starts
with `!` leaves out the files it matches from what the others list, wherever it stands in the list, as Vite's
`import.meta.glob` and fast-glob read it:

```ts
stories: [
  "src/**/*.stories.tsx",
  "src/**/*-story.tsx",
  // drafts and the components still being moved in: listed by neither glob above
  "!src/**/drafts/**",
  "!src/components/Legacy*/**"
]
```

A `!` glob is written from the same folder and with the same syntax as the others; one that names a folder
(`!src/legacy`) leaves out every file in it. A file two globs list is listed once, its title made from the first one
(when its meta writes none). A list of `!` globs alone lists nothing, and the catalogue refuses it. Adding a file a `!`
glob leaves out, while the catalogue runs, changes nothing on the page. A file Vite's `server.fs.deny` refuses stays out
too, with a warning.

## What a catalogue gives you

- **One frame per story**, so a story's styles and globals never leak into another, and its address opens it alone.
- **Edits drawn in place**: an edited story file, preview or component is drawn anew in its open frame, which keeps
  what you did in the story (a typed field, an open menu); a story with a play, loaders or set-ups runs them again. An
  edit that adds, renames or retitles a story reloads the pages, as an edit of an Angular story file does. On macOS
  the files you work on (the story files the open frames show, and each file they load once you have edited it) are
  watched one by one, so an edit reaches the page without the system's change events' wait of a tenth of a second or
  more. Where the system's change events come late or never (a container's mounted volume, a Windows drive under WSL,
  a network drive), `forgebook dev --poll` checks the files itself.
- **Switches** for theme, contrast and motion, and the languages you declare; a library adds its own (density, brand)
  through a preset. A direction switch draws every story right to left, and a language declared `dir: "rtl"` does
  it by itself.
- **A toolbar each reader arranges**: whoever uses the catalogue pins the controls they use to the toolbar, orders
  them and hides the rest in the View menu; their browser keeps it ([below](#the-toolbar)).
- **A light and a dark catalogue**: the reader picks Light, Dark or System in the Interface menu at the sidebar's foot
  (their browser keeps it); `appearance` in the configuration sets the default. The stories keep their own theme, from the view's switches.
- **Keys and named views**: `?` lists the keys, as does the menu at the sidebar's foot, where a reader can turn off every
  key without a modifier for this browser; a key pressed inside a story, in a text field or in a custom element stays
  theirs. A key cycles a control's values (`t` the theme, Shift+`t` back); the catalogue sets the
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
  their TSDoc, nothing written twice: objects and lists as nested fields, mixed unions, tokens and named values too
  ([below](#the-panels-controls)).
- **Props in groups**: a component with many props lists them under the groups their TSDoc names (`@group Paging`),
  and a prop typed with a documented object (`texts?: FinderTexts`) unfolds to list its members
  ([below](#props-in-groups)).
- **Required props first**: what every use must set comes first, in each group or in a section of its own, and a
  reader turns the ordering off with a switch ([below](#required-props-first)).
- **Shared values, checked**: the values set in the Props tab stay in the address (`args=`), so a link shares them.
  Since whoever writes a link chooses them, a story receives only the props it declares (its component's props, its
  `argTypes`, its own args) that the panel lets a person set, each with a value of that prop's type, an object with only
  the fields its type declares; anything else (`onclick`, `innerHTML`, a text for a number) is left out and listed above
  the story, with a button that removes it from the address, as is one that cannot be read at all. A value that is code
  never comes from a link.
- **The worst case in one press**: the Props tab's Worst case button gives every text prop a long text with a word too
  long to break, every number a huge one and every list many items, nested ones too, kept in the address; the elements that then spill out of their parents
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
- **Search across everything**: `/` or ⌘K, and the words find docs pages, props, events, descriptions, stories and names
  ([below](#search)).
- **`CATALOG.md`** for coding agents: `forgebook docs` writes one dense line per component, hook, helper, design token
  and docs page of a package, from its exports, their TSDoc, its stories and its source.
- **Tests from the stories**, with [`@forgebook/testing`](https://www.npmjs.com/package/@forgebook/testing): every
  story in the browser with axe, spills and overlays, screenshots, and every story rendered on the server.

It adds about a dozen packages to a React and Vite project.

## On a narrow window

Below 720 px the sidebar stops taking room from the page. It starts closed, opens from the toolbar's sidebar button and
slides over the page, which keeps the whole width and cannot be reached while the sidebar is open. A tap outside it,
Escape (once the search is empty and no menu is open), its own button or opening any page closes it, and the focus goes
back to the button, unless a search's result has taken it to what it found. Opening it there changes
nothing a wider window remembers: the sidebar a person showed or hid on a wide window is as they left it, width
included. A reduced-motion preference shows and hides it at once.

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

### Several visual themes

A library with several looks offers them as a switch whose `control` is a gallery: a menu whose items show each look, so a
reader sees it before applying it.

```ts
switches: [
  { ...themeSwitch(), label: "Appearance" },
  {
    id: "look",
    label: "Theme",
    control: "gallery",
    apply: { kind: "attribute", name: "data-look" },
    default: "plain",
    values: [
      { value: "plain", label: "Plain", isUnset: true },
      { value: "paper", label: "Paper", preview: { image: "previews/paper.png" }, sheet: "looks/paper.css" },
      {
        value: "night",
        label: "Night",
        preview: { swatches: ["#0b1020", "#7c8cff"], font: "Harbor Sans" },
        implies: { theme: "dark" },
        sheet: "looks/night.css"
      }
    ]
  }
]
```

- **`control: "gallery"`** beside `segments` and `list`. The first load carries only its button: the menu's code, the
  previews and their pictures load when it first opens. Radio buttons, as the shell's other menus: one tab stop, the arrow
  keys move and choose, Escape closes. Each item is named by the value's `label`; a value with no preview shows its first
  letter.
- **`preview`** is `{ image }`, a file by its path from the configuration's folder (absolute in a preset), or
  `{ swatches, font }`, 1 to 8 plain colours and a font's name. A font is only a name: drawn in it where the reader has it
  installed, never fetched. A preview loads nothing from an address: the configuration's check refuses one, and a `url()`.
- **`implies`** sets other switches while the value is drawn: a look drawn only for dark selects dark by itself. The
  implied control is off and says what sets it, and its key does nothing. The address keeps the reader's own value, which
  comes back when the value is left: `?look=night&theme=light` draws dark, and the link stays as written. An implied
  value wins over the address and over a story's `globals`; between two values that imply different values of one switch,
  the switch declared first wins; an implied value implies nothing further, which the check enforces. Compare leaves
  out a cell it contradicts (with `look,theme`, Night only at Dark) and does not offer a switch implied now.
- **`sheet`** is a style sheet of that value alone, processed by Vite in dev and in a build, and fetched only while
  the value is drawn. It comes after the source's sheets, the switches' in the order declared, and only with Styles › Full,
  as the source's theme. Its path may not be an address; its contents are your own CSS, so what it imports is yours to
  decide, as in a source's sheets. On a change the old sheet stays until the new one has loaded, and the frame's root changes with it,
  so a story is never drawn with neither.

A source's page colour can follow such a switch, so a story's box waits on the colour it will have:
`background: { light, dark, bySwitch: { look: { night: { dark: "#0b1020" } } } }`. The first declared switch whose value
gives the scheme's colour wins; otherwise `light` and `dark`.

The catalogue's own menu, at the sidebar's foot, is named Interface, so it reads apart from a switch named Appearance: it
colours the catalogue around the stories, never the stories. `strings: { appearance: "…" }` renames it; the
configuration's `appearance` key and `data-forgebook-appearance` keep their names.

### Backgrounds

The Background control offers Forgebook's five pictures and the catalogue's own:
`backgrounds: { builtIn: ["checkerboard"], custom: [{ id: "paper", label: "Paper", light: { color: "#fffdf5" } }] }`
keeps one picture and adds a plain paper colour (`layers` puts CSS backgrounds over it, `dark` sets another look for the
dark scheme). Code that reads the resolved settings (`catalogueSettings` from `forgebook/catalogue`) finds each in
`backdrops`, in one of two shapes. Forgebook's own is `{ kind: "builtIn", id, label, colors }`: only the frame draws its
picture, so the settings carry its colours, not its picture. A catalogue's is `{ kind: "own", id, label, colors, layers }`,
its picture being `layers`. `colors` and `layers` are both `{ light, dark }`. The colour under a backdrop in the dark
scheme is `backdrop.colors.dark`; a custom backdrop's CSS for the light one is `backdrop.layers.light`.

## Touch

The Touch switch (in View, `m` by default) lets a story be tried as on a phone, from the computer:

- the story receives a finger's events: `pointerdown`/`move`/`up` of the `touch` type and, in Chromium,
  `touchstart`/`move`/`end`; a tap clicks, a press held half a second opens the context menu;
- its CSS answers as a phone's: `(hover: none)` and `(pointer: coarse)` match, the mouse's `:hover` does not;
  `navigator.maxTouchPoints` says 5;
- the cursor is a round dot; Shift fixes a centre, and a press then puts a second finger mirrored around it, so a drag
  pinches and rotates;
- a drag scrolls what it can, as the `touch-action` on the way allows, and flings on;
- a tap on a text field (an input, a textarea, a contenteditable) focuses it and puts the caret under the finger, a
  drag or a long press there does not, and a handler that cancels the tap leaves it unfocused, as on a phone; the
  keyboard then types and selects in it as usual (in a closed shadow root, or on a non-editable part of a
  contenteditable, a press focuses at once and the caret is the browser's, the simulation not reaching them).

A story reads the switch in its globals (`context.globals.touch`, `"mouse"` or `"touch"`) to draw only the version
that fits the pointer, and follows the switch live; a story fixes it with `globals: { touch: "touch" }`.

A story meant for a phone says so with `parameters: { touch: true }` (on the meta, for every story of the file; a
story's own `false` leaves it out). It starts touched with a finger whatever the switch says, and a Touch toggle on
its example's bar turns that off for it; on its own page, the Touch switch is the story's. The choice lasts while the
catalogue is open, and the address keeps the switch the other stories follow.

**It is a simulation.** Events made by a page are not trusted, so the browser's own reactions do not follow them:
its native scrolling (the drag's scrolling is an approximation, without the rubber band), selecting a word or the page's
text with a finger, and `touch-action` applied by the browser. In Safari and Firefox the stories get pointer events only (only
Chromium lets a page build touch events), and Firefox does not place the caret inside an email or number field. A virtual keyboard, the viewport shrinking under it, safe areas and real iOS
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

## Required props first

The API reference and the Props tab list a component's required props before the others, so a reader sees at once
what every use must set. Where they go is `requiredFirst`:

```ts
// forgebook.config.ts: every component
export default defineConfig({ requiredFirst: "section" });

// a component's meta, for its page and its stories; or one story, for its own Props tab
export default { component: Finder, parameters: { requiredFirst: false } } satisfies Meta<typeof Finder>;
```

- `"in-groups"`, the default: the required props first inside each group, and among the props that name no group and
  the events; the others keep the order of the source. In the Props tab, first among each kind of control.
- `"section"`: one "Required" section before every group, all the required props in it, each naming its group (an
  event says "Event"; the Props tab, which lists no events, leaves them to the Events tab); then the groups with the
  others. A component whose props name no group has nothing to section, so it reads as
  `"in-groups"`.
- `false`: the order of the source.
- The narrowest wins: a story's over its meta's, a meta's over the configuration's. Write it plainly (the index reads
  it); anything else is reported where it is written.
- A reader's "Required first" switch, in the header of both tables, turns the ordering on or off for the whole
  catalogue, kept in the browser: off, the order of the source; on, the developer's layout (`"in-groups"` where the
  developer chose `false` everywhere). The switch never picks between the two layouts.
- Agents get the props in the order of the source and the names of the required ones at the top of
  `forgebook story --json` and `get_story` (`requiredProps`): the setting shapes the pages only.

## The panel's controls

The Props tab draws a control for each prop from its type, with nothing to write:

| The prop's type | Its control |
|---|---|
| `string`, `number`, `boolean` | a field, a number, a toggle; a text with a line break becomes a text area |
| `"sm" \| "md"` | buttons or a list; a search past 12 values |
| `readonly string[]`, `{ a: string; b?: number }` | nested fields, with add, remove and reorder by buttons, so a keyboard does it too |
| `[number, number]`, `Record<string, number>` | a field per item; names and values |
| `"sm" \| number`, `string \| string[]` | choose the type, then the value |
| `unknown`, `object`, a type too deep or wider than 40 fields | JSON, checked as it is typed |
| a component, a function, a node | what the source's `namedValues` offer for its type, searched by name; a node takes a text too |

A story names another control the way Storybook's do, and a few of Forgebook's own:

```ts
argTypes: {
  note: { control: "textarea" },
  options: { control: "object" }, // fields from the type, else from the story's own arg, else JSON
  accent: { control: { type: "token", of: "color" } }, // from the catalogue's `tokens`
  gap: { control: { type: "token", of: "space", format: "var(--{name})" } }, // writes `var(--space-small)`
  cover: { control: { type: "file", accept: "image/*" } }
}
```

`of` is a token's type or a part of its name. A prop asks for tokens from its TSDoc as well (`@token color`). The tokens
load when such a control is drawn; without any to offer it stays a text field.

Each value has three states, and the panel keeps them apart: the story's own (nothing in the address), the panel's (an
empty text included), and no value at all, where the component receives `undefined` over what the story's args give it.
Beside each field, one button leaves it with no value and another goes back to the story's; a cleared number has no
value. The address writes no value as `{"forgebookUnset":true}`.

Every value is plain JSON, kept in `args=`, text in any script included, and checked when a link is opened, in an embed
too: an object may hold only the fields its type declares. What JSON's fallback holds has no type to check against, so
what would run if a component spread the object on an element is left out (`onclick`, `innerHTML`, `srcdoc`, Vue's
`.innerHTML`, an address that starts with `javascript:`), as is a named value; `__proto__`, `constructor`, `prototype` and
values nested over 16 levels are not read at all. A token's value is a plain text, as a colour's is, and a link may give
another. A file is kept in the link as a `data:` address, so a `file` control takes about 6 KB, of a picture, sound, film,
plain text or a PDF. An object of exactly `of` and `named` reads as a named value. A very long value makes a very long
address, which some servers refuse, so the worst case leaves out a value too long for one.

A `Date` prop gets a date and time field, and the story receives a `Date`; a link writes it as `{"forgebookDate":"<ISO>"}`.
The `date` control a story names sets a number of ms instead, as Storybook's does.

The editors are one chunk that loads when the first such prop is drawn: a catalogue of plain props never asks for it.

### Controls of your own

A control the panel lacks is a module of yours, registered by name and loaded when a story names it. A catalogue that
registers none loads nothing for this.

```ts
// forgebook.config.ts
export default defineConfig({ /* … */ argControls: { rating: "./controls/rating.tsx" } });

// a story
argTypes: { score: { control: { type: "rating", settings: { stars: 7 } } } }
```

```tsx
// controls/rating.tsx
import type { ArgControlProps, ValueSchema } from "forgebook/arg-control";
import { createRoot } from "react-dom/client";

export const schema = { type: "integer", minimum: 0, maximum: 10 } satisfies ValueSchema;

export const mount = (element: HTMLElement, props: ArgControlProps) => {
  const root = createRoot(element);
  root.render(<Rating {...props} />);
  return () => root.unmount();
};
```

`mount(element, { value, onChange, argType })` draws in the element and returns what takes it away. It is a function rather
than a component, so it can be written in any framework, whatever the stories' is: `createApp` in Vue, `mount` in Svelte,
plain DOM. `argType` holds the arg's `name`, `label` and `description`, and the control's `options`, `min`, `max`, `step`
and `settings`. The control keeps what it draws: it is mounted again only when the value changes from outside it.

`schema` says what the value looks like, in JSON Schema's words: `type`, `enum`, `const`, `minimum`, `maximum`, `minLength`,
`maxLength`, `pattern`, `items`, `minItems`, `maxItems`, `properties`, `required`, `additionalProperties`, `anyOf`. Any other
keyword is refused, since a schema that says less than it seems to would let a link through, as is a keyword holding what it
cannot use. A `pattern` has the `u` flag, and may not repeat a repeat (`(a+)+`), which could hang the page. The value is
always JSON, so a link keeps it and an agent sets it with no UI; what JSON cannot hold goes through named values, as
`{ of, named }`.

A link's value is checked against the schema before it reaches the story, and each `onChange` too. A control no one
registered, a module that fails to load, a `mount` that throws and a value that does not fit each give a sentence beside the
field; the other fields go on working. An error the control throws later, in its own event handlers, is out of reach: it is
the page's.

**A custom control runs in the shell's page, with a plugin's trust.** It can read and do whatever the catalogue's page can;
unlike a story, it has no origin of its own to keep it apart. Register only code you would run as a plugin. To be read by
agents its module also loads on the dev server when a command asks about a story that names it, for its `schema`: keep what
touches the page inside `mount`. A name that no control has (`control: "selct"`) is read as a custom control, and says so
beside the field.

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
  relative to the file, and go through the build. A `story` or `props` fence sits in the page's own flow, or in a block
  below (an aside, a tab, a step), not inside a plain list or quote.
- The page gets its look from the shell's palette, so a `shell.theme` and both appearances reach it; a page with two
  headings or more lists them beside its text, or above it on a narrow page.
- `forgebook stories` and `forgebook pages` fail when a page names a story or a component that is not there, a link leads
  to no page, an image is not a file of its package, or a block cannot be read; each problem gives its line and column
  (`./docs/theming.md: line 12, column 1: …`), and the page still draws everything else.
- A page is trusted more than a story's code: a story runs in a frame on an origin of its own, while a page's raw HTML,
  which Markdown lets it hold, runs in the catalogue itself (its links keep only web, mail and the catalogue's own
  addresses). Review a page as you review code, and do not build a catalogue from pages, a library's included, you did
  not write.

### Blocks

Blocks are written as Starlight, Docusaurus and VitePress write them, so a page reads well on GitHub too: `:::name`
opens a block, a line of the same colons closes it, `[label]` gives it a title (plain text, values included) and
`{key="value"}` its attributes. A block inside another has fewer colons than its parent. Everything is drawn at build time; the tabs alone bring a few lines of
script, with the docs pages' code, which only a page that opens loads.

````md
:::tip[Before you start]
Anything Markdown holds goes in a block, a story too:

```story acme:actions-button--primary
```
:::

> [!WARNING]
> GitHub's alerts are asides too: NOTE, TIP, IMPORTANT, WARNING (a caution) and CAUTION (a danger).

::::tabs{syncKey="package-manager"}
:::tab[pnpm]
```sh
pnpm add @acme/ui
```
:::
:::tab[npm]
```sh
npm install @acme/ui
```
:::
::::

:::steps
1. Install the package.
2. Wrap the app in its provider.

   ```tsx
   <AcmeProvider theme="light">{app}</AcmeProvider>
   ```
:::

::::cards
:::card[Light and dark]
Every component follows the theme.
:::
::link-card[Theming]{href="./theming.md" description="How the colours are chosen."}
::::
````

| Block | What it draws |
|---|---|
| `:::note`, `:::tip`, `:::important`, `:::caution`, `:::danger` | An aside in its tone's colour; `[label]` replaces the tone's name as its title. |
| `> [!NOTE]` … `> [!CAUTION]` | The same asides, as GitHub writes them. |
| `::::tabs{syncKey="…"}` around `:::tab[Label]` | One panel at a time, keys ← → Home End. Tabs with the same `syncKey` (as Starlight names it) switch together, on every page, and the browser keeps the choice. |
| `:::steps` around one numbered list | Numbered steps; a step may hold code and stories. |
| `::::cards` around `:::card[Title]` and `::link-card` | Cards side by side, as many to a row as fit. |
| `::link-card[Title]{href="…" description="…"}` | A card that links to a page by its file, to an address of the catalogue (`?component=…`), or to another site. |

A block the page cannot read is reported with its line and column, and what it holds still draws: a name Forgebook does
not know (a `::` line it does not know stays as text; `:::warning` is pointed to `:::caution`), an attribute a block does
not take, a closing line with the wrong number of colons, a block never closed. A block starts at
a line's start; written after spaces, as under a list item, it is not read.

### Code

The line after a fence's backticks is read whole, as Expressive Code writes it:

````md
```tsx title="Button.tsx" {3} ins={4} del={5}
import { Button } from "@acme/ui";

export const Save = () => (
  <Button tone="primary">Save</Button>
  <Button>Save</Button>
);
```

```diff lang="tsx"
-const tone = "neutral";
+const tone = "primary";
```
````

`title="…"` names the code (a file, most often); `{1,4-6}` marks lines, `ins={…}` and `del={…}` mark them inserted or
deleted; `wrap` wraps long lines instead of scrolling. A `diff` fence marks its `+` and `-` lines: with `lang="tsx"` it is
code, its signs taken off and the rest coloured in that language; without, it is a patch, shown and copied as written. The
lines are `<mark>`, `<ins>` and `<del>` elements, so a screen reader says what changed, and Copy copies code as it reads
after the change: no diff signs, no deleted lines. A word the line does not read is a problem, with its
column.

### A home of your own

A catalogue's home lists the libraries and their families. To write your own, put `forgebook.home.md` beside the
configuration (or name another file with `home: "docs/home.md"`); without one, the home stays the generated one. It is a
docs page, with every block above, a few values and the generated home's pieces among your own words:

````md
---
description: "{{components}} components in {{libraries}} libraries, version {{version}}."
---

Our design system, for every product team.

:::tip[Start here]
Read [Getting started](./docs/getting-started.md), then pick a component.
:::

::recent

```story acme:actions-button--primary
```

::families[Components]{source="acme"}

::libraries
````

| Value | What it shows |
|---|---|
| `{{title}}` | The catalogue's name. |
| `{{version}}` | The `version` of the `package.json` the file belongs to, read at build time. |
| `{{components}}`, `{{stories}}` | How many components and listed stories the catalogue has. |
| `{{libraries}}`, `{{pages}}` | How many libraries have components, and how many docs pages there are. |

| Piece | What it draws |
|---|---|
| `::recent[Heading]` | The pages opened last, under "Recently opened" or your heading; nothing when there are none. |
| `::libraries{source="…"}` | Each library as the generated home shows it: its name and logo, its introduction, its pages and families. |
| `::families[Heading]{source="…"}` | The family cards alone. |
| `::pages[Heading]{source="…"}` | The docs pages' card alone. |

The title is the front matter's `title`, else the file's opening `#` heading, else the catalogue's name; `description` is
the lead under it. Values work in docs pages too, and a value is never read inside code, so a page can show `{{title}}`
itself in backticks; a name that is not a value (`{{name}}`) stays as written and is reported. The pieces belong to the home: on a docs page they are a problem. A link to a `.md` file opens that
page of the catalogue's own `docs`; a library's page is linked by its address (`?page=acme:guides-theming`). Problems in
the file are listed above the home and by `forgebook pages`, and `forgebook page home` reads it as an agent would. Restart
`forgebook dev` after adding or removing the file.

## Search

The field at the top of the sidebar searches the whole catalogue. The tree filters by name as you type, for browsing;
beside it a list ranks everything the words find, each component or page with what matched inside it and why (a prop,
an event, a heading, a sentence, a story), the words marked. `/` or ⌘K (Ctrl+K) comes to the field from anywhere (with the sidebar hidden, ⌘K alone,
which shows it), ↑ and ↓ move, Enter opens at the exact heading or prop, ⌘Enter or a modified press opens a new tab, Escape empties the field.

A prop has an address of its own, so a link to one can be pasted anywhere: `?component=acme:inputs-select#prop.value`,
and `#prop.Group.label` for a prop of a part named in `subcomponents`. A heading of a component's documentation file
has one too (`#accessibility`), as a docs page's has.

There is no search server and nothing to set up: the plugin builds the index with the catalogue, and the shell loads it
the first time someone types, so a reader who never searches pays nothing. A static build searches as the dev server
does. Only what the page does not already hold goes in the index: under 4 KB gzipped for a small library of ten components
with their documentation and a few guides. On a dev server, the first search waits for your packages' TypeScript for the props; names and docs
pages answer first.

Search and `forgebook find` rank alike, with the same synonyms: `modal` finds a `Dialog`, and a name counts more than a
sentence. A sentence copied from a page finds that page first. Change the words people see with `strings`, as any
other text of the shell (`"search.kindPage": "Guides"`).

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

## Tags

Tag stories as CSF does, in the preview, a file's meta or a story; a `!name` takes one away:

```ts
export default { component: Button, tags: ["beta"] } satisfies Meta<typeof Button>;

export const Experiment: StoryObj = { tags: ["!beta", "wip"] };
```

When any story has a tag of its own, the sidebar offers a filter beside the search: tick a tag to keep the stories that
hold it, press its other button to leave them out. A story stays when it holds any tag asked for and none left out. The
filter lives in the address (`?tag=beta&tag=!wip`), so a link keeps it, and it holds from page to page; a page opened by
its address shows even if the filter leaves it out. `dev`, `test`, `autodocs`, `play-fn` and `test-fn` say what a tool
does with a story, and are not offered. Agents ask the same way: `forgebook stories --tag beta --tag '!wip'`, or `tags`
on `list_stories`.

## Coming from Storybook

Forgebook reads Storybook's story files as they are: CSF 3 and CSF 2 (`Template.bind({})`), titles of any depth and
titles from the file's path, `args` and `argTypes` (with their controls), actions from `fn()` or an `argTypes` action,
`play` with Testing Library (`@testing-library/dom` and `@testing-library/user-event`, optional peers), `loaders`,
`tags` (`!dev`, `!test`, and your own for the [tag filter](#tags)), a story's `globals`, JSX in `.js` story files (listed and shown as code; Vite compiles JSX only in
`.jsx` and `.tsx`, so such a library adds the plugin its own Storybook uses for them, through the framework's plugins),
hooks in a `render` or a decorator (React and
Preact, with the story's state kept when a decorator draws `<Story />`), Storybook's preview hooks from
`storybook/preview-api` in a React story file (`useArgs`, whose update and reset change the story's args as the panel
would and show in it, a value the panel cannot show staying the story's; `useGlobals`, `useParameter` and
`useStoryContext` to read; its `useState`, `useEffect` and the rest, which are React's there; `useChannel` throws, since
Storybook's addons are not there), a preview's named exports beside its default
export, and the text values of its `globalTypes` defaults and `initialGlobals`, which its decorators read. The answers
to tools and agents read a preview's args and parameters on the server: a package it imports that only a browser can
load (Storybook's docs blocks, which read `document` as they load) is left as a placeholder there, which the preview can
keep in a parameter or call (an addon's factory), and what a call made can be looked into as `definePreview` does with
its `addons: [docs()]`; but the preview cannot read a member of an export, nor use any placeholder as a string, a number
or a list. A placeholder kept in args or parameters is left out of the answers, as a function is. A preview that still
cannot load (it uses one so, or one of its own files reads `document`) leaves the
answers working: it is left out of them and named among their problems, with what it used. A
`**` pattern skips `node_modules` unless it names it.

A link keeps working too: `args=` reads Storybook's form (`label:Hello+world;count:5;open:!true;tags[0]:a;tags[1]:b`,
with `!null`, `!hex(…)`, `!rgb(…)`, `!hsl(…)` and `!date(…)`) as well as Forgebook's own JSON, told apart by JSON's first
`{`. Its values are typed by the prop that receives them, so `5` is a number for a number and stays `5` for a text, and they
meet the same check as any link's. Forgebook writes its own form once a value changes in the panel. What an arg here
cannot hold (an object such as `style.color:red`, a list with a gap) is named above the story, not dropped
in silence. An arg's `argTypes.<name>.if` (`{ arg: "kind", eq: "link" }`, `{ global: "theme", neq: "dark" }`, with `truthy`,
`exists`, `eq` or `neq`) hides its control the same way Storybook's does, and leaves its value alone.

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

### From Storybook

To try it on a Storybook project, run `npx forgebook init --from storybook` in the folder that holds `.storybook`. It
writes `forgebook.config.ts`: the story globs of `main` (the MDX pages left out), the preview as Forgebook's preview,
and a switch for each toolbar global of the preview, applied by code as its decorators expect. `main` is loaded, so a
computed `stories` list is read too, as the files it names (a list made with fast-glob and its `ignore`, for one,
arrives with the ignored files already out); to keep the exclusion as globs, write it as `!` globs
([above](#which-files)) in place of the files. The preview is read from its source, so only `globalTypes` written as plain values
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

A monorepo that points its packages at their sources with an export condition (`"source": "./src/index.ts"` in
`exports`, and `source` in Vite's `resolve.conditions`, set by a framework's plugins) needs nothing more with the
`forgebook` command: its dev server reads the stories and previews it answers tools with on Node under the same
conditions, those of other runtimes (`browser`) aside, unless a plugin names the server's own.

## A lighter catalogue

Two features cost the most and are on by default: the accessibility check, which ships axe (about 180 KB gzipped in a
build), and the props read from the types, whose TypeScript programs are most of what the dev server holds on a first
start. A catalogue that does not want them turns them off:

```ts
export default defineConfig({
  framework: react(),
  title: "Acme",
  stories: ["src/**/*.stories.tsx"],
  a11y: false,
  componentDocs: false
});
```

- `a11y: false` checks nothing: no Accessibility tab and no accessibility column on a tester's page, axe neither written
  in a build nor offered to the frames (whose code that loads it is fetched only on a check), and the generated tests,
  `forgebook check`, `check-page` and their tools leave axe out (their reports say `"a11y": "off"`). `tabs: { a11y: false }`
  only hides the tab and keeps the rest. A preset that turns the check off keeps it off, whatever rules the catalogue writes.
- `componentDocs: false` starts no TypeScript program: no API reference and no `props` fence on a page, no "Used in", and
  the search finds names, stories and docs pages but no props. The Props tab still works: its controls come from the
  story's args and `argTypes`, as Storybook's do without a docgen (a text, a number, a toggle from each arg's value, an
  action as an event); a prop the story gives no arg is not listed. A shared link is then checked against those kinds:
  where the story gives a text, a link may set any text, even for a prop whose type takes a few values only, so give
  such a prop `argTypes` options (`{ control: "select", options: [...] }`) to keep a link to them. `forgebook story` answers `"componentDocs": "off"`
  with no `docs`, and `forgebook changed` says it finds no story through the imports. `forgebook docs` and `forgebook new`
  still read the types when run, since they are asked for that. `usedIn: true` with it is an error.

## When a configuration is refused

Everything below stops every command with an exit code of 1 and a message that names the mistake, and a Vite build with
the plugin too, since each would otherwise give a catalogue that looks right and is not:

- **A key nothing reads.** `toolbr: […]` says `it has no key "toolbr". Did you mean toolbar?`; a preset's keys and those of
  `build`, `shell`, `a11y`, `backgrounds`, `widthRange` and `controls` are checked too. An adapter's and a plugin's options
  are their own functions' arguments, so nothing adds a key to the configuration.
- **A toolbar, a key or a view the shell cannot use**, as [the toolbar](#the-toolbar) says.
- **A file that does not load.** A syntax error is named as `/path/forgebook.config.ts:3:3: …`, in the configuration or in a
  TypeScript file it imports. In a JavaScript file it imports, Node gives no place, and the message names the configuration.
- **A story pattern that matches nothing**, for `forgebook build`, `stories` and `check`: each pattern is read on its own,
  so a mistaken one beside one that works is named as well, and what a `!` pattern leaves out does not count. `verify`
  answers `not-verified` with the pattern in `skipped`, and still gives the rest of its answer (what changed, the stories
  that ran, what they found), so the empty pattern never hides a failure.
  `forgebook dev` warns instead and opens a home that says where it looks, since you may be about to write the first story;
  saving a file the patterns match shows it. A source's own patterns are its module's to read, and a list of `docs` globs
  may match nothing.

## Stories that load

A frame says a story is ready only once what the story loads is in the page, so `check`, `verify`, `shot`, the generated
tests and the compare view read the content and never a fallback. A play function starts after the same wait, and the
frame waits again after it, for what its clicks load. For React (Next.js and React Native too) and Vue (Nuxt too), that
is every `Suspense` boundary, whoever wrote it, however deep; in React also a transition or a deferred value still
loading, which shows no fallback.

The wait is bounded: 10 s by default. Past it the frame's status is `pending`, with the reason on the page and in
`data-forgebook-pending-reason`. `check` reports the story `notVerified` and exits non-zero, `verify` answers
`not-verified`, `shot` marks the picture `pending`, the generated test fails and the Accessibility card does not pass it:
what shows is not what you meant to check. Say so when a story is meant to stay there, or give it longer:

```tsx
export const Loading = { parameters: { suspense: { expected: true } } }; // a loading state: ready at once
export const Slow = { parameters: { suspense: { timeout: 15_000 } } }; // in ms; in the preview, for every story
```

`check` stops listening to a frame at 30 s, and a generated test at 25 s: past that a longer `timeout` fails as a frame
that never answered, never as a pass. A story with `expected` is checked as it first drew, and `verify` names it in
`skipped`, so a preview cannot turn the wait off unseen.

React and Vue do not say what is pending in public, so the adapters read their private tree. Each page first tries that
reading on a boundary known to be pending and on one known not to be; on a version of React or Vue where it no longer
works, every story is `pending` with that reason instead of ready on a guess. A cost of about one tree walk per story,
in the adapter. A root a story creates itself with `createRoot` is out of reach, and so is what a story loads without
`Suspense` (a `useEffect` fetch with a spinner): a play function can wait for that with `findBy…`.

The other adapters have no such wait. Angular's `drawn` waits for the application to be stable. Preact's
`preact/compat` `Suspense` and Solid's `<Suspense>` are not read; a story using them is ready once drawn, so its play
function has to wait for the content. Svelte, Web Components and plain HTML have no fallback to read (Svelte's `{#await}`
is a state of the component: the same).

## Commands

| Command | What it does |
|---|---|
| `forgebook dev` / `forgebook build` | Runs the catalogue of `forgebook.config.ts`, or builds it into static files; see [a story file that cannot be read](#a-story-file-that-cannot-be-read) |
| `forgebook prebundle` | Pre-bundles the catalogue's dependencies, as `dev` does on a first start: before it, in CI or an image |
| `forgebook stories` | Lists every story with its id and links; fails when the story index has problems |
| `forgebook story <id>` | One story: its args, its component's props, its links in a view (`--view theme=dark`) |
| `forgebook init` | Writes `forgebook.config.ts`, and a preview with the app's global style sheets, from the project's framework; names what it could not work out; `--install` installs, `--json` answers for agents ([more](#start-with-one-command)). `--from storybook` reads a project's `.storybook` (or on-device `.rnstorybook`) folder instead: framework, story globs, preview and toolbar globals |
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
| `forgebook verify` | Says whether a change is done: every changed UI file in stories that ran, in every variant, and `check-code`, with one exit code |
| `forgebook find` | Finds components by what they are for, in your own words |
| `forgebook search` | Searches the whole catalogue by its text: docs pages, props, descriptions, stories and names, with the address of each match |
| `forgebook graph` | A map of the components and tokens, generated from the source: what exists, what each is for, how to choose |
| `forgebook audit` | The colours, sizes and components a project actually uses, with no catalogue |
| `forgebook tokens` | The design tokens, one of them, or the token nearest a value (`--nearest "#1c1b1b"`) |
| `forgebook check-code` | Checks what a change adds against the design system, with an exit code for CI |
| `forgebook init --agents` | What a project's coding agents need too: `.mcp.json`, instructions and skill, CI, a hook running `verify`; `--browser` installs the testing package and its browser, `--draw` draws a story ([more](#set-a-project-up-in-one-prompt)) |
| `forgebook hook <assistant>` | What an assistant's hook runs when it is about to finish: `verify` on the change, sending the agent back on red |
| `forgebook browser` | Installs the browser the checks run on, with the Playwright that will open it, whatever other Playwright the project has; `--with-deps` also installs what it needs of the system |
| `forgebook agents` | Adds Forgebook's short instructions to the project's `AGENTS.md` (and an [Agent Skill](https://agentskills.io) with `--skill`, in `.agents/skills` and `.claude/skills`) |
| `forgebook guide` | Prints the rest of the instructions on demand: a framework's or a topic's full text |
| `forgebook docs` | Writes a package's `CATALOG.md` and `llms.txt` from its exports, their TSDoc and its stories |
| `forgebook-texts` | Checks a package's story texts and lists what each language still has to translate |

Each command prints its options with `--help`; `stories` and `story` print JSON with `--json`.

### A story file that cannot be read

On a dev server, a story file that does not parse, or that has no meta, is one problem and the rest of the catalogue
keeps drawing. The problem names the file with its line and column, on the page, in `forgebook stories`, `forgebook
errors` and their MCP tools. Saving the fix is enough, with no restart: a story already drawn stays drawn while its file
is broken, and redraws in place. `forgebook build` and a test run still fail on it: a build ends with
`src/Bad.stories.tsx:4:45 does not parse: …` and a non-zero exit, and only `--verbose` adds the bundler's stack.

A story that loads but cannot be drawn says why in its frame and in `forgebook check`. A frame's stack gives the lines of
the code the browser runs, not those of the file; the browser's console maps them.

`forgebook build` names each script it writes by its hash alone (`assets/3f9a1c2b.js`): a catalogue names every story
file's scripts once per loader, so shorter names make a smaller build. To read what a build holds, name each script after
its module too (`assets/Button-3f9a1c2b.js`), for one build with `forgebook build --readable-names`, or for every build in
the configuration:

```ts
export default defineConfig({ /* … */ build: { readableNames: true } });
```

A component's docs, a story file's code and a component's page are data, not scripts: a build writes each as a gzipped
`.bin` file, which the page unpacks when it shows it, or in the story index itself when it is shorter than that file
(a story file whose stories are all args has no code).

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
the Accessibility card: a build keeps axe gzipped, and the frame runs it from a blob once unpacked. It also needs the
catalogue's own origin in `connect-src` (`'self'`): the page fetches the docs, code, pages and "Used in" a build keeps
gzipped. This workflow builds on
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
        with:
          name: catalogue-preview
          path: preview
      # then publish the folder, for example:
      # GitHub Pages:  actions/upload-pages-artifact, then actions/deploy-pages (one site, so without --base per PR)
      # Cloudflare:    npx wrangler pages deploy preview --branch "pr-${{ github.event.number }}"
      # Your server:   rsync -az preview/ "user@host:/var/www/previews/pr-${{ github.event.number }}/"
```

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

### What the dev server gives a client

`forgebook dev` listens on localhost unless you pass `--host`, and on both of its ports it answers with these limits:

- **Another site's page gets nothing it can read.** A request a browser marks as another site's (`Sec-Fetch-Site`), or
  with a foreign `Origin`, is refused for every module, file and API. A link or a frame from elsewhere can open the
  catalogue's page, the frame page, an inline preview and a file of the public folder, whose content that site cannot
  read. Vite checks `Host`
  first (`server.allowedHosts`, plain HTTP only), which stops a site that reaches `127.0.0.1` through its own domain.
- **Only the files your project names are listed or read.** A catalogue's `stories` and `docs`, and the groups a module
  of yours imports (`?forgebook-files`), are the only groups the server reads, whatever an address names: any other
  answers 404. A catalogue's tab left open across a restart gets its groups all the same. A query that
  names one file (`?forgebook-code`, `?forgebook-markdown`) follows Vite's `server.fs`, as `?raw` does.
- **`server.fs.deny` wins over your globs.** A file it refuses stays out of the catalogue, its search and "Used in", with
  a warning. A file your globs name outside `server.fs.allow` is listed and served, as Vite serves any file a module of
  the project imports.

A command, an agent or `curl` sends no browser headers: `forgebook mcp`, `forgebook stories` and the agent API
(`/__forgebook/api/`) work as usual, and anyone who can reach the port can use them. With `--host` that means your whole
network, so use it only on one you trust.

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
}
```

A library with design tokens (`tokens` in the configuration) can theme the shell from them in a few lines. Each role takes the
token's value in both appearances, its `light` and `dark` themes first; colours written by hand win, and a token that
is not there or is no colour is warned about and leaves the shell's own. The theme is read when the configuration is, so
restart after editing the tokens.

```ts
shell: { theme: { fromTokens: { accent: "color.brand.primary", surface: "color.background.card" } } }
```

Every role is optional, and typed by `ShellTheme` (`import type { ShellTheme } from "forgebook/shell-theme"`): the grounds
`window`, `sidebar`, `surface`; `separator`, `hover`; the texts `text`, `text-secondary`, `text-tertiary`, `accent-text`,
`danger-text`; `accent`; and the `code-*` colours. Renaming or removing a role is a breaking change. A preset can give a
theme too, and the catalogue's wins role by role.

The reader's Interface menu also offers **Follow the story**, where the catalogue has a theme switch: a dark story in a
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
denies a third-party frame its storage. What it does take from outside is its address, checked as the catalogue's own
`args` are: a story receives only the props its panel can set, with a value of their type. A prop the story does declare
still reaches it, so a story that renders a prop as raw HTML should not be published for anyone to frame.
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

### Set a project up in one prompt

```sh
npx forgebook init --agents --browser --draw --json
```

Unattended, it writes the catalogue's files, then:

- **`.mcp.json`**, with Forgebook's server beside the ones it holds.
- **`AGENTS.md`** (Forgebook's section, its other sections kept) **and the skill**, in `.agents/skills` and `.claude/skills`.
- **A CI workflow**, `.github/workflows/forgebook-verify.yml`, running `forgebook verify` against a pull request's target.
- **A hook that runs `verify`**, so an agent cannot finish on red. `--hooks` names them; by default those of the assistants
  the repository shows signs of, otherwise the commit's.

`--browser` installs `@forgebook/testing` and its browser, about 200 MB, and implies `--install`. `--draw` then writes a
component's first stories and draws them in the browser, trying components until one draws and removing the stories of those
that do not. If components fail for want of a provider, on React, the wrappers the app's entry mounts it in are copied into the
preview as a decorator (`draw.liftedProviders`), and stay there if a story then draws. When none does, each attempt is in `draw.attempts` with a `kind` (`missing-import`, `provider`, `style-sheet`,
`server-only`, `native-build`, `blank`…), what was said and what to do; the exit code is then 1.

`--agents` merges and never replaces what the project wrote (the skill's file is Forgebook's own, and is renewed): a JSON file it cannot parse, a link, a workflow or a commit hook already there stays as
it is and is named in `nextSteps`. It keeps a catalogue already there and starts beside a Storybook, loading nothing of it.
In a workspace's package, the files go at the repository's root, and find the package through its folder; a repository that
does not track the package (a home folder kept in git, say) is not used, and they go in the package's folder.

| `--hooks` | Writes | When | On red |
|---|---|---|---|
| `claude` | `.claude/settings.json`, `Stop` | Claude Code is about to finish | Sent back (exit 2) |
| `codex` | `.codex/hooks.json`, `Stop` | Codex is about to finish, once the hook is reviewed and trusted | Sent back (exit 2) |
| `gemini` | `.gemini/settings.json`, `AfterAgent` | Gemini CLI's turn ends | Sent back (exit 2) |
| `cursor` | `.cursor/hooks.json`, `stop` | Cursor's agent ends | Another turn starts with the reason: its `stop` hook cannot refuse |
| `pre-commit` | `.husky/pre-commit`, else `.git/hooks/pre-commit` | A commit (`verify --quick`) | The commit is refused |

Those formats are the ones each assistant's documentation gives; no assistant was run against them here. An assistant not
listed reads the instructions, and meets the commit's hook.

The hook is `forgebook hook <assistant>`. Each time an assistant stops, it loads the catalogue's configuration, so the
project's code runs unattended there as it does for `verify`. A branch that changed no UI file since it left its default
branch starts no server. A failure that comes back the same while the hook itself is what continued the turn lets the agent
finish, told not to call the change done: an agent that cannot fix something must not spin on it. A hook that cannot run lets
the agent finish, with a word on stderr, because no agent can repair it. The commit's hook refuses a commit the same way, on
what the branch changed and not only what is staged; `git commit --no-verify` is the way past it, and a clone that has not
installed yet commits as before.

`forgebook init` alone runs none of the project's code. `--draw` does, as starting a catalogue does: see [the app's
build](#the-apps-build). An install runs what the project's package manager settings and the packages' scripts say.

### What agents read

A story's values can be set without the panel: `controls` in `forgebook story --json` and `get_story` says what each prop
takes, and `forgebook story <id> --args '<json>'` or `story_address` with `args` checks the values as a link's are and
answers the links that carry them ([the panel's controls](#the-panels-controls)).

`forgebook agents` gives a project's coding agents what they need without being told, as a section of `AGENTS.md` of under
3 KB (renewed in place when it runs again; `--skill` writes the same as an Agent Skill any agent can load): what to run
before saying a change is done, how to look things up, and how to write a story in this project's framework, read from its
catalogue or its `package.json` (`--framework` names another). Agents work better with text they ask for than with a long
file, so the rest waits for them: `forgebook guide` lists the topics (a framework, `stories`, `devices`, `switches`, `docs-pages`,
`links`, `commands`, `setup`), `forgebook guide <topic>` prints one and `forgebook guide all` the whole guide.

A coding agent can use the catalogue while it works: find a story's id, read a story's args and its component's
props, and hand a person the link that opens it. Add the MCP server to the project's agent configuration, for
example `.mcp.json` for Claude Code:

```json
{ "mcpServers": { "forgebook": { "command": "npx", "args": ["forgebook", "mcp"] } } }
```

It offers 23 tools: `verify`, which says whether a change is done, `visual_diff`, `check_code`, `component_graph`, a map of the components and tokens to read instead of opening files, `check_page`, which checks a real page of the application, `list_stories`, `changed_stories`, `find_component`, which finds a component by what it is for, `get_story`, `story_address`, `new_stories`, which writes a component's first stories from its props and answers the text without writing a file, `check_story`, which runs the catalogue's browser checks on a story and answers its problems (the project needs `@forgebook/testing` and Playwright for it), `recent_errors`, what the frames open in a browser reported while the agent edited (numbered: `since` gives only the new ones), and `story_shot`, a story's pictures in the answer itself, so the agent looks at what it made, `list_pages` and `get_page`, which read the catalogue's docs pages as Markdown, `search_catalogue`, the search people use, `list_tokens`, `get_token` and `nearest_token`, the design tokens, `list_plugins`, what the catalogue's plugins add, `list_switches`, its switches and each value's view, and `get_guide`, the guide above, a topic at a time. `check`, `shot` and their tools take a view in the address's form (`theme=dark&width=360`) or as words (`"dark it 360"`); every story's `links.component` opens its component's page in that view, so `--view audience=designer` on `forgebook story` and `get_story` gives a link to send a designer. `get_story` also gives the components whose stories use the story's component (`usedIn`), so an agent finds a real use before writing one; `list_stories` gives it for every component when asked (`usedIn: true`, or `forgebook stories --used-in`), since it reads the package's import graph. Run from the catalogue's folder (or give
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

The most common mistake of an agent working on a design system is a colour or a size written by hand. Agents can ask what
to write instead, with nothing set up: Forgebook reads what the application already declares (see `check-code` below). To
say it yourself, name your [DTCG](https://www.designtokens.org/tr/2025.10/) files in the configuration, the base first and
each theme in a file of its own, and those are the system:

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
```

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
`forgebook search` and `search_catalogue` read the rest, with the same ranking: a prop's name, a sentence of a docs page,
each result with the words it missed and the address that opens the exact heading or prop.

`forgebook check <id> --semantic` also asks a model what axe cannot see: whether a heading describes its section, an
image's text says what it shows, a label says what its control does. It is off unless asked, and sends each story's
accessibility tree and picture to the OpenAI-compatible API in `FORGEBOOK_SEMANTIC_URL`, with `FORGEBOOK_SEMANTIC_MODEL` and,
when it needs one, `FORGEBOOK_SEMANTIC_KEY`. No model comes with Forgebook and no key is stored. What it answers lands in
`judgements`, apart from the problems, as an opinion: it does not fail the check.

`forgebook check-code` and `check_code` read what a change adds, new files included, from where it left `--since`: a colour
written by hand, with the token to use when one clearly fits; a size that equals a token; a check turned off with no
reason (`@ts-ignore`, `eslint-disable`, `biome-ignore`, `stylelint-disable`); a test deleted. Only styles and components
are read for values: stories, tests, token definitions and generated files are left alone. A fix is a token's name, not
code to paste. It does not check props, which the type checker does. It exits non-zero on a problem, for CI.

It also reads what a change reuses. An added import of a component whose own TSDoc says `@deprecated` or `@replacedBy` fails,
naming what to use. A new exported component fails as `duplicate-component` when its code is a copy of another's under any name;
or when it has the name of one that exists, past words like `Primary` or `Custom`, and two signs of being it (a telling root
such as `button`, shared props, nearly the same classes); or when `Button` exists and a new `CustomButton` renders a plain
`<button>`, though not a `SubmitButton`, which says what it is for. New means new since the commit compared with: an edit or a
moved file is not. It compares only what the file could use, in its package and those its package depends on. It passes if it
renders the other, which is reuse, or if a comment says why, above it: `// forgebook-ignore duplicate-component: why`, listed
in `excused`. One sign, and what `@useWhen` and `@avoidWhen` say of a component just imported, are `advice`, which fails nothing.
Imports are followed relative, through `@/`, `~/` and `#/` under the importing file's own folders, and by a workspace package's
name; not through a third party.

**It needs no tokens file.** With none named, it compares with what the application already declares, read as text and never
run: custom properties at the root and in theme selectors (`.dark`, `[data-theme]`, a colour-scheme query), and a selector
holding a dozen or more of them, as a library's root does; Tailwind 4's `@theme` and default theme; a Tailwind configuration
and its presets, as far as they are written plainly; the sheet and the configuration `components.json` names. `tokenSources`
says which files were read and `tokenNotes` what needs running to know. Fewer than five colours is not a palette, so colours
are then left to `skipped`. A value it cannot judge takes a comment on its line or the one above, with the reason:
`/* forgebook-ignore raw-color: a brand's own colour */`; the answer lists each one in `excused`, with its reason. Only files
in the catalogue's folder are compared (`notCompared` names the others), since another package has its own system. Nothing
outside the repository is read, whatever a file names, and a catalogue's `build --agent-index` carries these tokens. `tokens:
[]` in the configuration says the application is not to be read: with no source giving tokens, values are then not checked,
`colours and sizes not checked: no tokens file`.

What it leaves alone on purpose, since these are where false alarms came from on real projects: a drawing's colours (`<path
fill>`, gradient stops, a canvas), masks, fully transparent ends of gradients, black or white in a shadow, a `var()`'s fallback,
what the page's head reads (`theme-color`), emails and generated social images. A size is compared with tokens of its own
role (spacing, radius, font size) that are steps of a scale, so `--sidebar-padding: 16px` does not make every `16px` a
mistake; Tailwind's own scale counts only where a class's brackets hold the whole value (`p-[16px]`, not `h-[calc(100%-16px)]`).

A design system can say how to choose among fixed patterns and how its parts fit, in a few tags of a component's TSDoc, with
nothing new to learn:

```ts
/**
 * Pick one of a few options, all in view.
 *
 * @intent choose-one: up to five options, all visible
 * @parent Form, Fieldset
 * @children Radio
 * @insteadOf select
 */
export const RadioGroup = …
```

Components sharing an `@intent` are the choices for it, and agents read them with `forgebook graph --intent choose-one` or
`component_graph`, or as `advice` when they import one. `check-code` enforces what can be checked, in `.tsx` and `.jsx` only,
as `composition`: an element under a component `@parent` does not allow; a component `@children` or `@siblings` does not allow;
a plain `<select>` where `@insteadOf` names one. An element at the root of what a component returns, or held in a prop, may be
rendered anywhere, so its parent is not judged; a component above that itself renders an allowed parent passes; and which pattern a screen should have used is not something a check can tell. A file beside a
component that cannot carry a comment says the same, named after the file or the component: `radio-group.rules.json` or
`RadioGroup.rules.json`, `{ "RadioGroup": { "intent": ["choose-one: up to five options"], "parent": ["Form"] } }`. A meant exception takes `// forgebook-ignore composition:
why`, listed in `excused`.

`forgebook graph` is the map itself, generated from the source so it cannot drift: components, what each is for, what renders
what, token counts; `--component Button` adds what renders it and the tokens its file uses. It needs no catalogue.

`forgebook audit` reports what a project actually uses, read from its files, with no catalogue, no configuration and no code
run: `37 greys, 5 used 90 % of the time`. It is for a project with no design system as much as one with: colours in any
notation counted as one, how many go through tokens and how many are written by hand, sizes by what they are for, and
components that look like one, by name and by what they render, take and carry, never by name alone. It exits 0: it is a
report, and `check-code` is what fails. With `--json`, `actions` lists the next steps, the largest first, each with the
command that lists what to edit:

```sh
npx forgebook audit --json
npx forgebook audit --value "#64748b" --json   # every line that writes it by hand
```

It does not read a tokens file a catalogue names, only what the application declares, and a `.js` file's JSX is not read.

`forgebook verify` and `verify` are what an agent runs before saying a change is done, and what a pull request's workflow
runs. A change cannot pass on nothing:

```sh
$ npx forgebook verify --since origin/develop
src/Badge.tsx  not verified: no story reaches it. Fix: npx forgebook new src/Badge.tsx
2 changed UI files, 1 with stories: not verified; colours and sizes not checked: no tokens file
```

- **Every changed UI file is covered or fails.** A UI file is a component or a style sheet by its extension (`.tsx`, `.jsx`,
  `.vue`, `.svelte`, `.astro`, `.component.ts`, `.component.html`, `.css`, `.scss`, `.sass`, `.less`), a story file, or a
  script whose text defines or draws a component (`customElements.define`, `LitElement`, `@Component`, `defineComponent`,
  JSX in a `.js` file). Tests, type declarations and generated files are not, and neither is any other script: a helper
  or a hook does not fail, and the stories it reaches still run. What `check-code` finds in a file no one sees (a turned-off
  check, a deleted test) is a note in the answer; `check-code` itself still fails on it.
- **A file used through another component counts, and says so.** Stories reach a file through what they render and what
  those files import, by the file that declares each imported name, so being exported from a barrel covers nothing. A
  sheet counts through whatever imports it, `@use` and `@import` followed; a preview and the sheets it names are shown by
  every story. Only stories that ran count: a project with no browser gets `not-verified`, and the reason.
- **What was not checked is never reported as passed.** `skipped` is in the verdict (`partly-verified`) and in the line:
  colours and sizes without a tokens file or with one that cannot be read, accessibility with `a11y: false`, a UI file only
  another catalogue of the repository can answer for. None of these fails. A UI file nothing reaches in a package with no
  catalogue of its own does: it is this catalogue's to show. So does a package whose types point at its build, since
  imports stop there.
- **It compares from where the branch left.** `--since <ref>` starts from the merge base, so what the base gained since is
  not read as your change; with no `--since`, from the default branch (`origin/HEAD`, then `main` or `master`), so what you
  committed counts. A branch cut from another, as `develop`, gives it with `--since`. With no `--since`, an empty change
  is `not-verified`: the work may be committed where this cannot see, as in a shallow clone. CI gives `--since` and the
  history: `fetch-depth: 0`.
- **Every variant by default**, each story in light, dark, both at more contrast, the structure only, and narrow, on one
  browser, four pages at once. `--quick` runs the default view, and the verdict says so.

The exit is non-zero on `failed` and `not-verified`, zero on `verified`, `partly-verified` and `nothing-to-verify`. The
JSON answer is schema 2: `verdict`, `summary`, `skipped`, `since`, `base`, `variants`, `files`, `uiFiles` (each with its
`coverage`, and its `reason` and `fix` when not covered), `storyCount`, `stories` (the first twenty, with their links),
`ran`, `failures` (only what found something), `notVerified` (stories still loading when the frame gave up), `code` (`checked`, `problems`, `notes`) and `problems`.

A library tells agents what it offers with `forgebook docs`, run in its folder: `CATALOG.md`, one dense line per
component, hook, helper and style module (what it is, how to import it, its props, the id of a story that shows it),
docs page and design token of its source (its value, each theme's, what it aliases, what it is for), and `llms.txt`,
which points an agent to it and links the pages. The file's name, its sections and the subpaths left out are set in the
package's `package.json`:

```json
{ "forgebook": { "catalog": { "file": "CATALOG.md", "sections": ["components", "pages", "modules"], "exclude": ["./internal/*"] } } }
```

`forgebook docs --check` fails in CI when either file is stale. In CI, `forgebook stories --json` fails on a broken story file (a title taken twice, a title that cannot be placed, a file that does not parse) or a
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
