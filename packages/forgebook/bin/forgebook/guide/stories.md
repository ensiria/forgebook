# Writing a story file

The framework's own guide (`forgebook guide <framework>`) has what differs in yours: its file names, types and args.

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
- **Setting a story's values without the panel.** `controls` in `forgebook story --json` and `get_story` lists every prop
  that can be set: `control` says how (`text`, `textarea`, `number`, `boolean`, `select`, `object`, `named`, `token`,
  `file`…), `shape` what a value of several parts looks like (`object` with `fields`, `list`, `tuple`, `record`, `union`,
  `named`, `json`). `forgebook story <id> --args '{"tags":["a"],"size":24}'` and `story_address`'s `args` check the values
  as a link's are and answer `setArgs` (`accepted`, `dropped`) and links that carry those taken; a value left out fails
  the command. A named value is `{ "of": "<type>", "named": "<name>" }`; `{ "forgebookUnset": true }` leaves a prop with no
  value over the story's own; an empty text is `""`; a `Date` is `{ "forgebookDate": "<ISO>" }`. Give a person the `address` link to look at them: `forgebook shot` draws
  a frame alone, with the story's own values.
- A custom control (`control: "custom"`, `custom` its name) takes a value that fits `schema`, in `controls`; set it as any
  other. A new one is a module exporting `mount(el, { value, onChange, argType })`, returning an unmount, and `schema`,
  registered in `argControls` of `forgebook.config`; keep what touches the page inside `mount`, so the commands can read it.
- A prop's TSDoc can ask for design tokens (`@token color`, a token's type or a part of its name), a story's arg with
  `argTypes: { x: { control: { type: "token", of: "space", format: "var(--{name})" } } }`.
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
- `parameters.main: true` marks the one real, well-made use drawn at the top of the component's page.
- `parameters.group` puts a story under a heading of the page (`"states"`, `"worst-case"`); keep one story per
  meaningful state, not one per prop value.
- Add a worst case: very long text, words without spaces, huge numbers (`forgebook new` writes one).
- A link or an embed may carry the Props tab's values (`args=` in the address, as JSON or in a Storybook link's form,
  `label:Hello+world;count:5;open:!true`; what a story cannot take is listed above it, by name; `?path=/story/<id>`, Storybook's address, opens that story). The catalogue applies only the
  props the story's panel can set, with a value of their type; to show a story with other values, write a story with
  those args rather than a link.
- `parameters.suspense` says how the frame waits for a `Suspense` boundary: `{ expected: true }` for a story meant to stay
  in its fallback, a loading state; `{ timeout: 15000 }` to wait longer than the 10 s by default. Past the wait a story is
  `pending`, which `check` and `verify` read as not verified.
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
  (`@forgebook/story-format/texts`), or `useStoryText()` inside a `render`. A source gives each language's table, or a
  loader of it (`texts: { en: () => import("./locales/en.json") }`), which keeps the texts out of the catalogue's page.
- Write `title`, `parameters.main`, `group`, `height`, `touch`, `logic`, `requiredFirst` and `design.figma` as plain
  values: the catalogue reads them without running the file.
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
- A prop with `onlyWhen` belongs to some variants of a union of props: pass it only with the discriminant set to one of
  its `values` (`href` with `kind: "link"`), or with it left out when `orOmitted` is true. A prop's `notes` say why its type is not as written (a generic shown as
  its constraint, a name that cannot be found, an `any`); a component's `propsNote` says why it lists no props. Read
  its source before guessing a value its docs cannot describe.
