# @forgebook/testing

Tests from a package's [Forgebook](https://www.npmjs.com/package/forgebook) stories, so writing a story is writing its
tests:

- **in the browser** (Playwright), one test per story and variant (theme, contrast, style sheets, a narrow width): it
  fails on an error in the page, an [axe](https://github.com/dequelabs/axe-core) violation of WCAG 2.2 A and AA, an
  element that spills out of its parent, or an overlay left open past the story's frame;
- **visual**, the same frames compared with reference screenshots, in the Playwright container so fonts and rendering
  match everywhere;
- **on the server** (Vitest), each story rendered to a string, so no component reads `window` or `document` while it
  renders, and its controls checked against its args.

**Requirements:** `forgebook` · Vite 8 · `@playwright/test` 1.64+ · Vitest 5 ·
[MIT licence](https://github.com/Ensiria/forgebook/blob/develop/packages/testing/LICENSE)

```sh
npm install --save-dev @forgebook/testing @playwright/test vitest
```

| Import or command | What it is |
|---|---|
| `@forgebook/testing/browser` | The browser and visual tests of every story |
| `@forgebook/testing/server` | The server-render tests of every story |
| `@forgebook/testing/playwright`, `@forgebook/testing/vite` | The Playwright configurations and the Vite config of the test frame page |
| `forgebook-heights` | Measures every story's height at a few widths, for the catalogue's loading boxes |
| `forgebook-shot` | Opens one story of a running catalogue and reports it with a picture |

Each module's TSDoc describes its setup; a step-by-step guide is still to be written. More:
[Forgebook's README](https://github.com/Ensiria/forgebook/blob/develop/packages/forgebook/README.md).
