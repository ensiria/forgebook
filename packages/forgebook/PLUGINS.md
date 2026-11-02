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
import { definePlugin, PLUGIN_API_VERSION } from "forgebook/plugin";

export const acme = () =>
  definePlugin({
    apiVersion: PLUGIN_API_VERSION,
    id: "acme",
    tabs: [{ id: "acme", label: "Acme", view: "@acme/forgebook-plugin/tab", when: { parameter: "acme" } }],
    switches: [/* ViewSwitch, as a catalogue declares one */],
    docBlocks: [{ fence: "acme", view: "@acme/forgebook-plugin/block" }],
    frame: "@acme/forgebook-plugin/frame",
    frameworks: ["react"],
    browserDependencies: ["acme/browser"]
  });
```

| Field | What it does |
|---|---|
| `apiVersion` | The contract it is written for. Forgebook refuses another, saying both versions. |
| `id` | Lower-case words and hyphens. Names its messages and its texts. |
| `tabs` | Panel tabs, after Code and before Accessibility, in the order of `plugins`. `when: { parameter }` offers one only for a story with that parameter; without it, for every story. |
| `switches` | Switches of the toolbar and the View menu, as a catalogue declares them, after the catalogue's own. The catalogue's switch of the same id wins. |
| `docBlocks` | Blocks of a docs page, written as a fence named after them. **Not exercised yet:** see below. |
| `frame` | The module that runs in every frame. |
| `frameworks` | The frameworks its frame module works with, by the adapter's name; every one by default. Needed when it has decorators, whose result is the framework's. |
| `browserDependencies` | What its modules import in the browser, pre-bundled so a page never reloads to find it. |

A collision (a tab with one of Forgebook's ids or another plugin's, two plugins with one id, a block named `story` or
`props`) stops the catalogue with a message that names it.

## Views

A tab or a docs block is a module that exports a `PluginView` as `view`: it is handed an element and draws in it with
whatever it likes. The contract never names React, so the shell's own components stay free to change.

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

A tab's module loads the first time the tab opens. A view lives for one story, and only while its tab is chosen. One that
cannot load, or that throws, is said in its tab and leaves the shell standing.

Every view is told:

| Context | What it is |
|---|---|
| `apiVersion` | The contract the shell speaks. |
| `appearance` | `"light"` or `"dark"`, the shell's now. |
| `text(key, fallback)` | A text: the catalogue's `strings["plugin.<id>.<key>"]`, or the English given. |

A tab is also told:

| Context | What it is |
|---|---|
| `story` | `id`, `name`, `title`, `componentName`, `isLogic`, `design`. |
| `report` | The last value the plugin's frame module reported for this story. |
| `showStory(target, title)` | Draws the story again in an element, as the stage has it; returns what takes it away. |

A docs block is also told `argument` (what the fence's line says after its name) and `body` (the text inside the fence).

### Look

A view's CSS may read the public theme, `--forgebook-<role>` for the roles of `ShellPalette` (`--forgebook-text`,
`--forgebook-surface`, `--forgebook-separator`…), and may use these classes, kept for it: `forgebook-button`,
`forgebook-tab-note`, `forgebook-problems`, `forgebook-spinner`, `forgebook-frame-loading` and
`forgebook-frame-loading__label`. Any other class of the shell is private.

## The frame module

It exports `frame`, made with `definePluginFrame`, called once per frame. It loads with every story, so a heavy tool is
imported inside `prepare`.

```ts
import { definePluginFrame } from "forgebook/plugin";

export const frame = definePluginFrame(({ report }) => ({
  prepare: async ({ parameters }) => {
    if (parameters["acme"] === undefined) return undefined;
    const stop = await start();
    report({ isOn: true }, "on");
    return stop;
  },
  decorators: [(story, context) => story()]
}));
```

- `prepare` runs before every mount, ahead of the story's loaders, with the context of a CSF `beforeEach`. What it returns
  runs when the story is mounted again or left. What it throws is shown as the story's error.
- `decorators` wrap every story, outside the catalogue's own.
- `report(value, hint?)` tells the plugin's tab. The value is JSON and replaces the last one, so it holds everything the tab
  needs; `hint` is a short note beside the tab's name.

## Versions

`PLUGIN_API_VERSION` is the contract's version, separate from the package's. Adding an optional field to a declaration or a
context keeps it. Removing or changing anything here raises it, with a note here and a `!` commit; a plugin then states the
version it speaks, and a Forgebook that does not speak it refuses it by name. A plugin also keeps `forgebook` as a peer.

## What it leaves out, on purpose

- **The shell's layout.** No sidebar panels, no pages, no toolbar buttons, no replacing a part. Each would freeze how the
  shell is built.
- **Tab order.** Fixed by the list of `plugins`; a plugin cannot sit before Props or after Accessibility.
- **The shell's React.** No shell component, hook or state is exported; a React view has a root of its own.
- **Shell-to-frame messages.** A tab cannot talk to its frame module, which only reports. Nothing here needs it, and it can
  be added.
- **The story index, the agents' tools, the tests.** A plugin cannot add a field to the index or a tool to `forgebook mcp`.
  That is why `parameters.design` stays Forgebook's: the link, its header button and its answers to agents work with no plugin.
- **Plugins from presets.** A catalogue lists its own; a preset cannot. It can be added.
- **The server tests.** `prepare` and `decorators` run in frames, so in the browser tests; a story rendered to a string
  has neither.

## Not exercised yet

`docBlocks` is declared and checked, and listed by `forgebook plugins`, but nothing draws one: docs pages are not in the
shell yet. Its context is what those pages' fences can give, and it may change before they land, without raising the
version, since no plugin can have used it.
