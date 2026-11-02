# The plugin API

Version 1. A plugin is a package a catalogue lists in `plugins`. This is the whole contract: what is not written here is
private to Forgebook and may change.

```ts
// forgebook.config.ts
import { figma } from "@forgebook/plugin-figma";

export default defineConfig({ /* … */ plugins: [figma()] });
```

## The declaration

A plugin is plain data, read on Node. Everything that runs in a page is a module it names, as a specifier the catalogue's
folder resolves, so a catalogue that lists no plugin has nothing to load.

```ts
// @acme/forgebook-plugin
import { definePlugin } from "forgebook/plugin";

export const acme = () =>
  definePlugin({
    apiVersion: 1,
    id: "acme",
    tabs: [{ id: "acme", label: "Acme", view: "@acme/forgebook-plugin/tab", when: { parameter: "acme" } }],
    switches: [/* PluginSwitch */],
    docBlocks: [{ fence: "acme", view: "@acme/forgebook-plugin/block" }],
    frame: "@acme/forgebook-plugin/frame",
    browserDependencies: ["acme/browser"]
  });
```

| Field | What it does |
|---|---|
| `apiVersion` | The contract it is written for, the number itself. Forgebook refuses another, saying both versions. |
| `id` | Lower-case words and hyphens. Starts the ids below, and names its texts. |
| `tabs` | Panel tabs, after Code and before Accessibility, in the order of `plugins`. `when` offers one only for some stories; without it, for every story. |
| `switches` | Switches of the toolbar and the View menu: a `ViewSwitch` without `role`, after the catalogue's own. The catalogue's switch of the same id wins. One applied by `code` reaches stories and decorators as `context.globals[id]`. |
| `docBlocks` | Blocks of a docs page, written as a fence named after them at the page's top level: ```` ```acme <argument> ````. |
| `frame` | The module that runs in every frame: one, or one per framework by the adapter's name (`{ react: "…" }`), since what a decorator returns is the framework's. A catalogue of a framework it does not name refuses the plugin. |
| `browserDependencies` | What its modules import in the browser: pre-bundled, so a page never reloads to find it, and a project without it is told at once. |

Tab ids, switch ids and fences are the plugin's `id`, or that, a hyphen and more (`acme-log`). So a later tab, address
parameter or fence of Forgebook's can never collide with a plugin, and a fence never takes a language's name. Anything else
stops the catalogue with a message that names it. A tab's id is what `?tab=<id>` and `tabs: { <id>: false }` take.

`when` is one of two:

- `{ design: "figma" }`: for a story whose `parameters.design.figma` passed its check. Known at once, from the index.
- `{ parameter: "acme" }`: for a story with that top-level parameter. Known once its frame ran, so the tab comes in then, and
  not at all for a story that fails first.

## Views

A tab or a docs block is a module that exports a `PluginView` as `view`: it is handed an element and draws in it with
whatever it likes. The contract never names React, so the shell's own components stay free to change. The element has no
box of its own (`display: contents`).

```ts
export const view: PluginView<PluginTabContext> = (target, context) => {
  target.textContent = context.story.name;
  return {
    update: (next) => { target.textContent = next.story.name; },
    unmount: () => { target.replaceChildren(); }
  };
};
```

In React, `forgebook/plugin-react` is those lines:

```tsx
import type { PluginTabContext } from "forgebook/plugin";
import { type PluginViewProps, reactView } from "forgebook/plugin-react";

const Tab = ({ context }: PluginViewProps<PluginTabContext>) => <p>{context.story.name}</p>;
export const view = reactView(Tab);
```

A tab's module loads the first time the tab opens, a block's when its page draws it. A tab's view lives for one story, and
only while its tab is chosen; `update` hands it a whole new context. A view that cannot load, or that throws while it mounts or
updates, is said in its place and leaves the shell standing; what `unmount` throws goes to the page's error handler.

Every view is told:

| Context | What it is |
|---|---|
| `appearance` | `"light"` or `"dark"`, the shell's now. |
| `text(key, fallback, values?)` | A text: the catalogue's `strings["plugin.<id>.<key>"]`, or the English given, with `{name}` replaced by its value. |

A tab is also told:

| Context | What it is |
|---|---|
| `story` | `id`, `name`, `title`, `componentName`, and `design`: `{ figma? }`, a checked `FigmaLink` of `forgebook/figma-link`. |
| `report` | The last value the plugin's frame module reported for this story; none before that, and none in the compare view, where no frame is the story's. |
| `showStory(target, { title })` | Draws the story again in an element, as the stage has it now; `{ remove }` takes it away. |

A docs block is also told `argument` (what the fence's line says after its name), `body` (the text inside the fence) and
`showStory(target, { title, storyId })`, which draws any story in the page's view and throws for one the catalogue lacks.

`text` and `showStory` stay the same function for a view's whole life. A catalogue names a tab with `strings["tabs.<id>"]`.

### Look

A view's classes start with its plugin's id. Its CSS may read the public theme, `--forgebook-<role>` for the roles of
`ShellPalette` (`--forgebook-text`, `--forgebook-surface`, `--forgebook-separator`…), and may use these classes of the
shell: `forgebook-button`, `forgebook-tab-note`, `forgebook-problems` and `forgebook-spinner`. Every other class is private.

## The frame module

It exports `frame`, made with `definePluginFrame` and called once per frame. It loads with every story, so a heavy tool is
imported inside `prepare`.

```ts
import { definePluginFrame } from "forgebook/plugin";

export const frame = definePluginFrame(({ report }) => ({
  prepare: async ({ parameters }) => {
    if (parameters["acme"] === undefined) return undefined;
    const stop = await start();
    report({ isOn: true }, { hint: "on" });
    return stop;
  },
  decorators: [(story, context) => story()]
}));
```

- `prepare` runs before every mount, ahead of the story's loaders, with the context of a CSF `beforeEach`. What it returns
  runs when the story is mounted again or left, and the next mount waits for it. What it throws is shown as the story's error.
- `decorators` wrap every story, outside the catalogue's own.
- `report(value, { hint?, tab? })` tells the plugin's tabs. The value is JSON and replaces the last one, so it holds
  everything they need. `hint` is a short note beside the name of `tab`, the plugin's first by default.

What the `frame` function itself throws is shown in place of the story, in every frame: a broken frame module is not hidden.

## Versions

The contract's version is separate from the package's. A plugin writes the number; Forgebook keeps the list of versions it
speaks and refuses any other by name.

- **What raises it:** removing or changing anything here, or widening a union a plugin reads or writes (a new kind of `when`).
  A raise is a major release of `forgebook`, with a note here and a `!` commit.
- **What keeps it:** adding an optional field to a declaration or a context. An older Forgebook ignores a field it does not
  know, so a plugin that needs a new field raises its `forgebook` peer range to the first release that has it.
- **Also frozen by this contract:** `ViewSwitch`, the context of a CSF `beforeEach` and `FigmaLink`, since it exposes them.

## What it leaves out, on purpose

- **The shell's layout.** No sidebar panels, no pages, no toolbar buttons, no replacing a part. Each would freeze how the
  shell is built.
- **Tab order.** Fixed by the list of `plugins`; a plugin cannot sit before Props or after Accessibility.
- **The shell's React.** No shell component, hook or state is exported; a React view has a root of its own.
- **Tab-to-frame messages.** A tab cannot talk to its frame module, which only reports. Neither real plugin needs it, and it
  can be added.
- **The story index, the agents' tools, the tests.** A plugin cannot add a field to the index or a tool to `forgebook mcp`.
  That is why `parameters.design` stays Forgebook's: the link, its header button and its answers to agents work with no plugin.
- **The docs pages' notes.** A block cannot report a problem to `forgebook pages`, and a plugin fence inside a list or a quote
  stays code, without a word.
- **Plugins from presets.** A catalogue lists its own; a preset cannot. It can be added.
- **Roles on switches.** The colour scheme, the contrast, the language stay the catalogue's to declare.
- **The server tests.** `prepare` and `decorators` run in frames, so in the browser tests; a story rendered to a string
  has neither.
