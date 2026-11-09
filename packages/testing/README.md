# @forgebook/testing

Tests from a package's [Forgebook](https://www.npmjs.com/package/forgebook) stories, so writing a story is writing its
tests:

- **in the browser** (Playwright), one test per story and variant (theme, contrast, style sheets, a narrow width): it
  fails on an error in the page, an [axe](https://github.com/dequelabs/axe-core) violation of WCAG 2.2 A and AA, an
  element that spills out of its parent (an inline element by what it draws: the space a line ends with at a soft wrap,
  which `white-space: pre-wrap` lets hang past the line, is no spill), or an overlay left open past the story's frame;
  a static file that answers 404
  (an image, a font) is a `warning` annotation on the test, not a failure;
- **visual**, the same frames compared with reference screenshots, in the Playwright container so fonts and rendering
  match everywhere;
- **on the server** (Vitest), each story rendered to a string, so no component reads `window` or `document` while it
  renders, and its controls checked against its args.

**Requirements:** `forgebook` · `@playwright/test` 1.64+ · Vitest 5 · Docker for the visual tests ·
[MIT licence](https://github.com/ensiria/forgebook/blob/develop/packages/testing/LICENSE)

```sh
npm install --save-dev @forgebook/testing @playwright/test vitest
```

## Setting up the tests

The tests run on the package's own **story source** (the `StorySource` its catalogue lists), in a folder of their
own. The example below is a package whose stories are `src/*.stories.tsx` and whose source is `stories/index.ts`:

```ts
// stories/index.ts
/// <reference types="@forgebook/story-format/client" />
import type { StorySource } from "@forgebook/story-format/source";

import files from "../src/*.stories.tsx?forgebook-files";

export const source: StorySource = {
  id: "acme-ui",
  name: "Acme UI",
  files: [files],
  sheets: { required: [], theme: [], restyled: [] }
};
```

### In the browser

Six files in `test/stories/`. Where the stories are, with the same patterns as the source:

```ts
// test/stories/storyFiles.ts
import { join } from "node:path";

import type { StoryFilesOptions } from "@forgebook/testing/story-files";

export const STORY_FILES: StoryFilesOptions = {
  sourceId: "acme-ui",
  name: "Acme UI",
  root: join(import.meta.dirname, "..", "..", "stories"),
  patterns: ["../src/*.stories.tsx"]
};
```

The folder and the ports, then the Playwright configuration and the spec:

```ts
// test/stories/testServer.ts
import type { StoryTestServer } from "@forgebook/testing/playwright";

export const STORY_SERVER: StoryTestServer = { dir: import.meta.dirname, port: 41831, browserPort: 41832 };

// test/stories/playwright.config.ts
import { storyTestConfig } from "@forgebook/testing/playwright";

import { STORY_SERVER } from "./testServer";

export default storyTestConfig(STORY_SERVER);

// test/stories/stories.spec.ts
import { storyBrowserTests } from "@forgebook/testing/browser";

import { STORY_FILES } from "./storyFiles";

storyBrowserTests(STORY_FILES);
```

The frame page the tests open, and the Vite configuration that serves it:

```html
<!-- test/stories/frame.html -->
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Stories</title></head>
  <body><div id="root"></div><script type="module" src="./frame.tsx"></script></body>
</html>
```

```tsx
// test/stories/frame.tsx
import "@forgebook/testing/fonts.css";
import { mountFrame } from "@forgebook/react/frame";

import { source } from "../../stories/index";

const root = document.getElementById("root");
if (root !== null) void mountFrame(root, { sources: [source] });

// test/stories/vite.config.ts
import { react } from "@forgebook/react/vite";
import { storyTestViteConfig } from "@forgebook/testing/vite";

export default storyTestViteConfig(import.meta.dirname, react());
```

The config holds the framework's own Vite plugins (React's, or Solid's that compiles the stories' JSX), as the catalogue
does: don't add them again.

Then `npx forgebook browser` once (it installs only the build this Playwright needs and removes no other project's), and `playwright test -c test/stories/playwright.config.ts` starts the
frame page and runs one test per story and variant (light, dark, both with more contrast, a narrow width, and the
structure view), starting Vite through the package manager that runs them (`vite` in `testServer.ts` names
another command). A story that breaks a rule fails all its variants; `storyBrowserTests` also takes `check`, a rule of
the package's own run on every frame.

In CI (`CI` set, as every CI service sets it) a failed test runs again up to twice, as Playwright's own template does:
a busy runner now and then loses a test's browser before the story opens, which says nothing of the story. A test that
passes on a retry is reported as flaky, not as passed. Elsewhere nothing is retried; `retries` in `testServer.ts` sets
the count everywhere (`retries: 0` turns it off).

A test fails on a story its frame gave up on (status `pending`: something still loading after the wait of
`parameters.suspense`), with the frame's reason, before any check runs: a fallback is not what the check is for.

A story about logic (`parameters: { logic: true }`, a hook's or a function's scene) is tested once, in the catalogue's
default view, named `logic`: the variants only change how it looks. Its test still waits for the frame to be ready, so
its play has to pass, and fails on an error in the page; axe runs too, since the scene is a page a person uses and a
demo that fails WCAG is a bad example to copy. The checks about looks are left out: the spills and the overlays (layout
at the variants' widths) and the package's own `check`, and a screenshot run takes no reference image of it.
`forgebook check` runs the same checks on it, and with `--all-variants` both it and `forgebook shot` open it once, in
the default view.

### On the server

One test file and a Vitest configuration with the catalogue's plugin, which reads the source's
`?forgebook-files` imports:

```tsx
// test/stories/stories.server.test.tsx
import { reactRenderer } from "@forgebook/react/renderer";
import { storyServerTests } from "@forgebook/testing/server";

import { source } from "../../stories/index";

storyServerTests(source, { renderer: reactRenderer });

// vitest.config.ts
import { react } from "@forgebook/react/vite";
import { forgebookPlugin } from "forgebook/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [forgebookPlugin({ framework: react() })],
  test: { include: ["test/**/*.test.tsx"] }
});
```

The plugin keeps a module that imports story files out of Vitest's module cache (`fsModuleCache`), as a group must be
listed anew on each run; every other module stays cached.

`storyServerTests` also takes `wrap`: a second pass with every story inside a decorator (a provider with a partial
translation catalogue), its HTML checked.

### Limits today

- The visual tests (`visual.spec.ts`, `visualTestConfig`, `startVisualBrowser`) compare the frames with reference
  images in the Playwright container, so they need Docker; this guide does not cover them yet, their modules' TSDoc
  does.

## Imports and commands

| Import or command | What it is |
|---|---|
| `@forgebook/testing/browser` | The browser and visual tests of every story |
| `@forgebook/testing/server` | The server-render tests of every story |
| `@forgebook/testing/playwright`, `@forgebook/testing/vite` | The Playwright configurations and the Vite config of the test frame page |
| `forgebook-heights` | Measures every story's height at a few widths, for the catalogue's loading boxes |
| `forgebook-shot` | Opens one story of a running catalogue and reports it with a picture |

More: [Forgebook's README](https://github.com/ensiria/forgebook/blob/develop/packages/forgebook/README.md).

## Writing a framework adapter

A framework is an adapter package: a renderer, a code writer and a docs reader. `@forgebook/testing/conformance` is what
every adapter passes, in its own Vitest with a simulated page, so a framework is done when this is green:

```ts
import { describeAdapter } from "@forgebook/testing/conformance";

describeAdapter({ name: "Solid", renderer, drawing, decorator, codeOf, docsOf });
```

`drawing(name)` gives a story with a button showing `Hello <name> <clicks>`, its clicks in its own state, which throws
for `THROWING_NAME`. `decorator(label)` draws a story inside a `section` with that `data-decorator`. A renderer's
`renderToString` may return a promise. The frame takes only the drawing half, a `FrameRenderer` of `forgebook/renderer`:
a framework's frame page imports a module without the server render, so the server renderer stays out of a static
catalogue and of a first start's pre-bundle (`reactFrameRenderer` in `@forgebook/react`). A framework whose page and
server builds differ runs the suite twice, with `half: "page"` in a simulated page and `half: "server"` in Node: Svelte
compiles a component apart for each, and Solid's `solid-js/web` is its browser build or its server build, never both.
`test/conformance.test.tsx` in `@forgebook/react` and `@forgebook/preact`, `test/conformance.test.ts` in
`@forgebook/vue`, `@forgebook/web-components`, `@forgebook/html` and `@forgebook/angular`, and the two `conformance`
tests of `@forgebook/svelte` and of `@forgebook/solid` are complete examples.
