# @forgebook/html

Plain HTML for [Forgebook](https://www.npmjs.com/package/forgebook): stories that return an HTML string or a DOM node,
written in JavaScript or TypeScript with no framework, as Storybook's `@storybook/html-vite` stories are. The story
types, the renderer the frame draws them with, and the adapter that reads a story's args from its types and TSDoc.

**Requirements:** `forgebook` · React 18.2 or 19 in the project, for the catalogue's own interface (the frames that draw
your stories load none) · [MIT licence](https://github.com/ensiria/forgebook/blob/develop/packages/html/LICENSE)

```sh
npm install --save-dev forgebook @forgebook/html react react-dom
```

The catalogue's configuration names it as its framework:

```ts
// forgebook.config.ts
import { html } from "@forgebook/html/vite";
import { defineConfig } from "forgebook";

export default defineConfig({ framework: html(), title: "My components", stories: ["src/**/*.stories.ts"] });
```

and the stories take their types from it:

```ts
import type { Meta, Story } from "@forgebook/html";

import { createButton } from "./button";

// the function that draws: its first parameter is the args
export default { title: "Components/Button", component: createButton } satisfies Meta<typeof createButton>;

// no render: the meta's function, called with the args
export const Default: Story<typeof createButton> = { args: { label: "Save" } };

// a render returning HTML; a text written into it is the story's to escape
export const InAToolbar: Story<typeof createButton> = {
  render: (args) => `<div class="toolbar">${createButton({ label: "Save", ...args }).outerHTML}</div>`
};
```

A story file with no function to name types its args the way Storybook's HTML stories do,
`{ title, render, argTypes } satisfies Meta<ButtonArgs>`, or writes the type on its render's parameter. A decorator's
`story()` gives what the story returned, a text or a node: a decorator that writes HTML puts a text inside it, one that
builds a node appends a node. A decorator that answers a text with a text keeps what stays when the args change (below);
one that builds a new node each time draws everything anew.

| Import | What it is |
|---|---|
| `@forgebook/html` | `Meta`, `Story`, `Decorator`, `Preview`, `LogicMeta`: CSF 3 typed for HTML, the args from a function's first parameter or from a type |
| `@forgebook/html/vite` | `html()`, the framework adapter of `forgebook.config.ts` |
| `@forgebook/html/renderer` | `htmlRenderer`, for the generated server tests |

## What the catalogue reads

The args are read, with their TSDoc, from the first that types them: the meta's `component`, the type the meta is
checked against (`Meta<typeof createButton>`, `Meta<ButtonArgs>`), the meta's `render`'s parameter. Plain JavaScript reads
the same from JSDoc (`@param {{ label: string }} args`). A file that types none of them shows the args its `argTypes`
describe. The Code tab shows a story's render as written, and a story drawn from its args as the call that draws it
(`createButton({ label: "Save" })`).

## How a story is drawn

A text is HTML, placed as `innerHTML` places it: a `<script>` in it does not run. When the args change, the new HTML is
laid over what the canvas shows instead of replacing it, so a focused field keeps its focus and what was typed in it, and
a custom element keeps its own state and the children it drew. A node is placed as it is, unless it is the node already
shown: a story that keeps its node and changes it keeps everything. The story clock's ticks draw the story again.

On a server (the generated server tests, with `htmlRenderer`) a text is its own HTML and a node its `outerHTML`, so a
story that builds nodes needs a DOM there: a simulated one (`environment: "happy-dom"`), or a story that writes HTML.

A story writes its args into HTML, where a quote or a `<` becomes markup. A shared link carries the props panel's
values, chosen by whoever writes it, so for an HTML catalogue a link's text reaches a story only when it is plain words
(letters and digits of any script, spaces, `_ . , ! ? # % + -`); otherwise the story's own value is drawn. Values typed
in the panel are yours and are not checked, and a story should still escape what it writes into HTML.

`forgebook new` writes a function's first stories, `forgebook docs --framework html` reads them for `CATALOG.md`, and
`forgebook init --from storybook` reads a project on `@storybook/html-vite`. Storybook's other forms of `component` (an
HTML template with `{{name}}` placeholders, an element to clone) are not read: a function takes their place.

The rest of its exports are what the catalogue loads itself. Getting started, the catalogue's features and its commands:
[Forgebook's README](https://github.com/ensiria/forgebook/blob/develop/packages/forgebook/README.md).
