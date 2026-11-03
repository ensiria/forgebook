<img src="assets/forgebook-logo.svg" alt="" width="64" height="64">

# Forgebook

See every component in every theme, contrast, language and width. Write CSF stories, run `forgebook dev`: one frame
per story, switches for theme, contrast, motion and language, and a props table from the components' types.

> **Status:** 0.x, early. Its author's design system runs on it; the API may still change between minor versions.

This repository holds Forgebook's packages; each has its own README, which is also its npm page.

| Package | What it is |
|---|---|
| [`forgebook`](packages/forgebook) | The catalogue: the shell, one frame per story, the Vite plugin and the commands. **Start here.** |
| [`@forgebook/react`](packages/react) | React's story types, renderer and props reader |
| [`@forgebook/vue`](packages/vue) | Vue's story types, renderer and props, events and slots reader |
| [`@forgebook/svelte`](packages/svelte) | Svelte's story types, renderer and props, snippets and callback props reader |
| [`@forgebook/solid`](packages/solid) | Solid's story types, renderer (args update in place) and props reader |
| [`@forgebook/preact`](packages/preact) | Preact's story types, renderer (on Preact itself, no compat) and props reader |
| [`@forgebook/web-components`](packages/web-components) | Web Components' story types, Lit renderer, and reader of the Custom Elements Manifest |
| [`@forgebook/html`](packages/html) | Plain HTML's story types, renderer and args reader, for stories with no framework |
| [`@forgebook/nextjs`](packages/nextjs) | A Next.js project's components outside Next.js: images, fonts, links, both routers, server components |
| [`@forgebook/story-format`](packages/story-format) | The story format, for a library whose stories must not depend on a catalogue |
| [`@forgebook/testing`](packages/testing) | Tests generated from the stories: browser, visual and server render |

Requirements: Node 22.18 or later and Vite 8; React 19, Vue 3.5, Svelte 5, Solid 1.9, Preact 10.19 or 11, Lit 3 or
no framework, Next.js 15 and 16 through `@forgebook/nextjs`. [MIT licence](LICENSE).

Bugs, proposals and pull requests: [CONTRIBUTING.md](CONTRIBUTING.md). Security problems: [SECURITY.md](SECURITY.md).
