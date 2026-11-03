## Stories (Forgebook)

This project's components have stories, shown by [Forgebook](https://github.com/ensiria/forgebook) (`forgebook dev`).
When you add or change a component, add or change its stories, then check them with the commands below: they answer
in JSON with `--json`, and every answer about a story carries the links that open it for a person.

### Writing a story file

- One file per component, beside it: `Badge.tsx` and `Badge.stories.tsx`, in CSF 3 (Storybook's format; Forgebook
  reads it, never MDX or addons). Files with the same title are one component, as in Storybook: each story keeps its
  own file (`file` in `forgebook stories --json`), and the component lists them all (`files`).
- Every named export of a story file is a story; leave helpers and data out with the meta's `excludeStories`.
- Story ids are Storybook's (`inputs-readmore--open-by-default`, prefixed by the source's id); the commands also take
  the ids Forgebook gave before (`inputs-read-more--open-by-default`) and answer with the current one.
- The meta is the default export; the stories are named exports, each with a one-line TSDoc saying what it shows (the
  catalogue shows that sentence):

  ```tsx
  import type { Meta, Story } from "@forgebook/react";

  import { Badge } from "./Badge";

  export default { title: "Data/Badge", component: Badge } satisfies Meta<typeof Badge>;

  /** The label as most pages use it. */
  export const Default: Story<typeof Badge> = { args: { label: "New" }, parameters: { main: true } };
  ```

- In a Vue project, the same with `Badge.vue` and `Badge.stories.ts`: the types from `@forgebook/vue`, the component by its
  default import, a slot as the arg `#name` (`"#default": "Text"`) and an event as its listener (`onRemove`). Open a `.vue`
  file's script with its TSDoc block: that comment is the component's.
- In a Svelte project, the same with `Badge.svelte` and `Badge.stories.ts`: the types from `@forgebook/svelte`, the
  component by its default import, a snippet's text as the arg `#name` (`"#children": "Text"`), a callback prop as it is
  (`onremove`), and a render returning `{ Component, props }`. The `<!-- @component -->` comment is the component's.
- In a Solid or Preact project, the same as React's, with the types from `@forgebook/solid` or `@forgebook/preact`. In
  Solid a render runs once: read the args inside its JSX (`<Badge label={args.label} />`) or spread them
  (`<Badge {...args} />`), never destructured, so a new value reaches the story without starting it over.
- With custom elements, `my-badge.ts` and `MyBadge.stories.ts`: the types from `@forgebook/web-components`, the element by
  its tag (`component: "my-badge"`, the module imported for its definition) or its class. An arg's prefix says what it
  sets: `label` the attribute, `.items` the property, `#icon` a slot (`#default` the unnamed one), `@change` an event the
  catalogue records, which a render does not bind. A render returns a Lit template. The props come from the package's
  `custom-elements.json`: run its analyzer after changing an element, or the docs show the old one.
- With no framework, `button.ts` and `button.stories.ts`: the types from `@forgebook/html`, the meta's `component` the
  function that draws (`createButton(args)`, returning an HTML string or a DOM node) and `satisfies
  Meta<typeof createButton>`, so the args are its first parameter, documented by that type's TSDoc; a story without a
  render calls it with the args. A story that only has a render types it with `Meta<ButtonArgs>`, or describes its args
  in `argTypes` (plain JavaScript). A text arg written into HTML is the story's to escape; a shared link hands it only
  plain words.
- In a Nuxt project, the same, the types from `@forgebook/nuxt`: a component's auto-imports, aliases and Nuxt's
  components work as in the app. Set what Nuxt would have given it with `parameters.nuxt`: `route` (a path, or
  `{ name, params }` of a page), `data` (what `useAsyncData` and `useFetch` return, by key; `useFetch`'s key is the
  request as made, `/api/products?page=2`), `state`, `cookies`, `runtimeConfig.public` and `appConfig`. A story's
  `nuxt` replaces the meta's, whole. Its router moves and `navigateTo` calls are listed among the story's events; a
  play reads them with `storyNuxt()` from `@forgebook/nuxt/story`.
- In an Angular or Analog project, `badge.component.ts` and `Badge.stories.ts`: the types and Storybook's helpers
  (`applicationConfig`, `moduleMetadata`, `componentWrapperDecorator`, `argsToTemplate`) from `@forgebook/angular`, the
  class by its name, an input or an output by the name a template binds (its alias), an output's arg a handler, projected
  content as `#default` or `#<selector>` (`"#[icon]": "*"`), and a template in a render as
  `({ props: args, template: "…" })`. The Code tab writes the story by the component's selector.
- In a SvelteKit app (`framework: sveltekit()`), the types come from `@forgebook/sveltekit`, and a story sets the page its
  components read with `parameters.sveltekit`: `page: { url: "/blog/hello" }` (the route and params are read from
  `src/routes`), `page.data` or the page's own `load` (run in the frame, its fetch answered by `parameters.msw`), and
  `forms.result` for what an enhanced form's action answers. Links and `goto` move the story's page and are listed among
  its events; in a play, `storyPage()` from `@forgebook/sveltekit/page` reads where it went and the calls it made. A
  component that imports `$app/env/private` or `$app/server` fails in its frame by design: give it what it reads instead.
- `parameters.main: true` marks the one real, well-made use drawn at the top of the component's page.
- `parameters.group` puts a story under a heading of the page (`"states"`, `"worst-case"`); keep one story per
  meaningful state, not one per prop value.
- Add a worst case: very long text, words without spaces, huge numbers (`forgebook new` writes one).
- To try a component as on a phone, the catalogue's Touch switch (`touch=touch` in a view: `--view "touch=touch"`)
  sends the story a finger's events and a phone's hover and pointer media. It is a simulation: native scrolling, the
  virtual keyboard and real Safari still need a device, or `forgebook dev --touch` (Chromium's real touch).
  A story reads it as `context.globals.touch` (`"mouse"` or `"touch"`) or fixes it with
  `globals: { touch: "touch" }`. A story meant for a phone writes `parameters.touch: true` (or its meta does): the
  catalogue draws it with a finger and offers a toggle to turn that off.
- In a React Native project (`reactNativeWeb()` in `forgebook.config.ts`), stories are written as React's, their
  types from `@forgebook/react-native-web`, and drawn in the browser through react-native-web. A screen that fills
  the window (`style={{ flex: 1 }}`) needs `parameters.layout: "fullscreen"`; the app's root providers
  (`SafeAreaProvider`, a theme) go in the preview's decorators. A component that calls a native module or a gesture
  of native code does not draw in a browser: give it a `.web.tsx` file, or mock what it calls in the preview.
- A link may carry the Props tab's values (`args=` in the address, JSON). The catalogue applies only the props the
  story's panel can set, with a value of their type; to show a story with other values, write a story with those
  args rather than a link.
- `parameters.height` gives the frame the room an overlay the story opens needs (a menu, a popover), in CSS px.
- A hook or a function gets stories about logic: `parameters: { logic: true }` on the meta, its `component` the hook
  (`satisfies LogicMeta<typeof useUndo>` in React), each story a `render` with a small scene using it and a `play`
  that tries it. The catalogue documents its signature from its types and TSDoc (`@param`, `@returns`), and the tests
  check it once instead of in every look. A title like `Hooks/useUndo` puts it in a Hooks section.
- `parameters.design: { figma: "<node link>" }` on the meta links a component to its design in Figma; a story writes its
  own over it. The catalogue adds a Design tab, and `forgebook story` returns it as `design` (the link, `fileKey`,
  `nodeId`, and the `address` to hand a person).
- Texts a person reads come from the source's texts, not from the story: `args: { label: storyText("badge.new") }`
  (`@forgebook/story-format/texts`), or `useStoryText()` inside a `render`.
- Write `title`, `parameters.main`, `group`, `height`, `touch`, `logic` and `design.figma` as plain values: the catalogue reads them without running
  the file.
- In a Next.js project (`framework: nextjs()`), stories take their types from `@forgebook/nextjs`. A story says where
  its component is with `parameters.nextjs.navigation` (`pathname`, `query`, `params`; `router` for the Pages Router),
  and what its server code reads with `nextjs.cookies`, `headers` and `draftMode`. A link or a router call moves the
  story's route and is listed among its events; a `play` reads where it went with `storyRoute()`
  (`@forgebook/nextjs/route`). Async server components are drawn; what they reach on a server (a database, the file
  system) is not there: fetch it and mock it with `parameters.msw`.

- Say when a component is for and when it is not, in its TSDoc: `@useWhen`, `@avoidWhen`, `@alternatives`, `@deprecated`,
  `@replacedBy`. `forgebook story` returns them as `docs.guidance`: read them before using a component, and never use a
  deprecated one.

### Docs pages

Guides live in Markdown files, listed in the catalogue's Docs section. Read one before writing against it
(`npx forgebook page <id>`). When you write one: front matter with `title` (`Guides/Theming`), `order` and `description`, a
fence named `story <id>` for a live story and `props <component id>` for an API table, both at the page's top level, and
links to other pages by their file (`./colours.md#brand`). A page never holds a story's code: show the story.

### Commands

| Command | What it is for |
|---|---|
| `npx forgebook find "selectable card" --json` | Whether what you need already exists, in your own words: ask before writing a component |
| `npx forgebook new src/Badge.tsx` | A component's first stories, from its typed props (`Badge.vue` or `badge.component.ts` writes `Badge.stories.ts`) |
| `npx forgebook stories --component badge --json` | The stories and their ids; fails when a story file is broken |
| `npx forgebook story <id> --json` | One story: its args, its component's props, the components whose stories use it, its design |
| `npx forgebook pages --json` | The docs pages, with their ids and addresses; fails when a page names what is not there |
| `npx forgebook page <id> --json` | One docs page: its Markdown, its headings, the address that opens it |
| `npx forgebook check <id> --json` | The catalogue's checks on one story: accessibility, spills, overlays, a modal's focus, errors, a failed play |
| `npx forgebook check <id> --json` | The catalogue's checks on one story: accessibility, spills, overlays, errors, a failed play |
| `npx forgebook tokens --category color --json` | The design tokens, of the catalogue and of the libraries it shows; `clashes` says whose value stands where two disagree |
| `npx forgebook tokens --nearest "#1c1b1b" --json` | The token to write instead of a raw value; the type comes from the value, or `--type padding` |
| `npx forgebook check-page http://localhost:3000/checkout --json` | The same checks on a real page of the application: the screen you built, not only its stories |
| `npx forgebook changed --json` | The stories your change touches, through what they import |
| `npx forgebook verify --json` | The checks on all of them, with one exit code: run it before you say a change is done |
| `npx forgebook check-code --json` | What your change adds against the design system: raw values, with the token to use, turned-off checks, deleted tests |
| `npx forgebook errors --json` | What the open frames reported while you edited: render errors, failed plays |
| `npx forgebook shot <id> --view "dark 360"` | The story as a picture, to look at it (a view as words, or `theme=dark&width=360`) |
| `npx forgebook story <id> --json` | Its `links`: `address` in the catalogue, `frame` alone, `embed` with no chrome, for a wiki or an iframe |
| `npx forgebook shot <id> --update` then `npx forgebook diff <id> --json` | Baselines, then what changed against them: the region, the percentage, a marked picture |

Never write a raw colour or size when a token exists: ask `tokens --nearest` first, and use a match only when it says
`isClose` or `isExact`. A match that is not close means no token fits: say so, do not force one.

A story's frame runs on its own origin (the dev server's second port): open a story by the `page` or `frame` link an
answer gives, never by building a frame's address yourself, and do not expect a story's code to reach the catalogue's
page or its API.

Run `npx forgebook <command> --help` for the options. With an MCP client, `npx forgebook mcp` offers the same as tools.

A client that renders MCP Apps also gets `story_preview`, which shows a story to the person, live, inside the conversation.
You do not see what it shows: to look at a story yourself, use `shot` (`story_shot`). Where the tool is not listed, the
client cannot show one: give the person the story's link, or its picture.
