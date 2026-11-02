## Stories (Forgebook)

This project's components have stories, shown by [Forgebook](https://github.com/ensiria/forgebook) (`forgebook dev`).
When you add or change a component, add or change its stories, then check them with the commands below: they answer
in JSON with `--json`, and every answer about a story carries the links that open it for a person.

### Writing a story file

- One file per component, beside it: `Badge.tsx` and `Badge.stories.tsx`, in CSF 3 (Storybook's format; Forgebook
  reads it, never MDX or addons).
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
- `parameters.height` gives the frame the room an overlay the story opens needs (a menu, a popover), in CSS px.
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
  (`@forgebook/story-format/texts`), or `useStoryText()` inside a `render`.
- Write `title`, `parameters.main`, `group`, `height`, `touch`, `logic` and `design.figma` as plain values: the catalogue reads them without running
  the file.

- Say when a component is for and when it is not, in its TSDoc: `@useWhen`, `@avoidWhen`, `@alternatives`, `@deprecated`,
  `@replacedBy`. `forgebook story` returns them as `docs.guidance`: read them before using a component, and never use a
  deprecated one.

### Docs pages

Guides live in Markdown files, listed in the catalogue's Docs section. Read one before writing against it
(`npx forgebook page <id>`). When you write one: front matter with `title` (`Guides/Theming`), `order` and `description`, a
fence named `story <id>` for a live story and `props <component id>` for an API table, both at the page's top level, and
links to other pages by their file (`./colours.md#brand`). A page never holds a story's code: show the story.

### Links for a person

Every story's `links` hold its page (`address`), its frame (`frame`) and its component's page (`component`). A component's
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
| `npx forgebook new src/Badge.tsx` | A component's first stories, from its typed props (`Badge.vue` writes `Badge.stories.ts`) |
| `npx forgebook stories --component badge --json` | The stories and their ids; fails when a story file is broken |
| `npx forgebook story <id> --json` | One story: its args, its component's props, the components whose stories use it, its design |
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
| `npx forgebook shot <id> --view "dark 360"` | The story as a picture, to look at it (a view as words, or `theme=dark&width=360`) |
| `npx forgebook story <id> --json` | Its `links`: `address` in the catalogue, `frame` alone, `embed` with no chrome, for a wiki or an iframe |
| `npx forgebook shot <id> --update` then `npx forgebook diff <id> --json` | Baselines, then what changed against them: the region, the percentage, a marked picture |

Never write a raw colour or size when a token exists: ask `tokens --nearest` first, and use a match only when it says
`isClose` or `isExact`. A match that is not close means no token fits: say so, do not force one.

Run `npx forgebook <command> --help` for the options. With an MCP client, `npx forgebook mcp` offers the same as tools.

A client that renders MCP Apps also gets `story_preview`, which shows a story to the person, live, inside the conversation.
You do not see what it shows: to look at a story yourself, use `shot` (`story_shot`). Where the tool is not listed, the
client cannot show one: give the person the story's link, or its picture.
