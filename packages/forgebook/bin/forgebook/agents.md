## Stories (Forgebook)

This project's components have stories, shown by [Forgebook](https://github.com/ensiria/forgebook) (`forgebook dev`).
When you add or change a component, add or change its stories, then check them with the commands below: they answer
in JSON with `--json`, and every answer about a story carries the links that open it for a person.

### Writing a story file

- One file per component, beside it: `Badge.tsx` and `Badge.stories.tsx`, in CSF 3 (Storybook's format; Forgebook
  reads it, never MDX or addons). Files with the same title are one component, as in Storybook: each story keeps its
  own file (`file` in `forgebook stories --json`), and the component lists them all (`files`).
- Every named export of a story file is a story; leave helpers and data out with the meta's `excludeStories`.
- The catalogue lists the files its `stories` globs name in `forgebook.config.ts`; a glob that starts with `!` leaves
  files out (`"!src/**/drafts/**"`), whatever its place in the list. A new story file that `forgebook stories` does not
  list is outside the globs, left out by a `!` one, or refused by Vite's `server.fs.deny` (the dev server warns): put it
  where they list it, or change the globs on purpose.
- A story glob that matches nothing stops `forgebook build`, `stories`, `check` and `verify` with an exit code of 1 and
  names the glob; `forgebook dev` warns, and `list_stories` carries it in `problems` until a file matches. A misspelt
  configuration key, a toolbar naming no control and a file that does not load (`file:line:column` for a syntax error)
  stop every command the same way, so read the message before looking elsewhere.
- `args=` in a story's address takes Forgebook's JSON or a Storybook link's form (`label:Hello+world;count:5;open:!true`);
  what a story cannot take or an arg cannot hold is listed above it, by name.
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
  `src/routes`), `page.data` or the page's own `load` (run before the story is drawn, its fetch answered by
  `parameters.msw` in the frame and in the server tests, where a fetch of the page's origin that no handler answers
  fails the story), and `forms.result` for what an enhanced form's action answers. Links and `goto` move the story's page and are listed among
  its events; in a play, `storyPage()` from `@forgebook/sveltekit/page` reads where it went and the calls it made. A
  component that imports `$app/env/private` or `$app/server` fails in its frame by design: give it what it reads instead.
- `parameters.main: true` marks the one real, well-made use drawn at the top of the component's page.
- `parameters.group` puts a story under a heading of the page (`"states"`, `"worst-case"`); keep one story per
  meaningful state, not one per prop value.
- Add a worst case: very long text, words without spaces, huge numbers (`forgebook new` writes one).
- To try a component as on a phone, the catalogue's Touch switch (`touch=touch` in a view: `--view "touch=touch"`)
  sends the story a finger's events and a phone's hover and pointer media; a tap on a text field focuses it and puts the
  caret there. It is a simulation: native scrolling, the
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
- A screen meant for a phone or a tablet can be shown in a drawn device by default:
  `parameters: { device: { frame: true, model: "iphone-16" } }` (on the meta for every story; `orientation:
  "landscape"` turns it; a story in a device is touched as a phone is, unless `touch: false`). The models: `iphone-16`, `iphone-16-pro-max`, `iphone-16e`, `pixel-9`, `galaxy-s24`, `phone`
  (generic), `ipad-mini`, `ipad-pro-13`. The status bar, the camera's cut and the home indicator sit
  around it: the story is drawn inside the safe areas. A screen drawn edge to edge says `edgeToEdge: true` and pads
  itself with `var(--forgebook-safe-area-top, env(safe-area-inset-top))` (and `-bottom`, `-left`, `-right`). `get_story` returns the setting as `device`. Pictures and
  tests stay unframed unless a view names a model: `forgebook shot <id> --view "iphone-16"` (or `"dark pixel-9
  landscape"`) gives a framed picture.
- A hook or a function gets stories about logic: `parameters: { logic: true }` on the meta, its `component` the hook
  (`satisfies LogicMeta<typeof useUndo>` in React), each story a `render` with a small scene using it and a `play`
  that tries it. The catalogue documents its signature from its types and TSDoc (`@param`, `@returns`), and the tests
  check it once instead of in every look. A title like `Hooks/useUndo` puts it in a Hooks section.
- `parameters.design: { figma: "<node link>" }` on the meta links a component to its design in Figma; a story writes its
  own over it. `forgebook story` returns it as `design` (the link, `fileKey`, `nodeId`, and the `address` to hand a
  person); with `@forgebook/plugin-figma` listed the panel adds a Design tab.
- `parameters.msw: { handlers: [...] }` answers a story's requests, with `@forgebook/plugin-msw` listed in the
  configuration's `plugins`, which also adds a Network tab; without the plugin the parameter does nothing.
- Texts a person reads come from the source's texts, not from the story: `args: { label: storyText("badge.new") }`
  (`@forgebook/story-format/texts`), or `useStoryText()` inside a `render`. A source gives each language's table, or a
  loader of it (`texts: { en: () => import("./locales/en.json") }`), which keeps the texts out of the catalogue's page.
- Write `title`, `parameters.main`, `group`, `height`, `touch`, `logic`, `requiredFirst` and `design.figma` as plain
  values: the catalogue reads them without running the file.
- In a Next.js project (`framework: nextjs()`), stories take their types from `@forgebook/nextjs`. A story says where
  its component is with `parameters.nextjs.navigation` (`pathname`, `query`, `params`; `router` for the Pages Router),
  and what its server code reads with `nextjs.cookies`, `headers` and `draftMode`. A link or a router call moves the
  story's route and is listed among its events; a `play` reads where it went with `storyRoute()`
  (`@forgebook/nextjs/route`). Async server components are drawn; what they reach on a server (a database, the file
  system) is not there: fetch it and mock it with `parameters.msw`. In the server tests a server component's `fetch` never
  reaches the network, whatever its address: a fetch no handler answers fails the story, naming the address.

- Say when a component is for and when it is not, in its TSDoc: `@useWhen`, `@avoidWhen`, `@alternatives`, `@deprecated`,
  `@replacedBy`. `forgebook story` returns them as `docs.guidance`: read them before using a component, and never use a
  deprecated one.
- A component with many props names their groups in its TSDoc (`@group Paging`): `forgebook story` returns each
  prop's `group`, and a prop typed with a documented object (`texts?: FinderTexts`) its `members`, each with its type,
  default and TSDoc: read them to know every text a component takes before passing one.
- `forgebook story --json` and `get_story` give `requiredProps` at the top, the names of the component's props every
  use must set (events among them; a subcomponent's say it with their own `isRequired`); `docs.props` stays in the
  order of the source, whatever the catalogue's `requiredFirst` shows a person.
  Set every name in `requiredProps` when you use the component or write its story.

### Docs pages

Guides live in Markdown files, listed in the catalogue's Docs section. Read one before writing against it
(`npx forgebook page <id>`). When you write one: front matter with `title` (`Guides/Theming`), `order` and `description`, a
fence named `story <id>` for a live story and `props <component id>` for an API table, and links to other pages by their
file (`./colours.md#brand`). A page never holds a story's code: show the story. Blocks are `:::note`, `:::tip`,
`:::important`, `:::caution`, `:::danger` (or GitHub's `> [!NOTE]`), `::::tabs{syncKey="…"}` around `:::tab[Label]`,
`:::steps` around a numbered list, `::::cards` around `:::card[Title]` and `::link-card[Title]{href="…"}`; a block inside
another has fewer colons. A code fence takes `title="…"`, `{1,4-6}`, `ins={…}`, `del={…}`, `wrap`, and `diff lang="tsx"`.
After writing one, run `npx forgebook pages`: it fails with each problem's line and column.

The catalogue's home may be written too (`forgebook.home.md`): `npx forgebook page home` reads it, and its values
(`{{components}}`) and pieces (`::families`, `::libraries`, `::recent`, `::pages`) are listed in the README.

### Links for a person

Every story's `links` hold its page (`address`), its frame (`frame`), its component's page (`component`) and its
embed (`embed`). A component's
page can be drawn for who reads it: add an audience to the view, and send that link. `designer` shows usage guidance first
and no code, `coder` the API first with the code open, `tester` what the stories cover and their accessibility check:

```sh
npx forgebook story <id> --view audience=designer --json   # links.component opens the page for a designer
```

Each story also says whether a `play` function acts on it (`hasPlay`), and `tags` holds `!test` when the generated tests
leave it out.

### Commands

| Command | What it is for |
|---|---|
| `npx forgebook find "selectable card" --json` | Whether what you need already exists, in your own words: ask before writing a component |
| `npx forgebook search onValueChange --json` | The whole catalogue by its text: which component has a prop, where the docs say something, with the address of the exact heading or prop |
| `npx forgebook new src/Badge.tsx` | A component's first stories, from its typed props (`Badge.vue` or `badge.component.ts` writes `Badge.stories.ts`) |
| `npx forgebook stories --component badge --json` | The stories and their ids; fails when a story file is broken |
| `npx forgebook story <id> --json` | One story: the props every use must set (`requiredProps`), its args, its component's props, the components whose stories use it, its design |
| `npx forgebook pages --json` | The docs pages, with their ids and addresses; fails when a page names what is not there |
| `npx forgebook page <id> --json` | One docs page: its Markdown, its headings, the address that opens it |
| `npx forgebook check <id> --json` | The catalogue's checks on one story: accessibility, spills, overlays, a modal's focus, errors, a failed play |
| `npx forgebook check <id> --json` | The catalogue's checks on one story: accessibility, spills, overlays, errors, a failed play |
| `npx forgebook plugins --json` | The plugins the catalogue lists: their tabs (`tab=<id>` in a view opens one), switches and docs fences |
| `npx forgebook tokens --category color --json` | The design tokens, of the catalogue and of the libraries it shows; `clashes` says whose value stands where two disagree |
| `npx forgebook tokens --nearest "#1c1b1b" --json` | The token to write instead of a raw value; the type comes from the value, or `--type padding` |
| `npx forgebook check-page http://localhost:3000/checkout --json` | The same checks on a real page of the application: the screen you built, not only its stories |
| `npx forgebook changed --json` | The stories your change touches, through what they import |
| `npx forgebook verify --json` | The checks on all of them, with one exit code: run it before you say a change is done |
| `npx forgebook check-code --json` | What your change adds against the design system: raw values, with the token to use, turned-off checks, deleted tests |
| `npx forgebook errors --json` | What the open frames reported while you edited: render errors, failed plays |
| `npx forgebook shot <id> --view "dark 360"` | The story as a picture, to look at it (a view as words, or `theme=dark&width=360`); a model's id in the view (`iphone-16`) frames it in that device |
| `npx forgebook story <id> --json` | Its `links`: `address` in the catalogue, `frame` alone, `embed` with no chrome, for a wiki or an iframe |
| `npx forgebook shot <id> --update` then `npx forgebook diff <id> --json` | Baselines, then what changed against them: the region, the percentage, a marked picture |

Never write a raw colour or size when a token exists: ask `tokens --nearest` first, and use a match only when it says
`isClose` or `isExact`. A match that is not close means no token fits: say so, do not force one.

A catalogue may turn off its accessibility check (`a11y: false`) or its component docs (`componentDocs: false`). Then a
check's report says `"a11y": "off"` (it ran no axe: a pass says nothing of accessibility), and `story` says
`"componentDocs": "off"` with no `docs` and no required props: read the component's source for its props, and the
story's args for what it sets; `changed` finds no story through the imports, so check the stories you touched by name.

A story's frame runs on its own origin (the dev server's second port), unless the catalogue keeps it on its own
(`frames: "same-origin"`, `forgebook dev --frames same-origin`): open a story by the `page` or `frame` link an answer
gives, never by building a frame's address yourself, and do not expect a story's code to reach the catalogue's page or
its API.

An edit you save reaches the open story at once, a story file's in tens of milliseconds. One that the open story does
not show may not have reached the dev server: in a container, a Windows drive under WSL or a network drive, run it
with `forgebook dev --poll`.

Run `npx forgebook <command> --help` for the options. With an MCP client, `npx forgebook mcp` offers the same as tools.

A client that renders MCP Apps also gets `story_preview`, which shows a story to the person, live, inside the conversation.
You do not see what it shows: to look at a story yourself, use `shot` (`story_shot`). Where the tool is not listed, the
client cannot show one: give the person the story's link, or its picture.
