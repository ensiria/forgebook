# @forgebook/web-components

Web Components for [Forgebook](https://www.npmjs.com/package/forgebook), Lit first: the story types, the renderer the
frame draws a custom element story with, and the adapter that reads an element's attributes, properties, events, slots
and CSS parts from its [Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest), or from a
Lit element's TypeScript where there is none.

**Requirements:** Lit 3.2 · `forgebook` · Vite 8.3.4+ · React in the project, for the catalogue's own interface (the frames
that draw your elements load none) · `@lit-labs/ssr` only for the generated server tests ·
[MIT licence](https://github.com/ensiria/forgebook/blob/develop/packages/web-components/LICENSE)

```sh
npm install --save-dev forgebook @forgebook/web-components lit
```

The catalogue's configuration names it as its framework:

```ts
// forgebook.config.ts
import { webComponents } from "@forgebook/web-components/vite";
import { defineConfig } from "forgebook";

export default defineConfig({ framework: webComponents(), title: "My elements", stories: ["src/**/*.stories.ts"] });
```

and the stories take their types from it. A meta names its element by its tag, as Storybook's Web Components stories
do, or by its class:

```ts
import type { Meta, Story } from "@forgebook/web-components";
import { html } from "lit";

import "./my-badge.ts";

export default { title: "Components/Badge", component: "my-badge" } satisfies Meta<"my-badge">;

// the element with its args
export const Default: Story<"my-badge"> = { args: { label: "New", tone: "info" } };

// a property, a slot and an event, each with its own prefix
export const Full: Story<"my-badge"> = {
  args: { label: "New", ".keywords": ["fresh"], "#icon": "*", "#default": "more text" }
};

// a render, returning a Lit template (or a DOM node, or HTML as a string, whose values the render escapes itself:
// prefer `html`, which escapes them)
export const InATemplate: Story<"my-badge"> = {
  render: (args) => html`<my-badge label=${args.label ?? ""} tone="danger"></my-badge>`
};
```

## How args reach an element

An element takes values three ways that a plain object of args cannot tell apart, so an arg's name says which, the way
Lit's templates write a binding:

| Arg | What it sets | Example |
|---|---|---|
| `name` | The attribute: a text, a number or `true`; `false`, `null` and `undefined` take it away. A list or an object under a plain name is set as the property of that name | `label: "New"`, `"item-count": 3` |
| `.name` | The property, any value | `".items": ["a", "b"]` |
| `#name` | The light DOM of a slot: a text, a node, a template, or a function returning one. `#default` fills the unnamed slot, so a slot literally named `default` cannot be filled from the args; a named slot's content goes in a `<span slot="name">` | `"#icon": "*"` |
| `@name` | Nothing: the catalogue listens to the event and records it in Events | `"@change"` |

No arg sets an event handler attribute (`onclick`: HTML's handlers are `on` and letters, so `one-line` is fine) or a
property that writes HTML (`innerHTML`, `outerHTML`, `srcdoc`): a catalogue's address can carry args, and a shared link
must not run a script in it. A list under a plain name is written in HTML as JSON (`items='["a"]'`), which is what Lit's
`Array` converter reads; in the page it is set as the property of that same name, which is the same field when the
attribute is the field's name in lowercase, Lit's default.

A story with no render draws the meta's element once and brings it to each new set of args, so it keeps its own state as
the panel changes them; an arg that goes away takes its attribute away, or puts its property back to the value the
element had. A render is called again on each change, and Lit keeps every element its template drew before. Events are
listened to on the story's canvas, whether they bubble or not and whether the story has a render or not, so a render does
not bind `@name` args itself. A story reads its texts and the story clock from its context (`render: (args, { text,
clock }) => …`), and a render that reads the clock is drawn again at each tick.

The story waits for every Lit element in it to finish updating before its play function runs. What a render throws, what
an element throws as it is inserted, and what a Lit element's update throws are shown in place of the story; the next
change draws it anew, with new elements.

## What the catalogue reads

The manifest is the one a package names in its `package.json` (`"customElements": "custom-elements.json"`), or the
`custom-elements.json` beside it, as `@custom-elements-manifest/analyzer` (`cem analyze --litelement`) writes it. Each
attribute is listed by its own name (`item-count`), with its field's type, description and default where its own are
missing; each public field no attribute sets as a property (`.keywords`); then the slots and the events, each passing its
event; CSS parts are the component's parts, and `deprecated` is its usage guidance. A type the manifest only names
(`Tone`) is spelled out from the element's TypeScript source, so a union of values is still a choice in the panel. The
manifest is read again whenever it changes, so an analyzer in watch mode renews the docs.

For an element the manifest does not list, or a package with none, the Lit element's TypeScript is read: a tag leads to
its class through `HTMLElementTagNameMap` or its definition (`@customElement("my-badge")`, `customElements.define`); its
reactive properties are its `@property()` fields and the keys of `static properties` (`@state()` and `state: true` are
internal), each under the attribute Lit gives it; its events come from `@fires` and from the events it dispatches with a
literal name, its slots from `@slot`, its parts from `@csspart`; `@useWhen`, `@avoidWhen`, `@deprecated` and the other
usage tags are read as for any component.

In a story, the docs name an element by its tag, which is what the Code card writes. `forgebook new` names it by its
class, which the stories it writes import. `forgebook docs --framework web-components` and `forgebook init --from
storybook` (from `@storybook/web-components-vite`) read Web Components too.

## The code and the server

The Code card writes a story as HTML: attributes as HTML writes them (a list as JSON, which Lit's `Array` converter
reads), slots between the tags. HTML holds no property, listener or script value, so `.name`, `@name` and named values
are left out of it.

Generated server tests take `webComponentsRenderer` from `@forgebook/web-components/renderer` and need
[`@lit-labs/ssr`](https://www.npmjs.com/package/@lit-labs/ssr), with its DOM shim loaded before the stories:

```ts
// vitest.config.ts
export default defineConfig({
  plugins: [forgebookPlugin({ framework: webComponents() })],
  test: { environment: "node", setupFiles: ["@lit-labs/ssr/lib/install-global-dom-shim.js"] }
});
```

Lit's server renderer writes Lit elements with their shadow roots as declarative shadow DOM. What it cannot render, a
server test reports: a custom element that is not a Lit element is written with its attributes and light DOM only, its
shadow root left to the browser; a render that returns a DOM node fails, since a server has no DOM; a story with no
render is written with its attributes and slots, without its properties (`.name`), which HTML cannot carry. The page
never loads the server renderer.

The rest of its exports are what the catalogue loads itself. Getting started, the catalogue's features and its commands:
[Forgebook's README](https://github.com/ensiria/forgebook/blob/develop/packages/forgebook/README.md).
