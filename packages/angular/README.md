# @forgebook/angular

Angular and Analog for [Forgebook](https://www.npmjs.com/package/forgebook): the story types and Storybook's Angular
helpers, the renderer the frame draws a story with, and the adapter that compiles your components through Analog's Vite
plugin and reads their inputs, outputs and projected content.

**Requirements:** Angular 20, 21 or 22 with `@angular/build` (any Angular CLI or Analog project has it) · `forgebook` ·
React 18.2 or 19 in the project, for the catalogue's own interface (the frames that draw your components load none) ·
[MIT licence](https://github.com/ensiria/forgebook/blob/develop/packages/angular/LICENSE)

```sh
npm install --save-dev forgebook @forgebook/angular react react-dom
```

The catalogue's configuration names it as its framework:

```ts
// forgebook.config.ts
import { angular } from "@forgebook/angular/vite";
import { defineConfig } from "forgebook";

export default defineConfig({ framework: angular(), title: "My components", stories: ["src/**/*.stories.ts"] });
```

and the stories take their types and helpers from it:

```ts
import { applicationConfig, argsToTemplate, type Meta, type Story } from "@forgebook/angular";
import { provideHttpClient } from "@angular/common/http";

import { Badge } from "./badge.component";

export default {
  title: "Components/Badge",
  component: Badge,
  decorators: [applicationConfig({ providers: [provideHttpClient()] })]
} satisfies Meta<typeof Badge>;

// the component with its args: inputs (signal or decorated), outputs as handlers
export const Default: Story<typeof Badge> = { args: { label: "New", tone: "info" } };

// projected content, each `<ng-content select>` as `#<selector>`, the rest as `#default`
export const WithIcon: Story<typeof Badge> = { args: { label: "New", "#[icon]": "*", "#default": "more" } };

// a template, as Storybook's Angular stories write one
export const InACard: Story<typeof Badge> = {
  render: (args) => ({ props: args, template: `<fb-card><fb-badge ${argsToTemplate(args)} /></fb-card>` })
};
```

| Import | What it is |
|---|---|
| `@forgebook/angular` | `Meta`, `Story`, `Decorator`, `Preview`, `LogicMeta`: CSF 3 typed for Angular; `moduleMetadata`, `applicationConfig`, `componentWrapperDecorator`, `argsToTemplate`, as Storybook's |
| `@forgebook/angular/vite` | `angular()`, the framework adapter of `forgebook.config.ts`, with Analog's Angular plugin |
| `@forgebook/angular/texts`, `@forgebook/angular/clock` | `injectStoryText()`, `injectStoryClock()`, `injectStoryNow()`: a story's texts in the catalogue's language, and the story clock, as signals |
| `@forgebook/angular/renderer` | `angularRenderer`, for the generated server tests |

## How it compiles

Your components are compiled ahead of time by [`@analogjs/vite-plugin-angular`](https://www.npmjs.com/package/@analogjs/vite-plugin-angular),
as Angular's own build compiles them: decorators, signal inputs, models and queries, `templateUrl` and `styleUrl`, with
your `angularCompilerOptions`. An Analog application is Angular on that same plugin, so its components need nothing more.
The program is the one `tsconfig.app.json` describes (else `tsconfig.json`); name another with
`angular({ tsconfig: ".storybook/tsconfig.json" })`. It must include the components; story files, the preview and other
TypeScript outside it reach the page with their types stripped. Styles written inside a component are CSS unless
`angular({ inlineStylesExtension: "scss" })`.

A story of the meta's component draws the component itself, its args set as inputs: no template is compiled, and the
frame loads no compiler. A story with a template (its own, or a decorator's such as `componentWrapperDecorator`) is
compiled in its frame by Angular's compiler, loaded on first use. New args keep a story's state either way; a story starts
over only when its template, metadata or application providers change: providers made inside a `render`
(`useFactory: () => …`, `new Service()`) are new at each call, so give them with `moduleMetadata` or
`applicationConfig` in the meta's `decorators` to keep a story's state across args.

Change detection is zoneless, Angular's default since version 21. A library that needs zone.js imports `zone.js` in its
preview and adds `provideZoneChangeDetection()` with `applicationConfig`.

## What the catalogue reads

Inputs, outputs and projected content come from the class, its decorator and its template, read with TypeScript in the
catalogue's own program, never run, so an edit shows at once. An input is listed by the name a template binds (its
alias), with the value a signal holds (`input<"sm" | "md">()` is a choice), required when `input.required()` or
`{ required: true }` says so, its default from its initial value or `@defaultValue`; inherited inputs count. An output is
an event with what it passes, a model's `<name>Change` among them. Each `<ng-content>` of the template, inline or in its
`templateUrl`, is an arg any text fills. A directive is read the same way, by its selector. Compodoc is not used: its JSON
is a separate step that goes stale, while the program is kept up to date for every framework.

The Code tab writes a story drawn from its args as an Angular template, by the component's selector:
`<fb-badge label="New" [count]="3"></fb-badge>`, projected content between the tags.

`forgebook new`, `forgebook docs --framework angular` and `forgebook init --from storybook` (from `@storybook/angular` or
`@analogjs/storybook-angular`, with the TypeScript configuration its stories compiled with) read Angular too.

## Server tests

The generated server tests draw each story with `@angular/platform-server` (an optional peer). Angular's packages are
compiled in part for a linker Vitest does not run, so the tests load the compiler first; and since Analog's plugin runs
tests in VM threads (for zone.js) unless told otherwise, name Vitest's own pool:

```ts
// vitest.config.ts
import { angular } from "@forgebook/angular/vite";
import { forgebookPlugin } from "forgebook/vite";
import { defineConfig } from "vitest/config";

const framework = angular();

export default defineConfig(async () => ({
  plugins: [forgebookPlugin({ framework }), ...((await framework.vitePlugins?.()) ?? [])],
  test: { environment: "node", setupFiles: ["@angular/compiler"], pool: "forks" }
}));
```

```ts
// stories.test.ts
import { angularRenderer } from "@forgebook/angular/renderer";
import { storyServerTests } from "@forgebook/testing/server";

storyServerTests(source, { renderer: angularRenderer, previews: [preview] });
```

## What it does not do

- Stories that import Storybook's helpers from `@storybook/angular` load Storybook's own code in the frames; import them
  from `@forgebook/angular` instead (same names). `setProjectAnnotations`, Storybook's portable stories, is not offered.
- An input with an alias is typed by its property's name in `Meta` and `Story`, while a story sets it by its alias.
- A story of the meta's component sets its inputs, outputs and content only; Storybook also writes any other arg onto the
  component's instance, which Forgebook does not.
- Projected content from args is text; a story that projects elements writes a template.
- A component edit reloads its frame: Angular's hot module replacement through Analog (`liveReload`) is not used.
- `angular.json`'s builder options (`styles`, `stylePreprocessorOptions`, `assets`) are not read: import global styles in
  the preview.
- "Used in" follows React's JSX, not Angular templates, so it lists nothing yet.
- The `NgModule`-era `entryComponents` and Storybook's `bootstrapModuleOptions` are not read.

The rest of its exports are what the catalogue loads itself. Getting started, the catalogue's features and its commands:
[Forgebook's README](https://github.com/ensiria/forgebook/blob/develop/packages/forgebook/README.md).
